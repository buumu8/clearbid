/**
 * Simulated agent review results for the static GitHub Pages demo.
 * Same shape as the backend's runReview() output.
 */
const SCENARIOS = {
    'laptops-50': [
        {
            vendor: 'Northline Tech', unitPrice: 1180, flags: [],
            reviews: { rating: 4.6, count: 212, snippets: ['Excellent build quality and battery life', 'Easy fleet setup for IT admins'] },
        },
        {
            vendor: 'Apex Digital', unitPrice: 3950,
            flags: [
                { type: 'price', level: 'high', evidence: 'Unit price is 3.3x the median of 14 recent USAspending.gov awards ($1,190).' },
                { type: 'collusion', level: 'high', evidence: 'Shares a registered address and phone number with Prime Systems LLC.' },
            ],
            reviews: { rating: 2.3, count: 58, snippets: ['Screen hinges broke within 3 months', 'Support never responded'] },
        },
        {
            vendor: 'Prime Systems LLC', unitPrice: 1260,
            flags: [
                { type: 'collusion', level: 'high', evidence: 'Shares a registered address and phone number with Apex Digital.' },
            ],
            reviews: { rating: 3.8, count: 97, snippets: ['Decent value', 'Delivery was two weeks late'] },
        },
    ],
    'chairs-120': [
        {
            vendor: 'Summit Office Co.', unitPrice: 310, flags: [],
            reviews: { rating: 4.4, count: 340, snippets: ['Comfortable for long shifts'] },
        },
        {
            vendor: 'BudgetSeat', unitPrice: 240,
            flags: [
                { type: 'price', level: 'medium', evidence: 'Unit price is 23% below the market median, which may mean lower build quality.' },
            ],
            reviews: { rating: 2.6, count: 188, snippets: ['Gas lift failed after 2 months'] },
        },
        {
            vendor: 'ErgoWorks', unitPrice: 365, flags: [],
            reviews: { rating: 4.5, count: 121, snippets: ['Great lumbar support'] },
        },
    ],
    'toner-400': [
        {
            vendor: 'Metro Supply', unitPrice: 62, flags: [],
            reviews: { rating: 4.1, count: 402, snippets: ['Reliable, no leaks'] },
        },
        {
            vendor: 'InkDirect', unitPrice: 87,
            flags: [
                { type: 'price', level: 'medium', evidence: 'Unit price is 40% above the market median ($62).' },
            ],
            reviews: { rating: 3.9, count: 76, snippets: ['Fine quality, pricey'] },
        },
        {
            vendor: 'CheapToner', unitPrice: 41,
            flags: [
                { type: 'exclusion', level: 'high', evidence: 'Vendor appears on the SAM.gov exclusions list.' },
            ],
            reviews: { rating: 1.9, count: 233, snippets: ['Leaked inside the printer'] },
        },
    ],
};

const DEFAULT_SCENARIO = 'laptops-50';

export function buildMockReview(purchase) {
    const key = SCENARIOS[purchase.scenarioId] ? purchase.scenarioId : DEFAULT_SCENARIO;
    const vendors = structuredClone(SCENARIOS[key]);
    const quantity = Number(purchase.quantity) || 1;

    return {
        summary: `Reviewed ${vendors.length} quotes against past government prices, vendor records and user reviews.`,
        vendors,
        requires_supervisor_approval: vendors.some((v) => v.unitPrice * quantity > 50000),
    };
}