/**
 * orchestrate.js
 *
 * Calls the watsonx Orchestrate review agent via the chat completions API.
 *
 * Environment variables required (live mode):
 *   WXO_API_KEY          – IBM Cloud API key (never logged)
 *   WXO_INSTANCE_URL     – e.g. https://<instance>.assistant.watson.cloud.ibm.com
 *   WXO_REVIEW_AGENT_ID  – agent ID from Orchestrate
 *
 * Optional:
 *   DEBUG_WXO=true       – log the raw Orchestrate response once per call
 */

const IAM_TOKEN_URL = 'https://iam.cloud.ibm.com/identity/token';
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT_MS = 60_000;

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
        const text = await res.text().catch(() => '');
        throw new Error(`IAM token request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    // IBM IAM returns expires_in in seconds
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
 * Extract the first JSON object from an arbitrary string.
 * Returns the parsed object, or null if none found.
 */
function extractJson(text) {
    const start = text.indexOf('{');
    if (start === -1) return null;
    // Walk forward tracking brace depth to find the matching closing brace
    let depth = 0;
    for (let i = start; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(text.slice(start, i + 1));
                } catch {
                    return null;
                }
            }
        }
    }
    return null;
}

/**
 * Validate the extracted object against the review contract.
 * Returns true only if summary is a non-empty string and vendors is an array
 * where each element has vendor (string), unitPrice (number), and flags (array).
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
 * Make a single attempt to call the Orchestrate agent.
 * Returns the raw assistant text on HTTP 200; throws on any error.
 */
async function callOrchestrate(scenarioId) {
    const instanceUrl = process.env.WXO_INSTANCE_URL;
    const agentId = process.env.WXO_REVIEW_AGENT_ID;
    if (!instanceUrl) throw new Error('WXO_INSTANCE_URL is not set');
    if (!agentId) throw new Error('WXO_REVIEW_AGENT_ID is not set');

    const token = await getIamToken();
    const url = `${instanceUrl}/v1/orchestrate/${agentId}/chat/completions`;

    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            stream: false,
            messages: [{ role: 'user', content: `Review scenario ${scenarioId}` }],
        }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Orchestrate request failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();

    if (process.env.DEBUG_WXO === 'true') {
        console.log('[DEBUG_WXO] raw response:', JSON.stringify(data));
    }

    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
        throw new Error('Orchestrate response missing choices[0].message.content');
    }
    return text;
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
            const text = await callOrchestrate(scenarioId);
            const obj = extractJson(text);
            if (validateReview(obj)) {
                return obj;
            }
            console.warn(
                `[orchestrate] attempt ${attempt}: response did not pass contract validation`,
                { scenarioId, preview: text?.slice(0, 200) },
            );
        } catch (err) {
            console.warn(`[orchestrate] attempt ${attempt} failed: ${err.message}`, { scenarioId });
        }
    }
    return null;
}
