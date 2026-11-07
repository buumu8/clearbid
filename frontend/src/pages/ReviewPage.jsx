import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { waitForReview } from '../api.js';
import RiskBadge from '../components/RiskBadge.jsx';

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
                <h1>Agents are reviewing the quotes…</h1>
                <p className="muted">Checking prices, vendors and procurement rules.</p>
            </section>
        );
    }

    const { review } = purchase;
    return (
        <section>
            <h1>{purchase.title}</h1>
            <p className="summary">{review.summary}</p>

            <div className="split">
                <table className="table">
                    <thead>
                        <tr><th>Vendor</th><th>Unit price</th><th>Risk flags</th></tr>
                    </thead>
                    <tbody>
                        {review.vendors.map((v, i) => (
                            <tr key={v.vendor} onClick={() => setSelected(v)}
                                className={selected?.vendor === v.vendor ? 'selected' : ''}>
                                <td>{v.vendor}</td>
                                <td>${v.unitPrice.toLocaleString()}</td>
                                <td>
                                    {v.flags.length
                                        ? v.flags.map((f) => <RiskBadge key={f.type - { i }} {...f} />)
                                        : <span className="badge badge-low">clear</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <aside className="card">
                    <h2>Evidence</h2>
                    {!selected && <p className="muted">Click a vendor to see the evidence.</p>}
                    {selected && selected.flags.length === 0 && <p>No issues found.</p>}
                    {selected && selected.flags.length > 0 && (
                        <ul>
                            {selected.flags.map((f, i) => (
                                <li key={f.type - { i }}><strong>{f.type}:</strong> {f.evidence}</li>
                            ))}
                        </ul>
                    )}
                </aside>
            </div>

            <button onClick={() => navigate(`/officer/${id}/decide`)}>Continue to decision</button>
        </section>
    );
}