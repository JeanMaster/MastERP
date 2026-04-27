import { CheckCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * PricingSection Component
 * Displays the different subscription tiers and features.
 * Supports internationalization (i18n).
 */
export const PricingSection = () => {
    const { t } = useTranslation();

    return (
        <section id="pricing" className="pricing-section">
            <h2 className="section-title" style={{ color: '#fff' }}>{t('landing.pricing.title')}</h2>
            <div className="pricing-grid">
                
                {/* Starter Plan */}
                <div className="pricing-card">
                    <h3 className="pricing-tier">{t('landing.pricing.tiers.starter.name')}</h3>
                    <div className="pricing-price">
                        <span className="pricing-currency">$</span>0
                    </div>
                    <ul className="pricing-features">
                        {(t('landing.pricing.tiers.starter.features', { returnObjects: true }) as string[]).map((feature, index) => (
                            <li key={index}><CheckCircleFilled className="icon"/> {feature}</li>
                        ))}
                    </ul>
                    <button className="btn-secondary" style={{ width: '100%' }}>{t('landing.pricing.tiers.starter.cta')}</button>
                </div>

                {/* SME / Professional Plan */}
                <div className="pricing-card featured">
                    <div className="pricing-badge">{t('landing.pricing.badges.popular')}</div>
                    <h3 className="pricing-tier">{t('landing.pricing.tiers.professional.name')}</h3>
                    <div className="pricing-price">
                        <span className="pricing-currency">$</span>25<span style={{ fontSize: '18px', color: '#94a3b8', alignSelf: 'flex-end', paddingBottom: '8px' }}>/mo</span>
                    </div>
                    <ul className="pricing-features">
                        {(t('landing.pricing.tiers.professional.features', { returnObjects: true }) as string[]).map((feature, index) => (
                            <li key={index}><CheckCircleFilled className="icon"/> {feature}</li>
                        ))}
                    </ul>
                    <button className="btn-primary" style={{ width: '100%' }}>{t('landing.pricing.tiers.professional.cta')}</button>
                </div>

                {/* Enterprise Plan */}
                <div className="pricing-card">
                    <h3 className="pricing-tier">{t('landing.pricing.tiers.enterprise.name')}</h3>
                    <div className="pricing-price">
                        <span className="pricing-currency">$</span>89<span style={{ fontSize: '18px', color: '#94a3b8', alignSelf: 'flex-end', paddingBottom: '8px' }}>/mo</span>
                    </div>
                    <ul className="pricing-features">
                        {(t('landing.pricing.tiers.enterprise.features', { returnObjects: true }) as string[]).map((feature, index) => (
                            <li key={index}><CheckCircleFilled className="icon"/> {feature}</li>
                        ))}
                    </ul>
                    <button className="btn-secondary" style={{ width: '100%' }}>{t('landing.pricing.tiers.enterprise.cta')}</button>
                </div>

            </div>
        </section>
    );
};
