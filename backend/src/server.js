import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {
    createPurchase, getPurchase, listPurchases, moveStatus, logEvent, getAuditLog,
} from './store.js';
import { runReview, runQuoteChecks } from './review.js';
import { seedDemoData } from './seed.js';



const app = express();
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim());

if (process.env.USE_MOCK_AGENTS === 'true') seedDemoData();

app.use(cors({ origin: allowed }));
app.use(express.json({ limit: '1mb' }));

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, mock: process.env.USE_MOCK_AGENTS }));

// Officer: create purchase
app.post('/api/purchases', (req, res) => {
    const { title, category, quantity, quotes = [] } = req.body;
    res.status(201).json(createPurchase({ title, category, quantity, quotes }));
});

app.get('/api/purchases/:id', (req, res) => {
    const p = getPurchase(req.params.id);
    return p ? res.json(p) : res.status(404).json({ error: 'Not found' });
});

// Start the agent review. Return right away; the frontend polls for the result
app.post('/api/purchases/:id/review', (req, res, next) => {
    try {
        const p = moveStatus(req.params.id, 'analyzing', 'system');
        res.status(202).json({ status: p.status });
        runReview(p)
            .then((review) => {
                p.review = review;
                moveStatus(p.id, 'analyzed', 'agent');
            })
            .catch((err) => logEvent(p.id, 'system', 'review_failed', { error: err.message }));
    } catch (e) { next(e); }
});

// Human checkpoint 1: accept or override each flag (a reason is required to override)
app.post('/api/purchases/:id/decisions', (req, res, next) => {
    try {
        const { decisions = [] } = req.body; // [{ vendor, flagType, action: 'accept'|'override', reason }]
        const missing = decisions.find((d) => d.action === 'override' && !d.reason?.trim());
        if (missing) return res.status(400).json({ error: 'Override requires a reason' });
        const p = moveStatus(req.params.id, 'reviewed', 'officer');
        p.decisions = decisions;
        logEvent(p.id, 'officer', 'flags_reviewed', { decisions });
        res.json(p);
    } catch (e) { next(e); }
});

// Human checkpoint 2: award
app.post('/api/purchases/:id/award', (req, res, next) => {
    try {
        const p = moveStatus(req.params.id, 'awarded', 'officer');
        p.awardedVendor = req.body.vendor;
        logEvent(p.id, 'officer', 'awarded', { vendor: req.body.vendor });
        res.json(p);
    } catch (e) { next(e); }
});

// Human checkpoint 3: approve publication
app.post('/api/purchases/:id/publish', (req, res, next) => {
    try {
        const p = moveStatus(req.params.id, 'published', 'officer');
        p.publicSummary = req.body.publicSummary;
        p.publishedAt = new Date().toISOString(); // add this
        res.json(p);
    } catch (e) { next(e); }
});

// Public portal: published purchases only, with no sensitive fields
app.get('/api/public/purchases', (req, res) => {
    const items = listPurchases((p) => p.status === 'published')
        .map((p) => {
            const winner = p.review?.vendors.find((v) => v.vendor === p.awardedVendor);
            return {
                id: p.id,
                title: p.title,
                category: p.category,
                quantity: p.quantity,
                awardedVendor: p.awardedVendor,
                publicSummary: p.publicSummary,
                publishedAt: p.publishedAt,
                unitPrice: winner?.unitPrice ?? null,
                totalAmount: winner ? winner.unitPrice * p.quantity : null,
                quotesCompared: p.review?.vendors.length ?? 0,
                risksFlagged: p.review?.vendors.reduce((n, v) => n + v.flags.length, 0) ?? 0,
            };
        })
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    res.json(items);
});

app.get('/api/audit', (req, res) => res.json(getAuditLog()));

// Tool endpoint for watsonx Orchestrate (server to server, protected by an API key)
app.post('/tools/run-quote-review', (req, res) => {
    if (req.get('x-api-key') !== process.env.TOOL_API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(runQuoteChecks(req.body.purchaseId));
});

// Error handler
app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: err.message });
});

app.listen(process.env.PORT || 3001, () =>
    console.log(`ClearBid API on port ${process.env.PORT || 3001}`));