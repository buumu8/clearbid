import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import RiskBadge from '../components/RiskBadge.jsx';

export default function DecisionPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [purchase, setPurchase] = useState(null);
    const [choices, setChoices] = useState({}); // { "Vendor A|price": { action, reason } }
    const [vendor, setVendor] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.getPurchase(id).then(setPurchase).catch((e) => setError(e.message));
    }, [id]);

    if (error && !purchase) return <p className="error">{error}</p>;
    if (!purchase?.review) return <p>Loading…</p>;

    const flags = purchase.review.vendors.flatMap((v) =>
        v.flags.map((f) => ({ ...f, vendor: v.vendor, key: `${v.vendor}|${f.type}` })));

    const getChoice = (key) => choices[key] || { action: 'accept', reason: '' };
    const setChoice = (key, patch) =>
        setChoices((c) => ({ ...c, [key]: { ...getChoice(key), ...patch } }));

    const winnerHasAcceptedFlags = flags.some(
        (f) => f.vendor === vendor && getChoice(f.key).action === 'accept');

    async function handleAward() {
        const decisions = flags.map((f) => ({
            vendor: f.vendor, flagType: f.type, ...getChoice(f.key),
        }));
        if (decisions.some((d) => d.action === 'override' && !d.reason.trim())) {
            return setError('Every override needs a reason.');
        }
        if (!vendor) return setError('Select a vendor to award.');

        setSaving(true);
        setError('');
        try {
            await api.submitDecisions(id, decisions);
            await api.award(id, vendor);
            navigate(`/officer/${id}/report`);
        } catch (e) {
            setError(e.message);
            setSaving(false);
        }
    }

    return (
        <section>
            <h1>Officer decision: {purchase.title}</h1>

            <div className="card">
                <h2>1. Review each flag</h2>
                {flags.length === 0 && <p>No flags were raised.</p>}
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
                {purchase.review.vendors.map((v) => (
                    <label key={v.vendor} style={{ display: 'block', margin: '6px 0' }}>
                        <input type="radio" name="vendor" checked={vendor === v.vendor}
                            onChange={() => setVendor(v.vendor)} />{' '}
                        {v.vendor}: ${v.unitPrice.toLocaleString()} per unit
                    </label>
                ))}
                {winnerHasAcceptedFlags && (
                    <p className="warning">This vendor still has accepted risk flags. Are you sure?</p>
                )}
            </div>

            {error && <p className="error">{error}</p>}
            <button onClick={handleAward} disabled={saving}>
                {saving ? 'Saving…' : 'Award contract'}
            </button>
        </section>
    );
}