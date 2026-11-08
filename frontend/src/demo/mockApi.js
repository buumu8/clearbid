import { SEED_PURCHASES } from './seed.js';
import { buildMockReview } from './mockReview.js';

const KEY = 'clearbid-demo-state';
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY));
        if (saved?.purchases) return saved;
    } catch { /* ignore corrupt storage */ }
    return { purchases: structuredClone(SEED_PURCHASES), audit: [] };
}
const state = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

function find(id) {
    const p = state.purchases.find((x) => x.id === id);
    if (!p) throw new Error('Not found');
    return p;
}
function log(purchaseId, actor, action, details = {}) {
    state.audit.push({ at: new Date().toISOString(), purchaseId, actor, action, details });
    save();
}
function move(p, status, actor) {
    p.status = status;
    log(p.id, actor, `status:${status}`);
}

function toPublic(p) {
    const winner = p.review?.vendors.find((v) => v.vendor === p.awardedVendor);
    return {
        id: p.id, title: p.title, category: p.category, quantity: p.quantity,
        awardedVendor: p.awardedVendor, aiRecommendation: p.aiRecommendation ?? '',
        awardRemark: p.awardRemark ?? '', publicSummary: p.publicSummary, publishedAt: p.publishedAt,
        unitPrice: winner?.unitPrice ?? null,
        totalAmount: winner ? winner.unitPrice * p.quantity : null,
        awardedVendorRating: winner?.reviews?.rating ?? null,
        quotesCompared: p.review?.vendors.length ?? 0,
        risksFlagged: p.review?.vendors.reduce((n, v) => n + v.flags.filter((f) => f.type !== 'compliance').length, 0) ?? 0,
    };
}

export const mockApi = {
    async health() { await wait(); return { ok: true, mock: 'demo' }; },

    async createPurchase({ title, category, quantity, quotes = [], scenarioId }) {
        await wait();
        const p = {
            id: `PR-${Date.now()}`, status: 'draft', title, category, quantity: Number(quantity),
            quotes: quotes.map((q) => (typeof q === 'string' ? q : q.name)), scenarioId, decisions: [],
        };
        state.purchases.push(p);
        log(p.id, 'officer', 'created');
        return structuredClone(p);
    },

    async getPurchase(id) { await wait(); return structuredClone(find(id)); },

    async startReview(id) {
        await wait();
        const p = find(id);
        move(p, 'analyzing', 'system');
        setTimeout(() => { p.review = buildMockReview(p); move(p, 'analyzed', 'agent'); }, 2000);
        return { status: p.status };
    },

    async submitDecisions(id, decisions = []) {
        await wait();
        if (decisions.some((d) => d.action === 'override' && !d.reason?.trim())) throw new Error('Override requires a reason');
        const p = find(id);
        p.decisions = decisions;
        move(p, 'reviewed', 'officer');
        return structuredClone(p);
    },

    async award(id, vendor, awardRemark = '', aiRecommendation = '') {
        await wait();
        const p = find(id);
        Object.assign(p, { awardedVendor: vendor, awardRemark, aiRecommendation });
        move(p, 'awarded', 'officer');
        return structuredClone(p);
    },

    async publish(id, publicSummary) {
        await wait();
        const p = find(id);
        Object.assign(p, { publicSummary, publishedAt: new Date().toISOString() });
        move(p, 'published', 'officer');
        return structuredClone(p);
    },

    async publicPurchases() {
        await wait();
        return state.purchases
            .filter((p) => p.status === 'published')
            .map(toPublic)
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    },

    async audit() { await wait(); return structuredClone(state.audit); },

    resetDemo() { localStorage.removeItem(KEY); window.location.reload(); },
};