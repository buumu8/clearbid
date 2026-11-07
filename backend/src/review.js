import { fetchAgentReview } from './orchestrate.js';

const MOCK_REVIEW = {
    summary: 'High risk: 1 overpriced quote, 2 possibly colluding vendors.',
    vendors: [
        {
            vendor: 'Vendor A', unitPrice: 3900, flags: [
                { type: 'price', level: 'high', evidence: '3.2x market average ($1,200); past award $1,150' }]
        },
        {
            vendor: 'Vendor B', unitPrice: 1150, flags: [
                { type: 'collusion', level: 'high', evidence: 'Shares bank routing number and address with Vendor C' }]
        },
        {
            vendor: 'Vendor C', unitPrice: 1180, flags: [
                { type: 'collusion', level: 'high', evidence: 'Shares bank routing number and address with Vendor B' },
                { type: 'vendor', level: 'high', evidence: 'Possible match on SAM.gov exclusions list - verify' }]
        },
    ],
};

/** Map a purchase to the scenario ID the agent understands. */
function resolveScenarioId(purchase) {
    return purchase.scenarioId ?? 'laptops-50';
}

export async function runReview(purchase) {
    if (process.env.USE_MOCK_AGENTS === 'true') {
        await new Promise((r) => setTimeout(r, 1500)); // simulate agent time
        return { ...MOCK_REVIEW, source: 'mock' };
    }

    const scenarioId = resolveScenarioId(purchase);
    const result = await fetchAgentReview(scenarioId);

    if (result) {
        return { ...result, source: 'agent' };
    }

    // Both attempts failed — fall back to mock so the UI is never left hanging
    console.warn(`[review] agent unavailable for scenario '${scenarioId}', using fallback`);
    return { ...MOCK_REVIEW, source: 'fallback' };
}

// The same checks Orchestrate's tool will call. Pure code, no AI credits used.
export function runQuoteChecks(purchaseId) {
    return MOCK_REVIEW; // replace with real checks in Phase 2
}