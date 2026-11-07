const BASE = import.meta.env.VITE_API_URL || ''; // empty locally (uses the proxy)

async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    return res.json();
}

export const api = {
    health: () => request('/api/health'),
    createPurchase: (body) => request('/api/purchases', { method: 'POST', body: JSON.stringify(body) }),
    getPurchase: (id) => request(`/api/purchases/${id}`),
    startReview: (id) => request(`/api/purchases/${id}/review`, { method: 'POST' }),
    submitDecisions: (id, decisions) =>
        request(`/api/purchases/${id}/decisions`, { method: 'POST', body: JSON.stringify({ decisions }) }),
    award: (id, vendor) => request(`/api/purchases/${id}/award`, { method: 'POST', body: JSON.stringify({ vendor }) }),
    publish: (id, publicSummary) =>
        request(`/api/purchases/${id}/publish`, { method: 'POST', body: JSON.stringify({ publicSummary }) }),
    publicPurchases: () => request('/api/public/purchases'),
};

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