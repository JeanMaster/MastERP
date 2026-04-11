import { useNavigate } from 'react-router-dom';

export const HeroSection = () => {
    const navigate = useNavigate();

    return (
        <section className="hero-section">
            <h1 className="hero-title">
                El ERP del <span className="hero-title-highlight">Futuro.</span><br />
                Creado para Economías Reales.
            </h1>
            <p className="hero-subtitle">
                Simplifica y optimiza tu negocio con la plataforma ERP más avanzada para Punto de Venta Multimoneda, Inteligencia de Inventario y Nómina. Blindado contra la inflación.
            </p>
            <div className="hero-actions">
                <button className="btn-primary" onClick={() => navigate('/login')}>
                    Empieza Ya - Gratis
                </button>
                <button className="btn-secondary">
                    Solicitar Demo
                </button>
            </div>
        </section>
    );
};
