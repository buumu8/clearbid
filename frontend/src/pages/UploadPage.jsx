import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const SCENARIO_OPTIONS = [
    { value: 'laptops-50',  label: 'Laptops (50 units)' },
    { value: 'chairs-120',  label: 'Chairs (120 units)' },
    { value: 'toner-400',   label: 'Toner (400 units)' },
];

/** Infer scenario from uploaded filenames; returns null if nothing matches. */
function inferScenario(files) {
    for (const f of files) {
        const name = f.name.toLowerCase();
        if (name.startsWith('toner'))   return 'toner-400';
        if (name.startsWith('chairs'))  return 'chairs-120';
        if (name.startsWith('laptops')) return 'laptops-50';
    }
    return null;
}

export default function UploadPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ title: '', category: 'IT Hardware', quantity: 50 });
    const [files, setFiles] = useState([]);
    const [scenarioId, setScenarioId] = useState('laptops-50');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    function handleFiles(e) {
        const selected = [...e.target.files];
        setFiles(selected);
        const inferred = inferScenario(selected);
        if (inferred) setScenarioId(inferred);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (files.length === 0) return setError('Upload at least one quote PDF.');
        setLoading(true);
        setError('');
        try {
            const quotes = files.map((f) => ({ fileName: f.name, size: f.size }));
            const purchase = await api.createPurchase({
                ...form,
                quantity: Number(form.quantity),
                quotes,
                scenarioId,
            });
            await api.startReview(purchase.id);
            navigate(`/officer/${purchase.id}/review`);
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    }

    return (
        <section className="card">
            <h1>New purchase request</h1>
            <form className="form" onSubmit={handleSubmit}>
                <label>Title
                    <input name="title" value={form.title} onChange={update} required placeholder="Laptops for Public Works" />
                </label>
                <label>Category
                    <select name="category" value={form.category} onChange={update}>
                        <option>IT Hardware</option>
                        <option>Office Supplies</option>
                        <option>Services</option>
                    </select>
                </label>
                <label>Quantity
                    <input name="quantity" type="number" min="1" value={form.quantity} onChange={update} required />
                </label>
                <label>Vendor quotes (PDF)
                    <input type="file" accept="application/pdf" multiple onChange={handleFiles} />
                </label>
                {files.length > 0 && (
                    <ul className="muted">{files.map((f) => <li key={f.name}>{f.name}</li>)}</ul>
                )}
                <label>Review scenario
                    <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
                        {SCENARIO_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    <span className="muted" style={{ fontSize: '0.8em' }}>
                        Auto-detected from filenames — override if needed.
                    </span>
                </label>
                {error && <p className="error">{error}</p>}
                <button disabled={loading}>{loading ? 'Starting review…' : 'Run agentic review'}</button>
            </form>
        </section>
    );
}