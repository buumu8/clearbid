import { insertPurchase } from './store.js';

const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();

const SEED = [
    {
        title: 'Laptops for Public Works staff', category: 'IT Hardware', quantity: 50,
        vendor: 'Northline Tech', unitPrice: 1180, quotes: 3, flags: 2, days: 1,
        summary: 'The city bought 50 laptops for Public Works staff. Three quotes were compared. One was more than 3 times the usual government price, and two vendors appeared to be linked, so both were flagged. The officer chose the fairly priced vendor with no issues.'
    },
    {
        title: 'Ergonomic office chairs for City Hall', category: 'Office Supplies', quantity: 120,
        vendor: 'Summit Office Co.', unitPrice: 310, quotes: 3, flags: 0, days: 4,
        summary: 'The city replaced 120 worn-out office chairs at City Hall. All three quotes were in line with past government prices, and no vendor risks were found.'
    },
    {
        title: 'Park landscaping services (12 months)', category: 'Services', quantity: 12,
        vendor: 'GreenWay Grounds', unitPrice: 4500, quotes: 4, flags: 1, days: 9,
        summary: 'The city hired a landscaping company to maintain 6 public parks for one year. One bidder had been registered for only three weeks and was flagged for review. The officer chose an established vendor at a fair monthly price.'
    },
    {
        title: 'Printer toner cartridges', category: 'Office Supplies', quantity: 400,
        vendor: 'Metro Supply', unitPrice: 62, quotes: 3, flags: 1, days: 16,
        summary: 'The city bought a year of printer toner for all departments. One quote was 40% above the market price and was flagged. The awarded price matches recent government purchases.'
    },
    {
        title: 'Network switches for the public library', category: 'IT Hardware', quantity: 20,
        vendor: 'Bayview Networks', unitPrice: 2350, quotes: 3, flags: 0, days: 23,
        summary: 'The city upgraded the public library network so it can offer faster Wi-Fi. Three quotes were compared, and the chosen vendor had the lowest fair price with no risks found.'
    },
];

export function seedDemoData() {
    SEED.forEach((s, i) => {
        const vendors = Array.from({ length: s.quotes }, (_, k) => ({
            vendor: k === 0 ? s.vendor : `Bidder ${k}`,
            unitPrice: k === 0 ? s.unitPrice : Math.round(s.unitPrice * (1.1 + k * 0.15)),
            flags: [],
        }));
        for (let f = 0; f < s.flags; f++) {
            vendors[1 + (f % (s.quotes - 1))].flags.push({ type: `flag${f}`, level: 'high', evidence: 'Demo data' });
        }
        insertPurchase({
            id: `PR-DEMO-${i + 1}`, status: 'published', title: s.title, category: s.category,
            quantity: s.quantity, quotes: [], decisions: [], awardedVendor: s.vendor,
            review: { summary: '', vendors }, publicSummary: s.summary, publishedAt: daysAgo(s.days),
        });
    });
}