import { CheckCircleFilled } from '@ant-design/icons';

export const PricingSection = () => {
    return (
        <section id="pricing" className="pricing-section">
            <h2 className="section-title" style={{ color: '#fff' }}>Planes Sencillos y Transparentes</h2>
            <div className="pricing-grid">
                
                <div className="pricing-card">
                    <h3 className="pricing-tier">Básico</h3>
                    <div className="pricing-price">
                        <span className="pricing-currency">$</span>0
                    </div>
                    <ul className="pricing-features">
                        <li><CheckCircleFilled className="icon"/> 1 Usuario (+Admin)</li>
                        <li><CheckCircleFilled className="icon"/> Punto de Venta Base</li>
                        <li><CheckCircleFilled className="icon"/> Productos Ilimitados</li>
                        <li><CheckCircleFilled className="icon"/> 1 Moneda Activa</li>
                    </ul>
                    <button className="btn-secondary" style={{ width: '100%' }}>Comenzar Gratis</button>
                </div>

                <div className="pricing-card featured">
                    <div className="pricing-badge">MÁS POPULAR</div>
                    <h3 className="pricing-tier">Pyme / Local</h3>
                    <div className="pricing-price">
                        <span className="pricing-currency">$</span>25<span style={{ fontSize: '18px', color: '#94a3b8', alignSelf: 'flex-end', paddingBottom: '8px' }}>/mes</span>
                    </div>
                    <ul className="pricing-features">
                        <li><CheckCircleFilled className="icon"/> Usuarios Ilimitados</li>
                        <li><CheckCircleFilled className="icon"/> POS Multimoneda Avanzado</li>
                        <li><CheckCircleFilled className="icon"/> Nómina de RRHH Activa</li>
                        <li><CheckCircleFilled className="icon"/> Multiples Cajas Fuertes</li>
                        <li><CheckCircleFilled className="icon"/> Reportes Inflacionarios</li>
                    </ul>
                    <button className="btn-primary" style={{ width: '100%' }}>Probar Premium</button>
                </div>

                <div className="pricing-card">
                    <h3 className="pricing-tier">Corporativo</h3>
                    <div className="pricing-price">
                        <span className="pricing-currency">$</span>89<span style={{ fontSize: '18px', color: '#94a3b8', alignSelf: 'flex-end', paddingBottom: '8px' }}>/mes</span>
                    </div>
                    <ul className="pricing-features">
                        <li><CheckCircleFilled className="icon"/> Todo lo del plan Pyme</li>
                        <li><CheckCircleFilled className="icon"/> Sincronización Mercado Libre</li>
                        <li><CheckCircleFilled className="icon"/> Proyecciones de Inventario ML</li>
                        <li><CheckCircleFilled className="icon"/> Integración API</li>
                        <li><CheckCircleFilled className="icon"/> Soporte Prioritario 24/7</li>
                    </ul>
                    <button className="btn-secondary" style={{ width: '100%' }}>Contactar Ventas</button>
                </div>

            </div>
        </section>
    );
};
