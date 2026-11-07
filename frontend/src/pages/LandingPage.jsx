import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartIcon, ShieldIcon, DocIcon } from '../components/Icons.jsx';
import { api } from '../api.js';

import heroImg from '../assets/hero.svg'

const STEPS = [
    { tag: 'Officer', title: 'Upload quotes', text: 'Enter the purchase details and upload the vendor quote PDFs.' },
    { tag: 'AI agents', title: 'Automated review', text: 'Agents compare prices with past government purchases and screen every vendor.' },
    { tag: 'Officer', title: 'Decide', text: 'Accept or override each flag with a reason, then award the contract.' },
    { tag: 'Public', title: 'Publish', text: 'A plain-language summary goes to the public portal after approval.' },
];

const FEATURES = [
    {
        Icon: ChartIcon, title: 'Price intelligence',
        text: 'Each line item is compared with USAspending.gov award history and market prices.'
    },
    {
        Icon: ShieldIcon, title: 'Vendor integrity',
        text: 'Checks the SAM.gov exclusions list and spots competing vendors that share addresses, phones or bank accounts.'
    },
    {
        Icon: DocIcon, title: 'Transparent reporting',
        text: 'Drafts an audit-ready memo for officers and a plain-language summary for citizens.'
    },
];

const SAFEGUARDS = [
    'Agents flag and explain. They never reject a vendor.',
    'Every override requires a written reason.',
    'Only a named officer can award a contract.',
    'Nothing is published without approval.',
    'Every step is recorded in an audit log.',
];

const CATEGORY_CLASS = {
    'IT Hardware': 'cat-blue',
    'Office Supplies': 'cat-purple',
    'Services': 'cat-teal',
};
const catClass = (c) => CATEGORY_CLASS[c] || 'cat-gray';

const money = (n) =>
    n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function LandingPage() {
    const [recentReports, setRecentReports] = useState([]);

    useEffect(() => {
        api.publicPurchases()
            .then((items) => setRecentReports(items.slice(0, 3)))
            .catch(() => setRecentReports([]));
    }, []);

    return (
        <>
            {/* Hero */}
            <section className="hero">
                <div>
                    <span className="eyebrow">Agentic AI for public procurement</span>
                    <h1>Every public purchase, <span>fairly priced</span> and fully transparent.</h1>
                    <p className="hero-sub">
                        ClearBid's AI agents review vendor quotes in minutes. They check prices against past
                        government purchases and flag fraud with clear evidence. Officers stay in charge of every decision.
                    </p>
                    <div className="hero-actions">
                        <Link to="/officer/new" className="btn">Start a review</Link>
                        <Link to="/public" className="btn btn-secondary">View public portal</Link>
                    </div>
                    <p className="muted">Built with IBM watsonx Orchestrate and IBM Bob</p>
                </div>
                <img src={heroImg} alt="ClearBid review dashboard with risk flags" className="hero-img" />
            </section>



            {/* How it works */}
            <section className="section">
                <div className="section-title">
                    <h2>How it works</h2>
                    <p className="muted">From a pile of quotes to a published decision in four steps.</p>
                </div>
                <div className="grid-4">
                    {STEPS.map((s, i) => (
                        <div key={s.title} className="card">
                            <div className="step-num">{i + 1}</div>
                            <div className="step-tag">{s.tag}</div>
                            <h2>{s.title}</h2>
                            <p className="muted">{s.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section className="section">
                <div className="section-title">
                    <h2>What the agents check</h2>
                    <p className="muted">Uses data the government already publishes, connected for a single decision.</p>
                </div>
                <div className="grid-3">
                    {FEATURES.map(({ Icon, title, text }) => (
                        <div key={title} className="card">
                            <div className="feature-icon"><Icon /></div>
                            <h2>{title}</h2>
                            <p className="muted">{text}</p>
                        </div>
                    ))}
                </div>
            </section>



            {/* Human in the loop */}
            <section className="section">
                <div className="callout">
                    <div>
                        <h2>AI recommends. People decide.</h2>
                        <p>
                            ClearBid's agents have no tools that award contracts or publish reports. Every binding
                            decision is made by an accountable person.
                        </p>
                    </div>
                    <ul>
                        {SAFEGUARDS.map((s) => (
                            <li key={s}><span className="check">✓</span>{s}</li>
                        ))}
                    </ul>
                </div>
            </section>

            {/* Live Public Report Preview (Interactive Zoom Cards) */}
            {recentReports.length > 0 && (
                <section className="section featured-section-bg">
                    <div className="section-title">
                        <h2>Latest public disclosures</h2>
                        <p className="muted">Real-time sample data straight from the transparency portal.</p>
                    </div>
                    <div className="grid-3">
                        {recentReports.map((p) => (
                            <div
                                key={p.id}
                                className="card preview-card"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    cursor: 'pointer',
                                    borderTop: '4px solid var(--accent, #2563eb)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
                                    e.currentTarget.style.boxShadow = '0 12px 24px -8px rgba(0, 0, 0, 0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0px) scale(1)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span className={`tag ${catClass(p.category)}`}>{p.category}</span>
                                        {p.risksFlagged > 0 && (
                                            <span className="tag tag-amber" style={{ fontSize: '11px' }}>⚠ {p.risksFlagged} risk caught</span>
                                        )}
                                    </div>
                                    <h3 style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text)' }}>{p.title}</h3>
                                    <p className="muted" style={{ fontSize: '14px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {p.publicSummary}
                                    </p>
                                </div>
                                <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontSize: '11px', display: 'block', color: 'var(--muted)' }}>Total Awarded</span>
                                        <strong style={{ fontSize: '16px', color: 'var(--text)' }}>{money(p.totalAmount)}</strong>
                                    </div>
                                    <Link to="/public" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Explore →</Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* CTA */}
            <section className="cta">
                <h2 className="cta-title">See it catch a fraudulent bid</h2>
                <p className="muted">Run the demo: 50 laptops, three quotes, one problem.</p>
                <Link to="/officer/new" className="btn">Try the demo</Link>
            </section>

            <footer className="footer">
                ClearBid prototype · IBM Agentic AI Hackathon · Demo data is synthetic
            </footer>
        </>
    );
}