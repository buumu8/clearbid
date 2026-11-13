import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import RiskBadge from '../components/RiskBadge.jsx';
import { getBestChoice } from '../utils/recommendation.js';
import AssistantPanel from '../components/AssistantPanel.jsx';

/** Only surface real vendor-risk flags in the Accept/Override list. */
const isVendorRisk = (f) => f.type !== 'compliance';

/** Render filled/empty stars for a rating out of 5. */
function Stars({ rating }) {
    if (rating == null) return null;
    const filled = Math.round(rating);
    return <span title={`${rating}/5`}>{'★'.repeat(filled)}{'☆'.repeat(5 - filled)}</span>;
}

export default function DecisionPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [purchase, setPurchase] = useState(null);
    const [choices, setChoices] = useState({}); // { "Vendor A|price|0": { action, reason } }
    const [vendor, setVendor] = useState('');
    const [awardRemark, setAwardRemark] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.getPurchase(id).then(setPurchase).catch((e) => setError(e.message));
    }, [id]);

    if (error && !purchase) return <p className="error">{error}</p>;
    if (!purchase?.review) return <p>Loading…</p>;

    const { review } = purchase;
    const quoteCount = review.vendors.length;
    const bestChoice = getBestChoice(review.vendors);

    // Flat list of vendor-risk flags only (no compliance) — these go in the Accept/Override UI
    const flags = review.vendors.flatMap((v) =>
        v.flags
            .filter(isVendorRisk)
            .map((f, i) => ({ ...f, vendor: v.vendor, key: `${v.vendor}|${f.type}|${i}` }))
    );

    const supervisorRequired = review.requires_supervisor_approval === true;

    const getChoice = (key) => choices[key] || { action: 'accept', reason: '' };
    const setChoice = (key, patch) =>
        setChoices((c) => ({ ...c, [key]: { ...getChoice(key), ...patch } }));

    const winnerHasAcceptedFlags = flags.some(
        (f) => f.vendor === vendor && getChoice(f.key).action === 'accept'
    );

    const deviatesFromAI = vendor && bestChoice && vendor !== bestChoice.vendor;
    const remarkRequired = deviatesFromAI || winnerHasAcceptedFlags;

    async function handleAward() {
        const decisions = flags.map((f) => ({
            vendor: f.vendor, flagType: f.type, ...getChoice(f.key),
        }));
        if (decisions.some((d) => d.action === 'override' && !d.reason.trim())) {
            return setError('Every override needs a reason.');
        }
        if (!vendor) return setError('Select a vendor to award.');
        if (remarkRequired && !awardRemark.trim()) {
            return setError('An award justification is required when deviating from the AI recommendation or awarding a flagged vendor.');
        }

        setSaving(true);
        setError('');
        try {
            await api.submitDecisions(id, decisions);
            await api.award(id, vendor, awardRemark.trim(), bestChoice?.vendor ?? '');
            navigate(`/officer/${id}/report`);
        } catch (e) {
            setError(e.message);
            setSaving(false);
        }
    }

    return (
        <section>
            <h1>Officer decision: {purchase.title}</h1>
            <p className="muted" style={{ marginBottom: 16 }}>
                Compared {quoteCount} competing vendor quote{quoteCount !== 1 ? 's' : ''}.
            </p>

            {supervisorRequired && (
                <div className="warning" style={{ marginBottom: 12 }}>
                    ⚠️ One or more line totals exceed $50,000 — supervisor sign-off required upon award.
                </div>
            )}

            {bestChoice && (
                <div className={bestChoice.fallback ? 'warning' : 'notice-ok'} style={{ marginBottom: 20 }}>
                    <strong>Agent Best Choice: {bestChoice.vendor}</strong>
                    {' — '}{bestChoice.reason}
                    {bestChoice.conditional && <span className="muted"> (conditional — review medium flags)</span>}
                </div>
            )}

            <div className="card">
                <h2>1. Review each flag</h2>
                {flags.length === 0 && <p>No vendor risk flags were raised.</p>}
                {flags.map((f) => {
                    const c = getChoice(f.key);
                    return (
                        <div key={f.key} className="flag-row">
                            <strong>{f.vendor}</strong> <RiskBadge type={f.type} level={f.level} />
                            <p className="muted">{f.evidence}</p>
                            <label>
                                <input type="radio" name={f.key} checked={c.action === 'accept'}
                                    onChange={() => setChoice(f.key, { action: 'accept' })} /> Accept flag
                            </label>{' '}
                            <label>
                                <input type="radio" name={f.key} checked={c.action === 'override'}
                                    onChange={() => setChoice(f.key, { action: 'override' })} /> Override
                            </label>
                            {c.action === 'override' && (
                                <textarea rows="2" placeholder="Reason for override (required)" value={c.reason}
                                    onChange={(e) => setChoice(f.key, { reason: e.target.value })} />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="card">
                <h2>2. Select the vendor to award</h2>
                {review.vendors.map((v) => {
                    const r = v.reviews;
                    const isRecommended = bestChoice && bestChoice.vendor === v.vendor;
                    return (
                        <label
                            key={v.vendor}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                margin: '6px 0',
                                borderRadius: '6px',
                                border: '1px solid var(--border, #e2e8f0)',
                                background: 'transparent'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input type="radio" name="vendor" checked={vendor === v.vendor}
                                    onChange={() => setVendor(v.vendor)} />
                                <div>
                                    <strong>{v.vendor}</strong>: ${v.unitPrice.toLocaleString()} per unit
                                    {r?.rating != null && (
                                        <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>
                                            <Stars rating={r.rating} /> {r.rating}/5
                                        </span>
                                    )}
                                </div>
                            </div>
                            {isRecommended && (
                                <span className="tag tag-green" style={{ fontSize: '11px', padding: '2px 8px' }}>
                                    ✓ Agent Recommended
                                </span>
                            )}
                        </label>
                    );
                })}
                {winnerHasAcceptedFlags && (
                    <p className="warning" style={{ marginTop: 10 }}>
                        This vendor still has accepted risk flags. Are you sure?
                    </p>
                )}
            </div>

            {remarkRequired && (
                <div className="card">
                    <h2>3. Award justification <span style={{ color: 'var(--danger)', fontWeight: 400, fontSize: 13 }}>(required)</span></h2>
                    <p className="muted" style={{ marginBottom: 8 }}>
                        {deviatesFromAI
                            ? `You are selecting a vendor other than the AI's recommendation (${bestChoice?.vendor}). Please explain your decision.`
                            : 'You are awarding a vendor with accepted risk flags. Please explain your decision.'}
                    </p>
                    <textarea
                        rows="3"
                        placeholder="e.g. Preferred vendor has established relationship and delivery track record…"
                        value={awardRemark}
                        onChange={(e) => setAwardRemark(e.target.value)}
                    />
                </div>
            )}

            <AssistantPanel purchase={purchase} />

            {error && <p className="error">{error}</p>}
            <button onClick={handleAward} disabled={saving} style={{ marginTop: 16 }}>
                {saving ? 'Saving…' : 'Award contract'}
            </button>
        </section>
    );
}