import { mockApi } from './demo/mockApi.js';

const BASE = import.meta.env.VITE_API_URL || ''; // empty locally (uses the proxy)

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
}

export const realApi = {
    health: () => request('/api/health'),
    createPurchase: (body) => request('/api/purchases', { method: 'POST', body: JSON.stringify(body) }),
    getPurchase: (id) => request(`/api/purchases/${id}`),
    startReview: (id) => request(`/api/purchases/${id}/review`, { method: 'POST' }),
    submitDecisions: (id, decisions) =>
        request(`/api/purchases/${id}/decisions`, { method: 'POST', body: JSON.stringify({ decisions }) }),
    award: (id, vendor, awardRemark = '', aiRecommendation = '') =>
        request(`/api/purchases/${id}/award`, { method: 'POST', body: JSON.stringify({ vendor, awardRemark, aiRecommendation }) }),
    publish: (id, publicSummary) =>
        request(`/api/purchases/${id}/publish`, { method: 'POST', body: JSON.stringify({ publicSummary }) }),
    publicPurchases: () => request('/api/public/purchases'),
    publicPurchaseHistory: (id) => request(`/api/public/purchases/${id}/history`),
    quoteChecks: (id) => request(`/api/purchases/${id}/quote-checks`),
    /** Upload a single PDF file for a purchase. Returns check results. */
    uploadQuote(purchaseId, file) {
        const form = new FormData();
        form.append('file', file);
        return fetch(`${BASE}/api/purchases/${purchaseId}/upload-quote`, { method: 'POST', body: form })
            .then(async (res) => {
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || res.statusText);
                return json;
            });
    },
    assistant: (intent, context = {}) =>
        request('/api/assistant', { method: 'POST', body: JSON.stringify({ intent, ...context }) }),
    publicAssistant: (purchaseId, question) =>
        request('/api/public-assistant', {
            method: 'POST',
            body: JSON.stringify({ purchaseId, question }),
        }),



};

export const IS_DEMO = import.meta.env.MODE === 'demo';
export const api = IS_DEMO ? mockApi : realApi;

// Poll until the agent review finishes
export async function waitForReview(id, { interval = 2000, timeout = 90000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const p = await api.getPurchase(id);
        if (p.review) return p;
        await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error('Review timed out - try again or review manually');
}