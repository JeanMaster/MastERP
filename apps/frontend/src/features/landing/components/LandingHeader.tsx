import { useNavigate } from 'react-router-dom';

export const LandingHeader = () => {
    const navigate = useNavigate();

    return (
        <header className="landing-header">
            <div className="landing-logo">
                <img src="/favicon.svg" alt="MastERP Logo" />
                <span>MastERP</span>
            </div>
            
            <nav className="landing-nav">
                <a href="#features">Funcionalidades</a>
                <a href="#pricing">Planes</a>
                <a href="#about">Nosotros</a>
            </nav>

            <div className="auth-buttons">
                <button className="btn-secondary" onClick={() => navigate('/login')}>
                    Acceder
                </button>
                <button className="btn-primary" onClick={() => navigate('/login')}>
                    Probar Gratis
                </button>
            </div>
        </header>
    );
};
