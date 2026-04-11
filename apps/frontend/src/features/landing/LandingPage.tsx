import { Layout } from 'antd';
import { HeroSection } from './components/HeroSection';
import { FeaturesSection } from './components/FeaturesSection';
import { PricingSection } from './components/PricingSection';
import { LandingFooter } from './components/LandingFooter';
import { LandingHeader } from './components/LandingHeader';
import './landing.css';

const { Content } = Layout;

export const LandingPage = () => {
    return (
        <Layout className="landing-layout">
            <LandingHeader />
            <Content className="landing-content">
                <HeroSection />
                <FeaturesSection />
                <PricingSection />
            </Content>
            <LandingFooter />
        </Layout>
    );
};
