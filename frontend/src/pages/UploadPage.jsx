import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, IS_DEMO, realApi } from '../api.js';

const SCENARIO_DEFAULTS = {
    'laptops-50': { title: 'Laptops for Public Works', category: 'IT Hardware', quantity: 50 },
    'chairs-120': { title: 'Ergonomic office chairs for City Hall', category: 'Office Supplies', quantity: 120 },
    'toner-400': { title: 'Printer toner cartridges', category: 'Office Supplies', quantity: 400 },
};

const SCENARIO_OPTIONS = [
    { value: 'laptops-50', label: 'Laptops (50 units)' },
    { value: 'chairs-120', label: 'Chairs (120 units)' },
    { value: 'toner-400', label: 'Toner (400 units)' },
];

/** Infer scenario from uploaded filenames; returns null if nothing matches. */
function inferScenario(files) {
    for (const f of files) {
        const name = f.name.toLowerCase();
        if (name.startsWith('toner')) return 'toner-400';
        if (name.startsWith('chairs')) return 'chairs-120';
        if (name.startsWith('laptops')) return 'laptops-50';
    }
    return null;
}

export default function UploadPage() {
    const navigate = useNavigate();
    const [scenarioId, setScenarioId] = useState('laptops-50');
    const [form, setForm] = useState({ ...SCENARIO_DEFAULTS['laptops-50'] });
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [quoteChecks, setQuoteChecks] = useState([]); // [{fileName, sha256, version, warnings, error}]

    const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    function handleScenarioChange(e) {
        const id = e.target.value;
        setScenarioId(id);
        setForm({ ...SCENARIO_DEFAULTS[id] });
    }

    function handleFiles(e) {
        const selected = [...e.target.files];
        setFiles(selected);
        const inferred = inferScenario(selected);
        if (inferred && inferred !== scenarioId) {
            setScenarioId(inferred);
            setForm({ ...SCENARIO_DEFAULTS[inferred] });
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (files.length === 0) return setError('Upload at least one quote PDF.');
        setLoading(true);
        setError('');
        setQuoteChecks([]);
        try {
            const quotes = files.map((f) => ({ fileName: f.name, size: f.size }));
            const purchase = await api.createPurchase({
                ...form,
                quantity: Number(form.quantity),
                quotes,
                scenarioId,
            });

            // Upload actual PDF bytes to backend (skipped in static demo mode).
            if (!IS_DEMO) {
                const results = await Promise.allSettled(
                    files.map((f) => realApi.uploadQuote(purchase.id, f))
                );
                const checks = results.map((r, i) =>
                    r.status === 'fulfilled'
                        ? { fileName: files[i].name, ...r.value }
                        : { fileName: files[i].name, error: r.reason?.message ?? 'Upload failed' }
                );
                setQuoteChecks(checks);
                // If any check has non-warning errors, stay on this page so the officer can review.
                const hasErrors = checks.some((c) => c.error);
                if (hasErrors) {
                    setLoading(false);
                    return; // show errors; officer must resolve or proceed manually
                }
            }

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

                <label>Review scenario
                    <select value={scenarioId} onChange={handleScenarioChange}>
                        {SCENARIO_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                    <span className="muted" style={{ fontSize: '0.8em' }}>
                        Auto-detected from filenames — override if needed.
                    </span>
                </label>

                <label>Title
                    <input name="title" value={form.title} onChange={update} required />
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

                {quoteChecks.length > 0 && (
                    <div className="card" style={{ marginTop: 12 }}>
                        <h3 style={{ fontSize: 14, marginBottom: 8 }}>
                            File checks{' '}
                            <span className="muted" style={{ fontWeight: 400 }}>
                                (officer review aids — not a fraud proof)
                            </span>
                        </h3>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {quoteChecks.map((c) => (
                                <li key={c.fileName} style={{ marginBottom: 8, fontSize: 13 }}>
                                    <strong>{c.fileName}</strong>
                                    {c.error
                                        ? <span className="error" style={{ display: 'block' }}>✗ {c.error}</span>
                                        : <>
                                            <span className="tag tag-green" style={{ marginLeft: 6 }}>
                                                v{c.version} uploaded
                                            </span>
                                            <span className="muted" style={{ display: 'block', fontFamily: 'monospace', fontSize: 11, marginTop: 2 }}>
                                                SHA-256: {c.sha256?.slice(0, 16)}…
                                            </span>
                                            {c.warnings?.map((w, i) => (
                                                <span key={i} className="tag tag-amber" style={{ display: 'block', marginTop: 4 }}>{w}</span>
                                            ))}
                                        </>
                                    }
                                </li>
                            ))}
                        </ul>
                        {quoteChecks.some((c) => c.error) && (
                            <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                                One or more files could not be uploaded. Fix the issues above or proceed — the review will use the entered form data only.
                            </p>
                        )}
                    </div>
                )}

                {error && <p className="error">{error}</p>}
                <button disabled={loading}>{loading ? 'Starting review…' : 'Run agentic review'}</button>
                {quoteChecks.some((c) => c.error) && !loading && (
                    <button
                        type="button"
                        className="btn-light"
                        style={{ marginLeft: 10 }}
                        onClick={async () => {
                            setLoading(true);
                            try {
                                const purchase = await api.createPurchase({
                                    ...form,
                                    quantity: Number(form.quantity),
                                    quotes: files.map((f) => ({ fileName: f.name, size: f.size })),
                                    scenarioId,
                                });
                                await api.startReview(purchase.id);
                                navigate(`/officer/${purchase.id}/review`);
                            } catch (err) {
                                setError(err.message);
                                setLoading(false);
                            }
                        }}
                    >
                        Skip upload errors and start review
                    </button>
                )}
            </form>
        </section>
    );
}
