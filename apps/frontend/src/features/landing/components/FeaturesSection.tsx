import { 
    GlobalOutlined, 
    ShopOutlined, 
    TeamOutlined, 
    BarChartOutlined 
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * FeaturesSection Component
 * Grid display of the application's unique selling points (USPs).
 * Supports internationalization (i18n).
 */
export const FeaturesSection = () => {
    const { t } = useTranslation();

    const features = [
        {
            icon: <GlobalOutlined />,
            title: t('landing.features.items.multi_currency.title'),
            description: t('landing.features.items.multi_currency.desc')
        },
        {
            icon: <ShopOutlined />,
            title: t('landing.features.items.mercadolibre.title'),
            description: t('landing.features.items.mercadolibre.desc')
        },
        {
            icon: <TeamOutlined />,
            title: t('landing.features.items.hr.title'),
            description: t('landing.features.items.hr.desc')
        },
        {
            icon: <BarChartOutlined />,
            title: t('landing.features.items.analytics.title'),
            description: t('landing.features.items.analytics.desc')
        }
    ];

    return (
        <section id="features" className="features-section">
            <h2 className="section-title">{t('landing.features.title')}</h2>
            <div className="features-grid">
                {features.map((f, i) => (
                    <div key={i} className="feature-card">
                        <div className="feature-icon">{f.icon}</div>
                        <h3 className="feature-title">{f.title}</h3>
                        <p className="feature-text">{f.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};
