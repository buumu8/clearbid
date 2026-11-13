/**
 * AssistantPanel.jsx
 *
 * Compact, collapsible ClearBid Assistant chat panel.
 *
 * Calls POST /api/assistant (via the api object) with a structured intent.
 * In demo mode, mockApi.assistant() returns an instant canned response.
 *
 * The assistant provides text suggestions only. It never makes or publishes
 * procurement decisions — those require explicit officer confirmation via the
 * existing award and publish buttons.
 *
 * Response labelling:
 *   source === "agent"  → "ClearBid Assistant (AI-assisted)"
 *   source === "demo"   → "ClearBid Assistant (Demo — not a live AI model)"
 *   source === "fallback" → "ClearBid Assistant (Fallback — live model unavailable)"
 */

import { useState } from 'react';
import { api } from '../api.js';

const INTENT_LABELS = {
    start_review: 'Review guide',
    explain_flag: 'Explain selected flag',
    draft_summary: 'Draft public summary',
};

function sourceLabel(source) {
    if (source === 'agent') return 'ClearBid Assistant (AI-assisted)';
    if (source === 'fallback') return 'ClearBid Assistant (Fallback — live model unavailable)';
    return 'ClearBid Assistant (Demo — not a live AI model)';
}

function AssistantContent({ message }) {
    let data;

    try {
        data = JSON.parse(message);
    } catch {
        // Normal text response: display as text.
        return <div className="assistant-content">{message}</div>;
    }

    // If it isn't the expected review result, show it as formatted JSON
    // rather than assuming its structure.
    if (!data || typeof data !== 'object' || !Array.isArray(data.vendors)) {
        return (
            <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 13 }}>
                {JSON.stringify(data, null, 2)}
            </pre>
        );
    }

    return (
        <div className="assistant-content">
            {data.summary && <p><strong>Review summary:</strong> {data.summary}</p>}
            {data.risk_level && <p><strong>Overall risk:</strong> {data.risk_level}</p>}

            {typeof data.requires_supervisor_approval === 'boolean' && (
                <p>
                    <strong>Supervisor approval:</strong>{' '}
                    {data.requires_supervisor_approval ? 'Required' : 'Not indicated'}
                </p>
            )}

            <h4>Vendor findings</h4>
            {data.vendors.map((vendor, index) => (
                <section key={`${vendor.vendor}-${index}`} className="assistant-vendor">
                    <strong>{vendor.vendor || 'Unnamed vendor'}</strong>
                    {typeof vendor.unitPrice === 'number' && (
                        <div>Unit price: ${vendor.unitPrice.toLocaleString()}</div>
                    )}

                    {vendor.flags?.length > 0 ? (
                        <ul>
                            {vendor.flags.map((flag, flagIndex) => (
                                <li key={`${flag.type}-${flagIndex}`}>
                                    <strong>
                                        {flag.level ? `${flag.level} ` : ''}
                                        {flag.type || 'Potential issue'}:
                                    </strong>{' '}
                                    {flag.evidence || 'No evidence detail provided.'}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No flags listed for this vendor.</p>
                    )}
                </section>
            ))}

            <p className="assistant-disclaimer">
                These are AI-generated review indicators, not findings of fraud or non-compliance.
                An officer must verify the evidence and make the decision.
            </p>
        </div>
    );
}

function Message({ msg }) {
    const isDemo = msg.source !== 'agent';
    return (
        <div className={`assistant-msg${isDemo ? ' assistant-msg--demo' : ''}`}>
            <div className="assistant-msg-label">{sourceLabel(msg.source)}</div>
            <AssistantContent message={msg.message} />
            {msg.disclaimer && (
                <div className="assistant-disclaimer">{msg.disclaimer}</div>
            )}
        </div>
    );
}

export default function AssistantPanel({ purchase }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState('');
    const [lastIntent, setLastIntent] = useState(null);

    async function sendIntent(intent) {
        setLastIntent(intent);
        setLoading(true);
        setError('');

        // Build context for the intent.
        const context = { purchaseId: purchase?.id };
        if (intent === 'explain_flag' && purchase?.review?.vendors) {
            // Find the first high-risk flag to explain; officer can send again for others.
            for (const v of purchase.review.vendors) {
                const highFlag = v.flags?.find((f) => f.level === 'high');
                if (highFlag) {
                    context.vendor = v.vendor;
                    context.flagType = highFlag.type;
                    context.evidence = highFlag.evidence;
                    break;
                }
            }
            if (!context.vendor) {
                // No high flags — use first flag of any level.
                for (const v of purchase.review.vendors) {
                    if (v.flags?.length > 0) {
                        context.vendor = v.vendor;
                        context.flagType = v.flags[0].type;
                        context.evidence = v.flags[0].evidence;
                        break;
                    }
                }
            }
        }

        try {
            const result = await api.assistant(intent, context);
            setMessages((prev) => [...prev, result]);
        } catch (e) {
            setError(e.message || 'Assistant is unavailable.');
        } finally {
            setLoading(false);
        }
    }

    async function retry() {
        if (lastIntent) await sendIntent(lastIntent);
    }

    return (
        <div className="assistant-panel">
            <button
                className="assistant-panel-header"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
            >
                <span>🤖 ClearBid Assistant</span>
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>
                    {open ? 'collapse ▲' : 'expand ▼'}
                </span>
            </button>

            {open && (
                <div className="assistant-body">
                    <div className="assistant-btn-row">
                        {Object.entries(INTENT_LABELS).map(([intent, label]) => (
                            <button
                                key={intent}
                                className="btn-light"
                                disabled={loading}
                                onClick={() => sendIntent(intent)}
                                style={{ fontSize: 13 }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                            <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                            Thinking…
                        </div>
                    )}

                    {error && (
                        <div className="warning" style={{ fontSize: 13, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                            <span>⚠ {error}</span>
                            <button className="btn-light" style={{ fontSize: 12 }} onClick={retry}>Retry</button>
                        </div>
                    )}

                    {messages.length > 0 && (
                        <div className="assistant-messages">
                            {messages.map((msg, i) => (
                                <Message key={i} msg={msg} />
                            ))}
                        </div>
                    )}

                    {messages.length === 0 && !loading && !error && (
                        <p className="muted" style={{ fontSize: 13 }}>
                            Use the buttons above to get a review guide, explain a flag, or draft a public summary.
                            All suggestions require your independent review — the assistant cannot make or publish decisions.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
