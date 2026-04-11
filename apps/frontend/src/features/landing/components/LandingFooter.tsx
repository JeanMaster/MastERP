export const LandingFooter = () => {
    return (
        <footer className="landing-footer">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/favicon.svg" alt="MastERP Logo" style={{ height: '24px', opacity: 0.5 }} />
                    <span style={{ fontWeight: 600, color: '#475569' }}>MastERP</span>
                </div>
                <p>© {new Date().getFullYear()} MastERP Systems. Todos los derechos reservados.</p>
                <p style={{ fontSize: '14px' }}>Construido con tecnología de vanguardia para empoderar comercios y vencer la inestabilidad.</p>
            </div>
        </footer>
    );
};
