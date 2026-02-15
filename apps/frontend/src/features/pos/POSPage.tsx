
import { useState, useEffect, useRef } from 'react';
import { Layout, Typography, Spin, message, Alert, Tabs, Grid, Card, Space, Button, Empty } from 'antd';
const { Text, Title } = Typography;
import { ShoppingCartOutlined, AppstoreOutlined, ShopOutlined } from '@ant-design/icons';
import { POSHeader } from './components/POSHeader';
import { POSLeftPanel } from './components/POSLeftPanel';
import { POSRightPanel } from './components/POSRightPanel';
import { POSFooter } from './components/POSFooter';
import { CheckoutModal } from './components/CheckoutModal';
import { ClientSelectionModal } from './components/ClientSelectionModal';
import { InvoiceModal } from './components/InvoiceModal';
import { usePOSStore } from '../../store/posStore';
import { cashRegisterApi } from '../../services/cashRegisterApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { Sale } from '../../services/salesApi';
import { SessionSummaryModal } from './components/SessionSummaryModal';
import { CashCountModal } from '../cash-register/components/CashCountModal';

const { Content, Sider, Footer } = Layout;
const { useBreakpoint } = Grid;

export const POSPage = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const navigate = useNavigate();
    const { user } = useAuth();
    const [registerId, setRegisterId] = useState<string>(localStorage.getItem('pos_register_id') || '');
    const [activeTab, setActiveTab] = useState('catalog');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const { processSale, setCustomer, refreshInvoiceNumber, initialize, resetPOS } = usePOSStore();
    const queryClient = useQueryClient();

    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [isOpeningArqueoOpen, setIsOpeningArqueoOpen] = useState(false);
    const [isClosingArqueoOpen, setIsClosingArqueoOpen] = useState(false);

    // Fetch available registers
    const { data: registers = [] } = useQuery({
        queryKey: ['cashRegisters'],
        queryFn: () => cashRegisterApi.listRegisters(),
        enabled: user?.role === 'ADMIN' || !registerId
    });

    // Fetch active session based on selected register OR cashier detection
    const { data: activeSession, isLoading: isSessionLoading, isFetching, refetch: refetchSession } = useQuery({
        queryKey: ['activeSession', registerId, user?.username],
        queryFn: () => {
            // If user is a cashier, always prioritize finding THEIR active session
            if (user?.role === 'CASHIER') {
                return cashRegisterApi.getActiveSession(undefined, user.username);
            }
            // Admin or specific register selected manually:
            return cashRegisterApi.getActiveSession(registerId);
        },
        enabled: !!registerId || user?.role === 'CASHIER'
    });

    const redirectedRef = useRef(false);

    // Auto-sync registerId for cashiers based on server-side assignment
    useEffect(() => {
        if (user?.role === 'CASHIER' && !isSessionLoading && !isFetching) {
            if (activeSession) {
                // Force sync even if registerId was already set (e.g. from stale localStorage)
                if (registerId !== activeSession.registerId) {
                    setRegisterId(activeSession.registerId);
                    localStorage.setItem('pos_register_id', activeSession.registerId);
                }
            } else {
                // If no session from server, clear registerId to show "No box assigned"
                if (registerId) {
                    setRegisterId('');
                    localStorage.removeItem('pos_register_id');
                }
            }
        }
    }, [activeSession, user, registerId, isSessionLoading, isFetching]);

    // Bloquear si no hay sesión activa o no está verificada para el cajero (Opcional: solo advertir ahora)
    useEffect(() => {
        // Solo actuar si NO estamos cargando ni haciendo refetching de la sesión
        if (!isSessionLoading && !isFetching && !redirectedRef.current) {
            if (!activeSession) {
                // Si ya intentamos detectar y no hay nada
                if (user?.role === 'CASHIER') {
                    message.error('NO TIENE UNA CAJA ASIGNADA. SOLICITE APERTURA AL ADMINISTRADOR.', 0);
                } else {
                    // Para ADMIN, solo es un aviso informativo
                    message.info('Operando en modo Administrador (Sin sesión de caja activa).', 5);
                }
            } else {
                // Si el usuario actual es el cajero asignado y no ha verificado
                const isAssignedCashier = activeSession.cashierId === user?.username;
                if (isAssignedCashier && !activeSession.verifiedAt) {
                    message.warning(`Hola ${user?.name}, debe realizar el Arqueo de Apertura en Caja antes de procesar ventas.`, 10);
                }
            }
        }
    }, [activeSession, isSessionLoading, isFetching, navigate, user, registerId]);

    const handleCajaClick = async () => {
        const hide = message.loading('Sincronizando estado de caja...', 0);
        try {
            const { data: freshSession } = await refetchSession();

            if (!freshSession) {
                message.error('CAJA NO APERTURADA');
                return;
            }

            if (!freshSession.verifiedAt && freshSession.cashierId === user?.username) {
                // Caso: Aperturada pero no verificada por el cajero actual
                setIsOpeningArqueoOpen(true);
            } else {
                // Caso: Verificada o abierta por otro (o simplemente queremos ver el resumen)
                setIsSummaryOpen(true);
            }
        } catch (error) {
            message.error('Error al sincronizar datos de caja');
        } finally {
            hide();
        }
    };

    // Helper para calcular el saldo esperado dinámicamente
    const calculateExpectedBalance = () => {
        if (!activeSession) return 0;

        let sales = 0;
        let expenses = 0;
        let deposits = 0;
        let withdrawals = 0;

        activeSession.movements?.forEach((movement: any) => {
            // Robust parsing of amount and rate
            const rawAmount = Number(movement.amount || 0);
            const rawRate = Number(movement.exchangeRate);

            // If rate is valid (>0), use it. otherwise default to 1.
            const rate = (!isNaN(rawRate) && rawRate > 0) ? rawRate : 1;
            const amountInBs = rawAmount * rate;

            const type = String(movement.type).trim();

            switch (type) {
                case 'SALE':
                    sales += amountInBs;
                    break;
                case 'EXPENSE':
                    expenses += amountInBs;
                    break;
                case 'DEPOSIT':
                    deposits += amountInBs;
                    break;
                case 'WITHDRAWAL':
                    withdrawals += amountInBs;
                    break;
                case 'CHANGE':
                    sales -= amountInBs;
                    break;
                case 'ADJUSTMENT':
                    if (amountInBs > 0) withdrawals += amountInBs;
                    else deposits += Math.abs(amountInBs);
                    break;
                // OPENING is ignored
            }
        });

        const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
        return round(Number(activeSession.openingBalance) + sales + withdrawals - expenses - deposits);
    };

    const handleCheckoutProcess = async (paymentData: any) => {
        try {
            const sale = await processSale(paymentData, activeSession?.id);
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
        } else if (e.key === 'F10') {
            e.preventDefault();
            handleCajaClick();
        } else if (e.key === 'Delete') {
            resetPOS();
        }
    };

    useEffect(() => {
        if (activeSession?.status === 'AWAITING_CLOSE') {
            setIsCheckoutOpen(false); // Close checkout if it was open
        }
        initialize(); // Sincronizar tasas y datos iniciales al entrar al POS
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeSession?.status]);

    const handleSelectRegister = (id: string) => {
        setRegisterId(id);
        localStorage.setItem('pos_register_id', id);
    };

    if (!registerId) {
        // If it's a cashier and we are still loading or no session found, show loading/empty
        if (user?.role === 'CASHIER') {
            if (isSessionLoading) {
                return (
                    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
                        <Spin size="large" />
                        <Title level={3} style={{ marginTop: 20 }}>Buscando su Caja...</Title>
                    </div>
                );
            }

            return (
                <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5', padding: 20 }}>
                    <Card style={{ width: '100%', maxWidth: 500, textAlign: 'center' }}>
                        <Empty
                            description={
                                <Title level={4}>No tiene una Caja asignada</Title>
                            }
                        >
                            <Text type="secondary">Consulte con su administrador para que realice la apertura y asignación de su turno.</Text>
                            <div style={{ marginTop: 24 }}>
                                <Button type="primary" onClick={() => queryClient.invalidateQueries({ queryKey: ['activeSession'] })}>
                                    Reintentar Conexión
                                </Button>
                            </div>
                        </Empty>
                    </Card>
                </div>
            );
        }

        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5', padding: 20 }}>
                <Card title={<Title level={3} style={{ margin: 0 }}>📍 Seleccionar Caja para Operar</Title>} style={{ width: '100%', maxWidth: 500, textAlign: 'center' }}>
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <Text type="secondary">Elija la caja registradora en la que trabajará hoy.</Text>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            {registers.map(r => (
                                <Button
                                    key={r.id}
                                    size="large"
                                    style={{ height: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                                    onClick={() => handleSelectRegister(r.id)}
                                >
                                    <ShopOutlined style={{ fontSize: 24, marginBottom: 8 }} />
                                    {r.name}
                                </Button>
                            ))}
                        </div>
                    </Space>
                </Card>
            </div>
        );
    }

    if (isSessionLoading) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
                <Spin size="large" />
                <Title level={3} style={{ marginTop: 20 }}>Cargando POS...</Title>
                <Button type="link" onClick={() => setRegisterId('')}>Cambiar Caja</Button>
            </div>
        );
    }

    return (
        <Layout style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <POSHeader onCajaClick={handleCajaClick} />

            {activeSession?.status === 'AWAITING_CLOSE' && (
                <div style={{ padding: '0 20px', marginTop: 10 }}>
                    <Alert
                        message="CIERRE EN PROCESO"
                        description="Ha solicitado el cierre de caja. Por favor, espere a que el administrador autorice su arqueo para poder salir o continuar."
                        type="warning"
                        showIcon
                    />
                </div>
            )}

            {!isMobile ? (
                <Layout
                    style={{
                        flex: 1,
                        overflow: 'hidden',
                        opacity: activeSession?.status === 'AWAITING_CLOSE' ? 0.5 : 1,
                        pointerEvents: activeSession?.status === 'AWAITING_CLOSE' ? 'none' : 'auto'
                    }}
                >
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
                                onCajaClick={handleCajaClick}
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
                            onCajaClick={handleCajaClick}
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

            <SessionSummaryModal
                open={isSummaryOpen}
                session={activeSession || null}
                onCancel={() => setIsSummaryOpen(false)}
                onStartClose={() => {
                    setIsSummaryOpen(false);
                    setIsClosingArqueoOpen(true);
                }}
            />

            <CashCountModal
                mode="OPENING"
                open={isOpeningArqueoOpen}
                sessionId={activeSession?.id || ''}
                openingBalance={Number(activeSession?.openingBalance || 0)}
                onSuccess={() => {
                    setIsOpeningArqueoOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['activeSession'] });
                }}
                onCancel={() => setIsOpeningArqueoOpen(false)}
            />

            <CashCountModal
                mode="CLOSING"
                open={isClosingArqueoOpen}
                sessionId={activeSession?.id || ''}
                openingBalance={0}
                expectedBalance={calculateExpectedBalance()}
                onSuccess={() => {
                    setIsClosingArqueoOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['activeSession'] });
                }}
                onCancel={() => setIsClosingArqueoOpen(false)}
            />
        </Layout>
    );
};
