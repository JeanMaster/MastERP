import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Segmented, Drawer, Button } from 'antd';
import { MenuOutlined } from '@ant-design/icons';

/**
 * LandingHeader Component
 * Global navigation header for the landing page.
 * Supports internationalization (i18n).
 */
export const LandingHeader = () => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    const NavLinks = () => (
        <>
            <a href="#features" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.features')}</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.pricing')}</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)}>{t('landing.nav.about')}</a>
        </>
    );

    return (
        <header className="landing-header">
            <div className="landing-logo">
                <img src="/favicon.svg" alt="MastERP Logo" />
                <span>MastERP</span>
            </div>
            
            <nav className="landing-nav">
                <NavLinks />
            </nav>

            <div className="auth-buttons">
                <Segmented
                    options={[
                        { label: 'ES', value: 'es' },
                        { label: 'EN', value: 'en' },
                    ]}
                    value={i18n.language.startsWith('es') ? 'es' : 'en'}
                    onChange={(val) => changeLanguage(val as string)}
                    size="small"
                    className="lang-selector hide-on-tiny"
                />
                <button className="btn-secondary" onClick={() => navigate('/login')}>
                    {t('landing.nav.sign_in')}
                </button>
                <button className="btn-primary hide-on-mobile" onClick={() => navigate('/login')}>
                    {t('landing.nav.try_free')}
                </button>
                <Button 
                    className="mobile-menu-btn"
                    icon={<MenuOutlined />} 
                    type="text"
                    onClick={() => setMobileMenuOpen(true)}
                    style={{ color: 'white', fontSize: '20px' }}
                />
            </div>

            <Drawer
                title={
                    <div className="landing-logo" style={{ marginBottom: 0 }}>
                        <img src="/favicon.svg" alt="MastERP Logo" style={{ height: 24 }} />
                        <span style={{ fontSize: 20 }}>MastERP</span>
                    </div>
                }
                placement="right"
                onClose={() => setMobileMenuOpen(false)}
                open={mobileMenuOpen}
                styles={{
                    wrapper: { width: 280 },
                    body: { background: '#0b0f19', padding: '24px 0' },
                    header: { background: '#0b0f19', borderBottom: '1px solid rgba(255,255,255,0.05)' }
                }}
            >
                <div className="mobile-nav-links">
                    <NavLinks />
                    <div style={{ padding: '24px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 24 }}>
                        <Button 
                            type="primary" 
                            block 
                            size="large" 
                            onClick={() => navigate('/login')}
                            className="btn-primary"
                        >
                            {t('landing.nav.try_free')}
                        </Button>
                    </div>
                </div>
            </Drawer>
        </header>
    );
};
