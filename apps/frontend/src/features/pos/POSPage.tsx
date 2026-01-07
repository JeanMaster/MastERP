import { useState, useEffect } from 'react';
import { Layout, message, Tabs, Grid } from 'antd';
import { ShoppingCartOutlined, AppstoreOutlined } from '@ant-design/icons';
import { POSHeader } from './components/POSHeader';
import { POSLeftPanel } from './components/POSLeftPanel';
import { POSRightPanel } from './components/POSRightPanel';
import { POSFooter } from './components/POSFooter';
import { CheckoutModal } from './components/CheckoutModal';
import { ClientSelectionModal } from './components/ClientSelectionModal';
import { InvoiceModal } from './components/InvoiceModal';
import { usePOSStore } from '../../store/posStore';
import type { Sale } from '../../services/salesApi';

const { Content, Sider, Footer } = Layout;
const { useBreakpoint } = Grid;

export const POSPage = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [activeTab, setActiveTab] = useState('catalog');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const { processSale, setCustomer, refreshInvoiceNumber, initialize } = usePOSStore();

    const handleCheckoutProcess = async (paymentData: any) => {
        try {
            const sale = await processSale(paymentData);
            message.success(`Venta procesada exitosamente. Factura: ${sale.invoiceNumber}`);
            setIsCheckoutOpen(false);
            setCompletedSale(sale);
            setIsInvoiceModalOpen(true);
            await refreshInvoiceNumber();
        } catch (error) {
            message.error('Error al procesar la venta');
            console.error('Sale processing error:', error);
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'F3') {
            e.preventDefault();
            setIsClientModalOpen(true);
        } else if (e.key === 'F9') {
            e.preventDefault();
            setIsCheckoutOpen(true);
        }
    };

    useEffect(() => {
        initialize(); // Sincronizar tasas y datos iniciales al entrar al POS
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <Layout style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <POSHeader />

            {!isMobile ? (
                <Layout style={{ flex: 1, overflow: 'hidden' }}>
                    <Sider
                        width="35%"
                        style={{
                            background: '#f0f2f5',
                            padding: '10px 0 10px 10px',
                            borderRight: '1px solid #d9d9d9',
                            height: '100%',
                            overflow: 'hidden'
                        }}
                    >
                        <POSLeftPanel />
                    </Sider>

                    <Layout style={{ height: '100%' }}>
                        <Content style={{ background: '#f0f2f5', padding: '10px 10px 10px 10px', flex: 1, overflow: 'hidden' }}>
                            <div style={{
                                background: '#e6e6e6',
                                height: '100%',
                                borderRadius: 8,
                                padding: 10,
                                border: '1px solid #d9d9d9',
                                overflow: 'hidden'
                            }}>
                                <POSRightPanel />
                            </div>
                        </Content>

                        <Footer style={{ padding: 0, background: 'transparent' }}>
                            <POSFooter
                                onClientClick={() => setIsClientModalOpen(true)}
                                onCheckoutClick={() => setIsCheckoutOpen(true)}
                            />
                        </Footer>
                    </Layout>
                </Layout>
            ) : (
                <Content style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        centered
                        style={{ background: '#fff' }}
                        tabBarStyle={{ marginBottom: 0 }}
                        items={[
                            {
                                key: 'catalog',
                                label: (
                                    <span>
                                        <AppstoreOutlined />
                                        Catálogo
                                    </span>
                                ),
                                children: (
                                    <div style={{ padding: 8, height: 'calc(100vh - 180px)', overflow: 'hidden' }}>
                                        <POSRightPanel />
                                    </div>
                                )
                            },
                            {
                                key: 'cart',
                                label: (
                                    <span>
                                        <ShoppingCartOutlined />
                                        Carrito
                                    </span>
                                ),
                                children: (
                                    <div style={{ padding: 8, height: 'calc(100vh - 180px)', overflow: 'hidden' }}>
                                        <POSLeftPanel />
                                    </div>
                                )
                            }
                        ]}
                    />
                    <Footer style={{ padding: 0, marginTop: 'auto' }}>
                        <POSFooter
                            onClientClick={() => setIsClientModalOpen(true)}
                            onCheckoutClick={() => setIsCheckoutOpen(true)}
                        />
                    </Footer>
                </Content>
            )}

            <CheckoutModal
                open={isCheckoutOpen}
                onCancel={() => setIsCheckoutOpen(false)}
                onProcess={handleCheckoutProcess}
            />

            <ClientSelectionModal
                open={isClientModalOpen}
                onSelect={(client) => {
                    setCustomer(client);
                    setIsClientModalOpen(false);
                }}
                onCancel={() => setIsClientModalOpen(false)}
            />

            <InvoiceModal
                open={isInvoiceModalOpen}
                sale={completedSale}
                onClose={() => {
                    setIsInvoiceModalOpen(false);
                    setCompletedSale(null);
                }}
            />
        </Layout>
    );
};
