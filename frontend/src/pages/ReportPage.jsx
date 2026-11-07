import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

function findWinner(p) {
    return p.review.vendors.find((v) => v.vendor === p.awardedVendor);
}

function draftMemo(p) {
    const winner = findWinner(p);
    const overrides = p.decisions.filter((d) => d.action === 'override');
    const lines = [
        `PRICE REASONABLENESS MEMO - ${p.id}`,
        `Purchase: ${p.title} (${p.quantity} units, ${p.category})`,
        `Quotes reviewed: ${p.review.vendors.length}`,
        `Awarded to: ${p.awardedVendor} at $${winner?.unitPrice.toLocaleString()} per unit`,
        `AI recommendation: ${p.aiRecommendation || 'not recorded'}`,
        `AI review summary: ${p.review.summary}`,
        `Officer overrides: ${overrides.length
            ? overrides.map((d) => `${d.vendor} (${d.flagType}): ${d.reason}`).join('; ')
            : 'none'}`,
    ];
    if (p.awardRemark) lines.push(`Award justification: ${p.awardRemark}`);
    return lines.join('\n');
}

function draftPublicSummary(p) {
    const winner = findWinner(p);
    const total = winner ? `$${(winner.unitPrice * p.quantity).toLocaleString()}` : 'an approved amount';
    let text = `The city purchased ${p.quantity} units for "${p.title}" from ${p.awardedVendor} for ${total}. `
        + `${p.review.vendors.length} quotes were compared against past government prices and checked for vendor risks. `
        + `A procurement officer reviewed the findings and made the final decision.`;
    if (p.aiRecommendation && p.awardedVendor !== p.aiRecommendation && p.awardRemark) {
        text += ` The procurement officer selected ${p.awardedVendor} over the AI-recommended ${p.aiRecommendation}. Justification: ${p.awardRemark}`;
    }
    return text;
}

export default function ReportPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [purchase, setPurchase] = useState(null);
    const [summary, setSummary] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        api.getPurchase(id)
            .then((p) => { setPurchase(p); setSummary(p.publicSummary || draftPublicSummary(p)); })
            .catch((e) => setError(e.message));
    }, [id]);

    async function handlePublish() {
        try {
            await api.publish(id, summary);
            navigate('/public');
        } catch (e) {
            setError(e.message);
        }
    }

    if (error && !purchase) return <p className="error">{error}</p>;
    if (!purchase) return <p>Loading…</p>;

    return (
        <section>
            <h1>Reports: {purchase.title}</h1>

            <div className="card">
                <h2>Internal memo (officer only)</h2>
                <pre>{draftMemo(purchase)}</pre>
            </div>

            <div className="card">
                <h2>Public summary (edit before publishing)</h2>
                <textarea rows="5" value={summary} onChange={(e) => setSummary(e.target.value)} />
                <p className="muted">Check that no bank details or personal information are included.</p>
            </div>

            {error && <p className="error">{error}</p>}
            {purchase.status === 'published'
                ? <p>Already published.</p>
                : <button onClick={handlePublish}>Approve publication</button>}
        </section>
    );
}