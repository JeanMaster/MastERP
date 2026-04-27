import { useTranslation } from 'react-i18next';

/**
 * LandingFooter Component
 * Standard footer with copyright information and branding.
 * Supports internationalization (i18n).
 */
export const LandingFooter = () => {
    const { t } = useTranslation();

    return (
        <footer className="landing-footer">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src="/favicon.svg" alt="MastERP Logo" style={{ height: '24px', opacity: 0.5 }} />
                    <span style={{ fontWeight: 600, color: '#475569' }}>MastERP</span>
                </div>
                <p>{t('landing.footer.copyright', { year: new Date().getFullYear() })}</p>
                <p style={{ fontSize: '14px' }}>{t('landing.footer.mission')}</p>
            </div>
        </footer>
    );
};
