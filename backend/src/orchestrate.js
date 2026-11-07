/**
 * orchestrate.js
 *
 * Calls the watsonx Orchestrate review agent via the Runs API.
 *
 * Flow:
 *   1. POST {WXO_INSTANCE_URL}/v1/orchestrate/runs  → { run_id, thread_id }
 *   2. GET  {WXO_INSTANCE_URL}/v1/orchestrate/runs/{run_id}  (poll until completed)
 *   3. GET  {WXO_INSTANCE_URL}/v1/orchestrate/threads/{thread_id}/messages  → last assistant message
 *
 * Environment variables required (live mode):
 *   WXO_API_KEY          – IBM Cloud API key (never logged)
 *   WXO_INSTANCE_URL     – e.g. https://<instance>.assistant.watson.cloud.ibm.com
 *   WXO_REVIEW_AGENT_ID  – agent UUID from Orchestrate (not the name)
 *
 * Optional:
 *   DEBUG_WXO=true       – log the raw runs/messages response once per call
 */

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry
const REQUEST_TIMEOUT_MS = 60_000;
const RUN_POLL_INTERVAL_MS = 2_000;
const RUN_MAX_WAIT_MS = 55_000; // leave 5 s headroom inside the 60 s timeout

// In-memory IAM token cache (process-scoped, no persistence needed)
let _iamCache = null; // { accessToken, expiresAt }

/**
 * Fetch (or return cached) IBM Cloud IAM access token.
 * Never logs the API key or raw token.
 */
async function getIamToken() {
    const now = Date.now();
    if (_iamCache && now < _iamCache.expiresAt - REFRESH_BEFORE_EXPIRY_MS) {
        return _iamCache.accessToken;
    }

    const apiKey = process.env.WXO_API_KEY;
    if (!apiKey) throw new Error('WXO_API_KEY is not set');

    const body = new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: apiKey,
    });

    const res = await fetchWithTimeout(IAM_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!res.ok) {
        throw new Error(`IAM token request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    _iamCache = {
        accessToken: data.access_token,
        expiresAt: now + (data.expires_in ?? 3600) * 1000,
    };
    return _iamCache.accessToken;
}

/**
 * fetch() wrapper with a configurable timeout using AbortController.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Build a base URL and auth headers for Orchestrate API calls.
 */
async function orchestrateRequest(path, options = {}) {
    const instanceUrl = process.env.WXO_INSTANCE_URL?.replace(/\/$/, '');
    if (!instanceUrl) throw new Error('WXO_INSTANCE_URL is not set');

    const token = await getIamToken();
    const url = `${instanceUrl}/v1/orchestrate${path}`;

    const res = await fetchWithTimeout(url, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        ...options,
    });

    if (!res.ok) {
        throw new Error(`Orchestrate ${options.method || 'GET'} ${path} failed: ${res.status} ${res.statusText}`);
    }

    return res.json();
}

/**
 * Extract the first JSON object from an arbitrary string.
 * Returns the parsed object, or null if none found.
 */
function extractJson(text) {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    for (let i = start; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) {
                try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; }
            }
        }
    }
    return null;
}

/**
 * Validate the extracted object against the review contract.
 */
function validateReview(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (typeof obj.summary !== 'string' || !obj.summary.trim()) return false;
    if (!Array.isArray(obj.vendors) || obj.vendors.length === 0) return false;
    return obj.vendors.every(
        (v) =>
            typeof v.vendor === 'string' &&
            typeof v.unitPrice === 'number' &&
            Array.isArray(v.flags),
    );
}

/**
 * Extract the last assistant message text from a threads/messages response.
 */
function extractAssistantText(messagesData) {
    const messages = Array.isArray(messagesData)
        ? messagesData
        : messagesData?.data ?? [];

    // Walk in reverse to find the last assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg?.role !== 'assistant') continue;

        const content = msg.content;
        if (typeof content === 'string') return content;

        // Content can also be an array of content blocks
        if (Array.isArray(content)) {
            const parts = content
                .map((c) => (typeof c === 'string' ? c : c?.text ?? ''))
                .filter(Boolean);
            if (parts.length) return parts.join('\n');
        }
    }
    return null;
}

/**
 * Make a single attempt to call the Orchestrate agent.
 * Returns a validated review object on success; throws on any error.
 */
async function callOrchestrate(scenarioId) {
    const agentId = process.env.WXO_REVIEW_AGENT_ID;
    if (!agentId) throw new Error('WXO_REVIEW_AGENT_ID is not set');

    // Step 1: create a run
    const runResponse = await orchestrateRequest('/runs', {
        method: 'POST',
        body: JSON.stringify({
            message: { role: 'user', content: `Review scenario ${scenarioId}` },
            agent_id: agentId,
        }),
    });

    if (process.env.DEBUG_WXO === 'true') {
        console.log('[DEBUG_WXO] create run response:', JSON.stringify(runResponse));
    }

    const runId = runResponse?.run_id;
    const threadId = runResponse?.thread_id;
    if (!runId) throw new Error('Orchestrate /runs response missing run_id');

    // Step 2: poll for completion
    const deadline = Date.now() + RUN_MAX_WAIT_MS;
    let finalStatus = null;

    while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, RUN_POLL_INTERVAL_MS));
        const status = await orchestrateRequest(`/runs/${runId}`);

        if (process.env.DEBUG_WXO === 'true') {
            console.log('[DEBUG_WXO] run status:', JSON.stringify(status));
        }

        const state = status?.status?.toLowerCase();
        if (state === 'completed') { finalStatus = status; break; }
        if (state === 'failed' || state === 'cancelled') {
            throw new Error(`Run ${runId} ended with status: ${state}`);
        }
    }

    if (!finalStatus) throw new Error(`Run ${runId} did not complete within ${RUN_MAX_WAIT_MS / 1000}s`);

    // Step 3: fetch thread messages to get the assistant reply
    const resolvedThreadId = threadId ?? finalStatus?.thread_id;
    if (!resolvedThreadId) throw new Error('No thread_id available to fetch messages');

    const messagesData = await orchestrateRequest(`/threads/${resolvedThreadId}/messages`);

    if (process.env.DEBUG_WXO === 'true') {
        console.log('[DEBUG_WXO] thread messages:', JSON.stringify(messagesData));
    }

    const text = extractAssistantText(messagesData);
    if (!text) throw new Error('No assistant message found in thread');

    const obj = extractJson(text);
    if (!validateReview(obj)) {
        throw new Error(
            `Response did not pass contract validation. Preview: ${text?.slice(0, 200)}`,
        );
    }

    return obj;
}

/**
 * Call the Orchestrate review agent for a given scenario ID.
 * Retries once on failure, then returns null so the caller can fall back.
 *
 * @param {string} scenarioId
 * @returns {Promise<object|null>} Validated review object, or null on failure.
 */
export async function fetchAgentReview(scenarioId) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            return await callOrchestrate(scenarioId);
        } catch (err) {
            console.warn(`[orchestrate] attempt ${attempt} failed: ${err.message}`, { scenarioId });
        }
    }
    return null;
}
