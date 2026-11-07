import { Link } from 'react-router-dom';
import { ChartIcon, ShieldIcon, DocIcon } from '../components/Icons.jsx';

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

export default function LandingPage() {
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
                <img src="/hero.svg" alt="ClearBid review dashboard with risk flags" className="hero-img" />
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