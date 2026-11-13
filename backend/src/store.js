import { createHash } from 'node:crypto';

const purchases = new Map();
const auditLog = [];

// Only these status changes are allowed. Agents can only produce "analyzed".
const TRANSITIONS = {
    draft: ['analyzing'],
    analyzing: ['analyzed'],
    analyzed: ['reviewed'],    // human: accept/override flags
    reviewed: ['awarded'],     // human: award
    awarded: ['published'],    // human: approve publication
};

/** SHA-256 hex of an arbitrary string — used for the tamper-evident event chain. */
export function hashString(str) {
    return createHash('sha256').update(str).digest('hex');
}

export function logEvent(purchaseId, actor, action, details = {}) {
    const prevHash = auditLog.length === 0
        ? 'genesis'
        : hashString(JSON.stringify(auditLog[auditLog.length - 1]));
    auditLog.push({ at: new Date().toISOString(), purchaseId, actor, action, details, prevHash });
}

export function createPurchase(data) {
    const id = `PR-${Date.now()}`;
    const purchase = { id, status: 'draft', quotes: [], review: null, decisions: [], ...data };
    purchases.set(id, purchase);
    logEvent(id, 'officer', 'created');
    return purchase;
}

export function getPurchase(id) {
    return purchases.get(id);
}

export function listPurchases(filter = () => true) {
    return [...purchases.values()].filter(filter);
}

export function moveStatus(id, next, actor) {
    const p = purchases.get(id);
    if (!p) throw Object.assign(new Error('Not found'), { status: 404 });
    if (!TRANSITIONS[p.status]?.includes(next)) {
        throw Object.assign(new Error(`Cannot move from ${p.status} to ${next}`), { status: 409 });
    }
    p.status = next;
    logEvent(id, actor, `status:${next}`);
    return p;
}

export function getAuditLog() {
    return [...auditLog];
}

export function insertPurchase(p) {
    purchases.set(p.id, p);
}

/**
 * Returns public-safe publish history for a purchase.
 * Omits private quote documents and personal information.
 */
export function getPublicHistory(id) {
    const p = purchases.get(id);
    if (!p || p.status !== 'published') return null;
    const history = (p.publishHistory || []).map((h) => ({
        version: h.version,
        publishedAt: h.publishedAt,
        publicSummary: h.publicSummary,
        auditRef: h.auditRef,
    }));
    return {
        id: p.id,
        publishVersion: p.publishVersion ?? 1,
        publishedAt: p.publishedAt,
        publicSummary: p.publicSummary,
        publishHistory: history,
        note: 'This record is tamper-evident but not immutable — an administrator with server access can modify the underlying store. History resets on server restart.',
    };
}
