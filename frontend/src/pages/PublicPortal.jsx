import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const CATEGORY_CLASS = {
    'IT Hardware': 'cat-blue',
    'Office Supplies': 'cat-purple',
    'Services': 'cat-teal',
};
const catClass = (c) => CATEGORY_CLASS[c] || 'cat-gray';

const money = (n) =>
    n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function timeAgo(iso) {
    if (!iso) return '';
    const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return new Date(iso).toLocaleDateString();
}
const isNew = (iso) => iso && Date.now() - new Date(iso) < 7 * 86400000;

/** Render filled/empty stars for a rating out of 5. */
function Stars({ rating }) {
    if (rating == null) return null;
    const filled = Math.round(rating);
    return <span title={`${rating}/5`}>{'★'.repeat(filled)}{'☆'.repeat(5 - filled)}</span>;
}

function Tags({ p }) {
    return (
        <div className="tags">
            <span className={`tag ${catClass(p.category)}`}>{p.category}</span>
            <span className="tag tag-gray" title="How many vendor quotes were compared">
                {p.quotesCompared} quotes compared
            </span>
            {p.risksFlagged > 0 ? (
                <span className="tag tag-amber" title="Issues the AI flagged for the officer to check">
                    ⚠ {p.risksFlagged} {p.risksFlagged === 1 ? 'risk' : 'risks'} caught
                </span>
            ) : (
                <span className="tag tag-green">No risks found</span>
            )}
            <span className="tag tag-green" title="A named officer made the final decision">✓ Officer approved</span>
            {p.awardRemark && (
                <span className="tag tag-amber" title="Officer deviated from AI recommendation — see justification">
                    ⚑ Officer override
                </span>
            )}
        </div>
    );
}

function Thumb({ p, onOpen }) {
    return (
        <article className="thumb" role="button" tabIndex={0} onClick={onOpen}
            onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
            <div className={`stripe ${catClass(p.category)}-bar`} />
            <div className="thumb-top">
                <h3>{p.title}</h3>
                {isNew(p.publishedAt) && <span className="new-pill">NEW</span>}
            </div>
            <div className="thumb-amount">{money(p.totalAmount)}</div>
            {p.awardedVendorRating != null && (
                <p style={{ margin: '4px 0 6px', fontSize: 13, color: 'var(--muted)' }}>
                    <Stars rating={p.awardedVendorRating} /> {p.awardedVendorRating}/5
                </p>
            )}
            <Tags p={p} />
            <p className="clamp">{p.publicSummary}</p>
            <div className="thumb-foot">
                <span>{timeAgo(p.publishedAt)}</span>
                <span className="link">Read more →</span>
            </div>
        </article>
    );
}

function DetailModal({ p, onClose }) {
    const overrideOccurred = p.awardRemark && p.aiRecommendation && p.aiRecommendation !== p.awardedVendor;
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
                <div className={`stripe ${catClass(p.category)}-bar`} />
                <p className="muted">Published {timeAgo(p.publishedAt)} · {p.id}</p>
                <h2 className="modal-title">{p.title}</h2>
                <Tags p={p} />
                <div className="facts">
                    <div className="fact"><span>Total cost</span><strong>{money(p.totalAmount)}</strong></div>
                    <div className="fact"><span>Price per unit</span><strong>{money(p.unitPrice)}</strong></div>
                    <div className="fact"><span>Quantity</span><strong>{p.quantity}</strong></div>
                    <div className="fact"><span>Awarded vendor</span><strong>{p.awardedVendor}</strong></div>
                    {p.awardedVendorRating != null && (
                        <div className="fact">
                            <span>User rating</span>
                            <strong><Stars rating={p.awardedVendorRating} /> {p.awardedVendorRating}/5</strong>
                        </div>
                    )}
                    {overrideOccurred && (
                        <div className="fact">
                            <span>AI recommended</span>
                            <strong>{p.aiRecommendation}</strong>
                        </div>
                    )}
                </div>
                <h3>What happened</h3>
                <p>{p.publicSummary}</p>
                {overrideOccurred && (
                    <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--warn-soft)', borderRadius: 8, border: '1px solid #fde68a' }}>
                        <strong style={{ fontSize: 13, color: 'var(--warn)' }}>Officer's justification</strong>
                        <p style={{ margin: '6px 0 0', fontSize: 14 }}>{p.awardRemark}</p>
                    </div>
                )}
                <p className="muted small">Bank details and personal information are never published.</p>
            </div>
        </div>
    );
}

export default function PublicPortal() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [category, setCategory] = useState('All');
    const [open, setOpen] = useState(null);

    useEffect(() => {
        api.publicPurchases()
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => e.key === 'Escape' && setOpen(null);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const categories = useMemo(() => ['All', ...new Set(items.map((p) => p.category))], [items]);
    const stats = useMemo(() => ({
        count: items.length,
        spend: items.reduce((s, p) => s + (p.totalAmount || 0), 0),
        quotes: items.reduce((s, p) => s + p.quotesCompared, 0),
        risks: items.reduce((s, p) => s + p.risksFlagged, 0),
    }), [items]);

    const filtered = category === 'All' ? items : items.filter((p) => p.category === category);
    const [featured, ...rest] = filtered;

    return (
        <section>
            <div className="portal-head">
                <div>
                    <span className="eyebrow">Public transparency portal</span>
                    <h1>How your city spends public money</h1>
                    <p className="muted">Every purchase is checked by AI and approved by a named officer.</p>
                </div>
            </div>

            <div className="stats">
                <div className="stat"><div className="stat-value">{stats.count}</div><div className="stat-label">Purchases published</div></div>
                <div className="stat"><div className="stat-value">{money(stats.spend)}</div><div className="stat-label">Total public spending</div></div>
                <div className="stat"><div className="stat-value">{stats.quotes}</div><div className="stat-label">Quotes compared</div></div>
                <div className="stat"><div className="stat-value stat-warn">{stats.risks}</div><div className="stat-label">Risks caught before award</div></div>
            </div>

            <div className="chips">
                {categories.map((c) => (
                    <button key={c} className={`chip ${c === category ? 'active' : ''}`} onClick={() => setCategory(c)}>
                        {c}
                    </button>
                ))}
            </div>

            <div className="legend">
                <span><span className="tag tag-amber">⚠ risks caught</span> Problems the AI flagged and an officer reviewed</span>
                <span><span className="tag tag-green">✓ Officer approved</span> A person made the final decision</span>
                <span><span className="tag tag-amber">⚑ Officer override</span> Officer deviated from AI recommendation — justification published</span>
            </div>

            {loading && <p>Loading…</p>}
            {error && <p className="error">{error}</p>}
            {!loading && filtered.length === 0 && <p>No purchases published yet.</p>}

            {featured && (
                <article className="featured">
                    <div>
                        <div className="featured-label">
                            <span className="pulse-dot" /> Latest report
                            {isNew(featured.publishedAt) && <span className="new-pill">NEW</span>}
                        </div>
                        <h2>{featured.title}</h2>
                        <Tags p={featured} />
                        <p className="featured-summary">{featured.publicSummary}</p>
                        <button className="btn-light" onClick={() => setOpen(featured)}>Read full report</button>
                    </div>
                    <div className="featured-amount">
                        <span>Total cost</span>
                        <div className="big">{money(featured.totalAmount)}</div>
                        <p>{featured.quantity} units × {money(featured.unitPrice)}</p>
                        <p>Vendor: <strong>{featured.awardedVendor}</strong></p>
                        {featured.awardedVendorRating != null && (
                            <p><Stars rating={featured.awardedVendorRating} /> {featured.awardedVendorRating}/5</p>
                        )}
                        <p>{timeAgo(featured.publishedAt)}</p>
                    </div>
                </article>
            )}

            {rest.length > 0 && (
                <>
                    <h2 className="grid-title">Earlier reports</h2>
                    <div className="thumb-grid">
                        {rest.map((p) => <Thumb key={p.id} p={p} onOpen={() => setOpen(p)} />)}
                    </div>
                </>
            )}

            <p className="muted small demo-note">Sample data shown for demonstration purposes.</p>

            {open && <DetailModal p={open} onClose={() => setOpen(null)} />}
        </section>
    );
}
