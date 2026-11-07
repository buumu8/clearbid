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

export function logEvent(purchaseId, actor, action, details = {}) {
    auditLog.push({ at: new Date().toISOString(), purchaseId, actor, action, details });
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
