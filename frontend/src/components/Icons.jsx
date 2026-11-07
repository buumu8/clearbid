function Icon({ children }) {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {children}
        </svg>
    );
}

export const ChartIcon = () => (
    <Icon><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></Icon>
);

export const ShieldIcon = () => (
    <Icon><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9.5C7.5 20.5 4 17 4 12V6z" /><path d="M9 12l2 2 4-4" /></Icon>
);

export const DocIcon = () => (
    <Icon>
        <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
        <path d="M14 3v6h6" /><path d="M8 13h8M8 17h5" />
    </Icon>
);