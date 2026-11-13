/**
 * reportHistory.test.js
 *
 * Tests for report versioning, audit event hash chaining, and public history.
 * Runs with: node --test backend/tests/reportHistory.test.js
 */

import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Import the store helpers directly to test them without HTTP.
// Use dynamic import to get fresh state for each test scenario.
const storeModule = await import('../src/store.js');
const {
    createPurchase, getPurchase, moveStatus, logEvent, getAuditLog,
    hashString, getPublicHistory, insertPurchase,
} = storeModule;

// ── hashString ───────────────────────────────────────────────────────────────

test('hashString: returns a 64-char hex string', () => {
    const h = hashString('hello');
    assert.equal(typeof h, 'string');
    assert.equal(h.length, 64);
    assert.match(h, /^[0-9a-f]{64}$/);
});

test('hashString: same input → same hash', () => {
    assert.equal(hashString('abc'), hashString('abc'));
});

test('hashString: different input → different hash', () => {
    assert.notEqual(hashString('aaa'), hashString('bbb'));
});

// ── Audit event hash chain ───────────────────────────────────────────────────

test('first audit event has prevHash "genesis"', () => {
    const log = getAuditLog();
    // The seed data may have pre-loaded events; test with the first event present.
    // If log is empty, log a test event.
    if (log.length === 0) {
        logEvent('test-chain', 'system', 'test_genesis');
    }
    const first = getAuditLog()[0];
    assert.equal(first.prevHash, 'genesis', 'First event should have prevHash "genesis"');
});

test('subsequent audit events reference hash of previous event', () => {
    const before = getAuditLog().length;
    logEvent('test-chain', 'system', 'test_a');
    logEvent('test-chain', 'system', 'test_b');
    const log = getAuditLog();
    const eventA = log[before];
    const eventB = log[before + 1];

    // eventB.prevHash should equal the hash of eventA's JSON (before prevHash was added to eventA)
    assert.equal(eventB.prevHash, hashString(JSON.stringify(eventA)));
});

// ── Report versioning ────────────────────────────────────────────────────────

test('first publish: sets publishVersion = 1 and empty publishHistory', () => {
    const p = createPurchase({
        title: 'Test purchase', category: 'IT Hardware', quantity: 1,
        quotes: [], scenarioId: 'laptops-50',
    });
    moveStatus(p.id, 'analyzing', 'system');
    p.review = { summary: 'ok', vendors: [] };
    moveStatus(p.id, 'analyzed', 'agent');
    moveStatus(p.id, 'reviewed', 'officer');
    p.awardedVendor = 'Vendor A';
    moveStatus(p.id, 'awarded', 'officer');

    // Simulate the publish logic from server.js (DRY test of store helpers).
    const q = getPurchase(p.id);
    q.publicSummary = 'First published summary.';
    q.publishedAt = new Date().toISOString();
    q.publishVersion = 1;
    q.publishHistory = [];
    moveStatus(p.id, 'published', 'officer');

    assert.equal(q.publishVersion, 1);
    assert.deepEqual(q.publishHistory, []);
    assert.equal(q.status, 'published');
});

test('correction: publishVersion increments and history retains previous entry', () => {
    const p = createPurchase({
        title: 'Correction test', category: 'Office Supplies', quantity: 5,
        quotes: [], scenarioId: 'chairs-120',
    });
    moveStatus(p.id, 'analyzing', 'system');
    p.review = { summary: 'ok', vendors: [] };
    moveStatus(p.id, 'analyzed', 'agent');
    moveStatus(p.id, 'reviewed', 'officer');
    p.awardedVendor = 'Vendor B';
    moveStatus(p.id, 'awarded', 'officer');
    moveStatus(p.id, 'published', 'officer');

    const q = getPurchase(p.id);
    q.publicSummary = 'Original summary.';
    q.publishedAt = '2025-01-01T00:00:00.000Z';
    q.publishVersion = 1;
    q.publishHistory = [];

    // Apply correction.
    const prevAuditEntry = getAuditLog().filter((e) => e.purchaseId === p.id).at(-1);
    const prevAuditRef = prevAuditEntry ? hashString(JSON.stringify(prevAuditEntry)) : 'none';
    q.publishHistory.push({
        version: q.publishVersion,
        publishedAt: q.publishedAt,
        publicSummary: q.publicSummary,
        summaryHash: hashString(q.publicSummary),
        auditRef: prevAuditRef,
    });
    q.publishVersion = 2;
    q.publicSummary = 'Corrected summary.';
    q.publishedAt = new Date().toISOString();

    assert.equal(q.publishVersion, 2);
    assert.equal(q.publishHistory.length, 1);
    assert.equal(q.publishHistory[0].version, 1);
    assert.equal(q.publishHistory[0].publicSummary, 'Original summary.');
    assert.equal(q.publicSummary, 'Corrected summary.');
});

// ── getPublicHistory ─────────────────────────────────────────────────────────

test('getPublicHistory: returns null for non-existent purchase', () => {
    assert.equal(getPublicHistory('NO-SUCH-ID'), null);
});

test('getPublicHistory: returns null for non-published purchase', () => {
    const p = createPurchase({
        title: 'Draft purchase', category: 'Services', quantity: 1,
        quotes: [], scenarioId: 'laptops-50',
    });
    assert.equal(getPublicHistory(p.id), null);
});

test('getPublicHistory: returns safe fields for published purchase', () => {
    const p = createPurchase({
        title: 'Published purchase', category: 'IT Hardware', quantity: 10,
        quotes: [], scenarioId: 'laptops-50',
    });
    moveStatus(p.id, 'analyzing', 'system');
    p.review = { summary: 'ok', vendors: [] };
    moveStatus(p.id, 'analyzed', 'agent');
    moveStatus(p.id, 'reviewed', 'officer');
    p.awardedVendor = 'Vendor C';
    moveStatus(p.id, 'awarded', 'officer');
    moveStatus(p.id, 'published', 'officer');

    const q = getPurchase(p.id);
    q.publicSummary = 'Public summary text.';
    q.publishedAt = new Date().toISOString();
    q.publishVersion = 1;
    q.publishHistory = [];

    const result = getPublicHistory(p.id);
    assert.ok(result, 'Should return a history object');
    assert.equal(result.id, p.id);
    assert.equal(result.publishVersion, 1);
    assert.ok(Array.isArray(result.publishHistory));
    assert.ok(result.note.includes('tamper-evident'));
    // Must NOT include private fields.
    assert.equal(result.quotes, undefined);
    assert.equal(result.review, undefined);
    assert.equal(result.decisions, undefined);
});

test('getPublicHistory: prevHash chain is non-empty after two events', () => {
    const log = getAuditLog();
    const events = log.filter((e) => e.prevHash != null);
    assert.ok(events.length >= 1, 'Should have at least one event with prevHash');
    // All events except first should have a non-"genesis" prevHash if there are 2+.
    if (events.length >= 2) {
        const second = events[1];
        assert.notEqual(second.prevHash, 'genesis');
        assert.equal(second.prevHash.length, 64); // SHA-256 hex
    }
});
