import { 
    GlobalOutlined, 
    ShopOutlined, 
    TeamOutlined, 
    BarChartOutlined 
} from '@ant-design/icons';

export const FeaturesSection = () => {
    const features = [
        {
            icon: <GlobalOutlined />,
            title: "POS 100% Multimoneda",
            description: "Cobra en Bolívares y Dólares en la misma factura. El sistema re-calcula vueltos y equivalencias al instante según la tasa del día."
        },
        {
            icon: <ShopOutlined />,
            title: "Sincronización Mercado Libre",
            description: "Vende en tu local y publica en Mercado Libre al mismo tiempo. Inventario siempre cuadrado y sin dolores de cabeza."
        },
        {
            icon: <TeamOutlined />,
            title: "Nómina y RRHH Integrado",
            description: "Registra empleados, define sueldos base y genera la nómina quincenal con 2 clics. Envía recibos impecables."
        },
        {
            icon: <BarChartOutlined />,
            title: "Proyección Inflacionaria",
            description: "Nuestros reportes usan tasas históricas para aislar la inflación, mostrando crecimiento real y proyecciones exactas de inventario a fin de año."
        }
    ];

    return (
        <section id="features" className="features-section">
            <h2 className="section-title">Diseñado para la Inestabilidad</h2>
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
