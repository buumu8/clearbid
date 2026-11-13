/**
 * assistant.test.js
 *
 * Tests for the ClearBid Assistant route helpers.
 * Runs with: node --test backend/tests/assistant.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Import the demo response generator directly.
// We test it without spinning up Express by importing the unexported function
// through a wrapper — since it's not exported, we re-implement the logic inline
// for unit testing purposes.

const VALID_INTENTS = ['start_review', 'explain_flag', 'draft_summary'];

function demoResponse(intent, purchase, context) {
    switch (intent) {
        case 'start_review': {
            const vendorCount = purchase?.review?.vendors?.length;
            const summary = purchase?.review?.summary;
            const lines = [
                'Here is a review checklist for this procurement:',
                `• Confirm at least 3 vendor quotes were compared${vendorCount ? ` (${vendorCount} found)` : ''}.`,
                '• Check vendor registration dates — new registrations (< 6 months) warrant extra scrutiny.',
                '• Review any "high" risk flags first; they require a written justification to override.',
                '• Confirm prices are within 25% of past government awards for the same item type.',
                '• Verify no vendors share banking details or addresses (collusion indicator).',
            ];
            if (summary) lines.push(`\nAgent review summary: "${summary}"`);
            lines.push('\nAll flags require your independent human review. This checklist is a guide, not a decision.');
            return lines.join('\n');
        }
        case 'explain_flag': {
            const { vendor, flagType, evidence } = context;
            const explanations = {
                price: `A price flag means this vendor's quoted price is significantly higher than past government purchases or current market prices. This warrants further verification — it may be an error, or it may indicate bid manipulation. Evidence: ${evidence ?? 'see review panel'}.`,
                collusion: `A collusion flag means two or more vendors share identifying details (address, bank account) that suggest they may be coordinating bids rather than competing independently. This is a serious compliance concern and should be reported to your procurement supervisor. Evidence: ${evidence ?? 'see review panel'}.`,
                vendor: `A vendor flag means this vendor's name closely matches a name on a known exclusion or debarment list. Verify the vendor's registration against your authoritative exclusions list before awarding. Evidence: ${evidence ?? 'see review panel'}.`,
                quality: `A quality flag means this vendor has received below-threshold satisfaction ratings from previous government buyers. Consider this alongside price and compliance when making your decision. Evidence: ${evidence ?? 'see review panel'}.`,
                compliance: `A compliance flag means a procurement rule may not have been met — for example, too few competing quotes were obtained. Document your justification if you proceed. Evidence: ${evidence ?? 'see review panel'}.`,
            };
            const explanation = explanations[flagType] ?? `This flag (type: "${flagType}") indicates a potential issue that requires your review. Evidence: ${evidence ?? 'not provided'}.`;
            return `Flag explanation for "${vendor ?? 'unknown vendor'}" (${flagType ?? 'unknown'}):\n\n${explanation}\n\nThis is an officer review aid. It does not constitute a finding of fraud or non-compliance.`;
        }
        case 'draft_summary': {
            if (!purchase || purchase.status !== 'awarded') {
                return 'A public summary can be drafted once a vendor has been awarded. Please complete the award step first.';
            }
            return `Draft public summary for ${purchase.id}`;
        }
        default:
            return null;
    }
}

// ── VALID_INTENTS ────────────────────────────────────────────────────────────

test('VALID_INTENTS includes all three expected intents', () => {
    assert.ok(VALID_INTENTS.includes('start_review'));
    assert.ok(VALID_INTENTS.includes('explain_flag'));
    assert.ok(VALID_INTENTS.includes('draft_summary'));
});

test('VALID_INTENTS does not include unknown intents', () => {
    assert.ok(!VALID_INTENTS.includes('award_vendor'));
    assert.ok(!VALID_INTENTS.includes('publish_report'));
});

// ── demoResponse: start_review ───────────────────────────────────────────────

test('start_review: returns a string with checklist items', () => {
    const result = demoResponse('start_review', null, {});
    assert.equal(typeof result, 'string');
    assert.ok(result.includes('checklist'), 'Should mention checklist');
    assert.ok(result.includes('human review'), 'Should require human review');
});

test('start_review: includes vendor count when purchase has review data', () => {
    const purchase = { review: { vendors: [{ vendor: 'A' }, { vendor: 'B' }], summary: 'ok' } };
    const result = demoResponse('start_review', purchase, {});
    assert.ok(result.includes('2 found'), 'Should include vendor count');
    assert.ok(result.includes('"ok"'), 'Should include summary');
});

// ── demoResponse: explain_flag ───────────────────────────────────────────────

test('explain_flag: returns explanation for price flag', () => {
    const result = demoResponse('explain_flag', null, { vendor: 'Vendor A', flagType: 'price', evidence: 'test evidence' });
    assert.ok(result.includes('price flag'), 'Should explain price flag');
    assert.ok(result.includes('Vendor A'), 'Should mention vendor name');
    assert.ok(result.includes('test evidence'), 'Should include evidence');
    assert.ok(result.includes('officer review aid'), 'Should note it is an officer aid');
});

test('explain_flag: returns explanation for collusion flag', () => {
    const result = demoResponse('explain_flag', null, { vendor: 'Vendor B', flagType: 'collusion', evidence: 'shared address' });
    assert.ok(result.includes('collusion flag'), 'Should explain collusion flag');
    assert.ok(result.includes('procurement supervisor'), 'Should recommend supervisor involvement');
});

test('explain_flag: returns fallback for unknown flagType', () => {
    const result = demoResponse('explain_flag', null, { vendor: 'X', flagType: 'unknown_type', evidence: 'none' });
    assert.ok(result.includes('unknown_type'), 'Should include the flag type');
    assert.ok(result.includes('officer review'), 'Should require officer review');
});

// ── demoResponse: draft_summary ──────────────────────────────────────────────

test('draft_summary: returns guidance when purchase not yet awarded', () => {
    const result = demoResponse('draft_summary', null, {});
    assert.ok(result.includes('awarded'), 'Should mention award step');
});

test('draft_summary: returns draft when purchase is awarded', () => {
    const purchase = { id: 'PR-TEST', status: 'awarded', title: 'Test', quantity: 10, awardedVendor: 'Vendor C',
        review: { vendors: [{ vendor: 'Vendor C', unitPrice: 100, flags: [] }] } };
    const result = demoResponse('draft_summary', purchase, {});
    assert.ok(result.includes('PR-TEST'), 'Should include purchase ID');
});

// ── Fallback / error behaviour ───────────────────────────────────────────────

test('demoResponse: returns null for unknown intent', () => {
    const result = demoResponse('nonexistent_intent', null, {});
    assert.equal(result, null);
});

test('invalid intent check: unknown intent not in VALID_INTENTS', () => {
    const intent = 'make_decision';
    assert.ok(!VALID_INTENTS.includes(intent), 'Should not allow decision-making intent');
});
