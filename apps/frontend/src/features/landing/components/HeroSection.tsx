import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * HeroSection Component
 * The primary value proposition section of the landing page.
 * Highlights the main ERP benefits and provides a Call to Action (CTA) for new users.
 * Supports internationalization (i18n).
 */
export const HeroSection = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <section className="hero-section">
            <h1 className="hero-title">
                {t('landing.hero.title')}
            </h1>
            <p className="hero-subtitle">
                {t('landing.hero.subtitle')}
            </p>
            <div className="hero-actions">
                <button className="btn-primary" onClick={() => navigate('/login')}>
                    {t('landing.hero.cta')}
                </button>
                <button className="btn-secondary">
                    {t('landing.nav.about')}
                </button>
            </div>
        </section>
    );
};
