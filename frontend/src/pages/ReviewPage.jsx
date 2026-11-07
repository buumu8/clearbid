import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { waitForReview } from '../api.js';
import RiskBadge from '../components/RiskBadge.jsx';
import { getBestChoice } from '../utils/recommendation.js';

/** Strip compliance flags — shown as a top-level notice on the Decision page instead. */
const vendorFlags = (flags) => flags.filter((f) => f.type !== 'compliance');

/** Render filled/empty stars for a rating out of 5. */
function Stars({ rating }) {
    if (rating == null) return null;
    const filled = Math.round(rating);
    return (
        <span title={`${rating} / 5`}>
            {'★'.repeat(filled)}{'☆'.repeat(5 - filled)}
        </span>
    );
}

/** Reviews panel shown in the Evidence aside when a vendor is selected. */
function ReviewsPanel({ reviews }) {
    if (!reviews?.rating) return null;
    return (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>User satisfaction</h3>
            <p style={{ margin: '0 0 8px', fontSize: 14 }}>
                <Stars rating={reviews.rating} />{' '}
                <strong>{reviews.rating}</strong> / 5
                <span className="muted"> · {reviews.review_count?.toLocaleString()} reviews</span>
            </p>
            {reviews.snippets?.length > 0 && (
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {reviews.snippets.map((s, i) => (
                        <li key={`snippet-${i}`} style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>
                            "{s}"
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function ReviewPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [purchase, setPurchase] = useState(null);
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        waitForReview(id)
            .then((p) => active && setPurchase(p))
            .catch((err) => active && setError(err.message));
        return () => { active = false; };
    }, [id]);

    if (error) return <p className="error">{error}</p>;
    if (!purchase) {
        return (
            <section className="card">
                <div className="spinner" />
                <h1>Agents are reviewing the quotes…</h1>
                <p className="muted">Checking prices, vendors and procurement rules.</p>
            </section>
        );
    }

    const { review } = purchase;
    const quoteCount = review.vendors.length;
    const bestChoice = getBestChoice(review.vendors);
    const selectedVendorFlags = selected ? vendorFlags(selected.flags) : [];

    return (
        <section>
            <h1>{purchase.title}</h1>
            <p className="summary">{review.summary}</p>

            {bestChoice && (
                <div className={bestChoice.fallback ? 'warning' : 'notice-ok'} style={{ marginTop: 12 }}>
                    <strong>Agent Best Choice: {bestChoice.vendor}</strong>
                    {' — '}{bestChoice.reason}
                    {bestChoice.conditional && <span className="muted"> (conditional — review medium flags)</span>}
                </div>
            )}

            <p className="muted" style={{ marginBottom: 0 }}>
                Compared {quoteCount} competing vendor quote{quoteCount !== 1 ? 's' : ''}.
            </p>

            <div className="split">
                <table className="table">
                    <thead>
                        <tr><th>Vendor</th><th>Unit price</th><th>Risk flags</th></tr>
                    </thead>
                    <tbody>
                        {review.vendors.map((v) => {
                            const displayFlags = vendorFlags(v.flags);
                            return (
                                <tr key={v.vendor} onClick={() => setSelected(v)}
                                    className={selected?.vendor === v.vendor ? 'selected' : ''}>
                                    <td>{v.vendor}</td>
                                    <td>${v.unitPrice.toLocaleString()}</td>
                                    <td>
                                        {displayFlags.length
                                            ? displayFlags.map((f, i) => (
                                                <RiskBadge key={`${v.vendor}-${f.type}-${i}`} {...f} />
                                            ))
                                            : <span className="badge badge-low">clear</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <aside className="card">
                    <h2>Evidence</h2>
                    {!selected && <p className="muted">Click a vendor to see the evidence.</p>}
                    {selected && selectedVendorFlags.length === 0 && <p>No issues found.</p>}
                    {selected && selectedVendorFlags.length > 0 && (
                        <ul>
                            {selectedVendorFlags.map((f, i) => (
                                <li key={`${selected.vendor}-${f.type}-${i}`}>
                                    <strong>{f.type}:</strong> {f.evidence}
                                </li>
                            ))}
                        </ul>
                    )}
                    {selected && <ReviewsPanel reviews={selected.reviews} />}
                </aside>
            </div>

            <button onClick={() => navigate(`/officer/${id}/decide`)}>Continue to decision</button>
        </section>
    );
}
