import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';

/**
 * LandingHeader Component
 * Global navigation header for the landing page.
 * Supports internationalization (i18n).
 */
export const LandingHeader = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <header className="landing-header">
            <div className="landing-logo">
                <img src="/favicon.svg" alt="MastERP Logo" />
                <span>MastERP</span>
            </div>
            
            <nav className="landing-nav">
                <a href="#features">{t('landing.nav.features')}</a>
                <a href="#pricing">{t('landing.nav.pricing')}</a>
                <a href="#about">{t('landing.nav.about')}</a>
            </nav>

            <div className="auth-buttons" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Segmented
                    options={[
                        { label: 'ES', value: 'es' },
                        { label: 'EN', value: 'en' },
                    ]}
                    value={i18n.language.startsWith('es') ? 'es' : 'en'}
                    onChange={(val) => changeLanguage(val as string)}
                    size="small"
                />
                <button className="btn-secondary" onClick={() => navigate('/login')}>
                    {t('landing.nav.sign_in')}
                </button>
                <button className="btn-primary" onClick={() => navigate('/login')}>
                    {t('landing.nav.try_free')}
                </button>
            </div>
        </header>
    );
};
