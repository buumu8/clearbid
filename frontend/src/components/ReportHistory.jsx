/**
 * ReportHistory.jsx
 *
 * Collapsible version history and verification panel for a published report.
 * Fetches from GET /api/public/purchases/:id/history.
 * Shows each version, publication time, and an audit reference hash fingerprint.
 *
 * NOTE: This record is tamper-evident but not immutable. The server stores
 * history in memory — it resets on server restart. A production deployment
 * would use a database with write-once audit records.
 */

import { useState } from 'react';
import { api } from '../api.js';

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
        dateStyle: 'medium', timeStyle: 'short',
    });
}

export default function ReportHistory({ purchaseId }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState(null);
    const [error, setError] = useState('');

    async function handleOpen() {
        const next = !open;
        setOpen(next);
        if (next && !history && !loading) {
            setLoading(true);
            setError('');
            try {
                const data = await api.publicPurchaseHistory(purchaseId);
                setHistory(data);
            } catch (e) {
                setError(e.message || 'Could not load version history.');
            } finally {
                setLoading(false);
            }
        }
    }

    return (
        <div className="history-panel">
            <button
                className="btn-light"
                style={{ width: '100%', textAlign: 'left', marginTop: 16, fontSize: 13 }}
                onClick={handleOpen}
                aria-expanded={open}
            >
                {open ? '▾' : '▸'} Version history &amp; verification
            </button>

            {open && (
                <div style={{ marginTop: 10 }}>
                    {loading && <p className="muted" style={{ fontSize: 13 }}>Loading history…</p>}
                    {error && <p className="error" style={{ fontSize: 13 }}>{error}</p>}
                    {!loading && !error && history && (
                        <>
                            <div className="history-row" style={{ background: 'var(--surface)', borderRadius: 6, padding: '10px 12px', marginBottom: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
                                    <strong style={{ fontSize: 13 }}>
                                        Version {history.publishVersion ?? 1}
                                        <span className="tag tag-green" style={{ marginLeft: 8, fontSize: 11 }}>Current</span>
                                    </strong>
                                    <span className="muted" style={{ fontSize: 12 }}>{formatDate(history.publishedAt)}</span>
                                </div>
                            </div>

                            {history.publishHistory?.length > 0 && (
                                <>
                                    <p className="muted" style={{ fontSize: 12, margin: '8px 0 4px' }}>Earlier versions</p>
                                    {[...history.publishHistory].reverse().map((h) => (
                                        <div key={h.version} className="history-row" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', marginBottom: 6 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
                                                <strong style={{ fontSize: 13 }}>Version {h.version}</strong>
                                                <span className="muted" style={{ fontSize: 12 }}>{formatDate(h.publishedAt)}</span>
                                            </div>
                                            {h.auditRef && (
                                                <p className="muted hash-ref" style={{ margin: '4px 0 0', fontSize: 11, fontFamily: 'monospace' }}>
                                                    Audit ref: {h.auditRef.slice(0, 16)}…
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}

                            {history.publishHistory?.length === 0 && (
                                <p className="muted" style={{ fontSize: 12 }}>No earlier versions.</p>
                            )}

                            <p className="muted" style={{ fontSize: 11, marginTop: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                                {history.note}
                            </p>
                        </>
                    )}
                    {!loading && !error && !history && (
                        <p className="muted" style={{ fontSize: 13 }}>No history available.</p>
                    )}
                </div>
            )}
        </div>
    );
}
