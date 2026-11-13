import { useEffect, useState } from 'react';

import { api } from '../api.js';

export default function PublicAssistant({ reports }) {
    const [open, setOpen] = useState(false);
    const [purchaseId, setPurchaseId] = useState(reports[0]?.id ?? '');
    const [question, setQuestion] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!purchaseId && reports.length > 0) {
            setPurchaseId(reports[0].id);
        }
    }, [purchaseId, reports]);




    async function sendQuestion(event) {
        event?.preventDefault();

        if (!purchaseId || !question.trim() || loading) return;

        console.log('[public assistant] submit clicked');
        const asked = question.trim();
        setQuestion('');
        setError('');
        setMessages((prev) => [...prev, { role: 'visitor', text: asked }]);
        setLoading(true);

        try {
            const result = await api.publicAssistant(purchaseId, asked);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    text: result.message,
                    disclaimer: result.disclaimer,
                },
            ]);
        } catch (err) {
            setError(err.message || 'The assistant is unavailable.');
        } finally {
            setLoading(false);
        }
    }

    if (!reports.length) return null;

    return (
        <div className="public-assistant">
            {open && (
                <section className="public-assistant-panel" aria-label="Public report assistant">
                    <header className="public-assistant-heading">
                        <div>
                            <strong>Ask about a public report</strong>
                            <div className="muted small">Answers use published information only.</div>
                        </div>
                        <button
                            type="button"
                            className="modal-close"
                            onClick={() => setOpen(false)}
                            aria-label="Close assistant"
                        >
                            ×
                        </button>
                    </header>

                    <label className="public-assistant-label" htmlFor="public-report-select">
                        Report
                    </label>
                    <select
                        id="public-report-select"
                        value={purchaseId}
                        onChange={(e) => setPurchaseId(e.target.value)}
                    >
                        {reports.map((report) => (
                            <option key={report.id} value={report.id}>
                                {report.title}
                            </option>
                        ))}
                    </select>

                    <div className="public-assistant-messages" aria-live="polite">
                        {messages.length === 0 && (
                            <p className="muted small">
                                Try: “Summarize this report” or “What does the risk count mean?”
                            </p>
                        )}

                        {messages.map((message, index) => (
                            <div key={index} className={`public-chat-message public-chat-message--${message.role}`}>
                                <strong>{message.role === 'visitor' ? 'You' : 'Assistant'}</strong>
                                <p>{message.text}</p>
                                {message.disclaimer && (
                                    <small className="muted">{message.disclaimer}</small>
                                )}
                            </div>
                        ))}
                    </div>
                    {loading && (
                        <div className="public-chat-loading" role="status" aria-live="polite">
                            <span className="assistant-spinner" aria-hidden="true" />
                            <span>Checking the published report…</span>
                        </div>
                    )}


                    {error && <p className="error">{error}</p>}

                    <form onSubmit={sendQuestion} className="public-assistant-form">
                        <input
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            maxLength={500}
                            placeholder="Ask about this report…"
                            aria-label="Ask about this report"
                        />
                        <button
                            type="submit"
                            disabled={loading || !question.trim() || !purchaseId}
                            aria-busy={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="assistant-spinner" aria-hidden="true" />
                                    <span>Sending…</span>
                                </>
                            ) : (
                                'Send'
                            )}
                        </button>
                    </form>
                </section>
            )}

            <button
                type="button"
                className="public-assistant-fab"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-label={open ? 'Close report assistant' : 'Open report assistant'}
            >
                {open ? '×' : 'Ask about reports'}
            </button>
        </div>
    );
}