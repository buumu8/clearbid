const CLASS = { high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };

export default function RiskBadge({ type, level }) {
    return <span className={`badge ${CLASS[level] || 'badge-low'}`}>{type}: {level}</span>;
}
