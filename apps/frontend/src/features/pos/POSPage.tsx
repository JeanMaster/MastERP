import { useState, useEffect, useRef } from 'react';
import { Layout, Typography, Spin, Alert, Tabs, Grid, Card, Space, Button, Empty, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { ShoppingCartOutlined, AppstoreOutlined, ShopOutlined } from '@ant-design/icons';
import { POSHeader } from './components/POSHeader';
import { POSLeftPanel } from './components/POSLeftPanel';
import { POSRightPanel } from './components/POSRightPanel';
import { POSFooter } from './components/POSFooter';
import { CheckoutModal } from './components/CheckoutModal';
import { ClientSelectionModal } from './components/ClientSelectionModal';
import { InvoiceModal } from './components/InvoiceModal';
import { CouponModal } from './components/CouponModal';
import { usePOSStore } from '../../store/posStore';
import { cashRegisterApi } from '../../services/cashRegisterApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import type { Sale } from '../../services/salesApi';
import { SessionSummaryModal } from './components/SessionSummaryModal';
import { CashCountModal } from '../cash-register/components/CashCountModal';

const { Text, Title } = Typography;
const { Content, Sider, Footer } = Layout;
const { useBreakpoint } = Grid;

/**
 * POSPage Component
 * Main Point of Sale interface.
 * Orchestrates product selection, cart management, checkout, and cash register session lifecycle.
 */
export const POSPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const navigate = useNavigate();
    const { user } = useAuth();
    const [registerId, setRegisterId] = useState<string>(localStorage.getItem('pos_register_id') || '');
    const [activeTab, setActiveTab] = useState('catalog');
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [completedSale, setCompletedSale] = useState<Sale | null>(null);
    const { processSale, setCustomer, refreshInvoiceNumber, initialize, resetPOS } = usePOSStore();
    const queryClient = useQueryClient();

    const [isSummaryOpen, setIsSummaryOpen] = useState(false);
    const [isOpeningArqueoOpen, setIsOpeningArqueoOpen] = useState(false);
    const [isClosingArqueoOpen, setIsClosingArqueoOpen] = useState(false);

    // Fetch available cash registers for selection (Admin only or if none selected)
    const { data: registers = [] } = useQuery({
        queryKey: ['cashRegisters'],
        queryFn: () => cashRegisterApi.listRegisters(),
        enabled: user?.role === 'ADMIN' || !registerId
    });

    // Fetch active session (shifts) for the selected register or current cashier
    const { data: activeSession, isLoading: isSessionLoading, isFetching, refetch: refetchSession } = useQuery({
        queryKey: ['activeSession', registerId, user?.username],
        queryFn: () => {
            if (user?.role === 'CASHIER') {
                return cashRegisterApi.getActiveSession(undefined, user.username);
            }
            return cashRegisterApi.getActiveSession(registerId);
        },
        enabled: !!registerId || user?.role === 'CASHIER'
    });

    const redirectedRef = useRef(false);

    // Synchronize register selection for cashiers based on server-side assignment
    useEffect(() => {
        if (user?.role === 'CASHIER' && !isSessionLoading && !isFetching) {
            if (activeSession) {
                if (registerId !== activeSession.registerId) {
                    setRegisterId(activeSession.registerId);
                    localStorage.setItem('pos_register_id', activeSession.registerId);
                }
            } else if (registerId) {
                setRegisterId('');
                localStorage.removeItem('pos_register_id');
            }
        }
    }, [activeSession, user, registerId, isSessionLoading, isFetching]);

    // Session validation and alerts
    useEffect(() => {
        if (!isSessionLoading && !isFetching && !redirectedRef.current) {
            if (!activeSession) {
                if (user?.role === 'CASHIER') {
                    message.error(t('pos.messages.no_register_assigned'), 0);
                } else {
                    message.info(t('pos.messages.admin_mode_info'), 5);
                }
            } else {
                const isAssignedCashier = activeSession.cashierId === user?.username;
                if (isAssignedCashier && !activeSession.verifiedAt) {
                    message.warning(t('pos.messages.welcome_cash_count', { name: user?.name }), 10);
                }
            }
        }
    }, [activeSession, isSessionLoading, isFetching, navigate, user, registerId]);

    /**
     * Handles cash register management logic (Opening/Closing counts).
     */
    const handleCajaClick = async () => {
        const hide = message.loading(t('pos.messages.syncing_state'), 0);
        try {
            const { data: freshSession } = await refetchSession();

            if (!freshSession) {
                message.error(t('pos.messages.register_not_open'));
                return;
            }

            if (!freshSession.verifiedAt && freshSession.cashierId === user?.username) {
                // Perform opening verification
                setIsOpeningArqueoOpen(true);
            } else {
                // View session summary
                setIsSummaryOpen(true);
            }
        } catch (error) {
            message.error(t('pos.messages.sync_error'));
        } finally {
            hide();
        }
    };

    /**
     * Calculates the dynamically expected balance based on shifts and movements.
     */
    const calculateExpectedBalance = () => {
        if (!activeSession) return 0;

        let sales = 0;
        let expenses = 0;
        let deposits = 0;
        let withdrawals = 0;

        activeSession.movements?.forEach((movement: any) => {
            const rawAmount = Number(movement.amount || 0);
            const rawRate = Number(movement.exchangeRate);
            const rate = (!isNaN(rawRate) && rawRate > 0) ? rawRate : 1;
            const amountInBs = rawAmount * rate;
            const type = String(movement.type).trim();

            switch (type) {
                case 'SALE': sales += amountInBs; break;
                case 'EXPENSE': expenses += amountInBs; break;
                case 'DEPOSIT': deposits += amountInBs; break;
                case 'WITHDRAWAL': withdrawals += amountInBs; break;
                case 'CHANGE': sales -= amountInBs; break;
                case 'ADJUSTMENT':
                    if (amountInBs > 0) withdrawals += amountInBs;
                    else deposits += Math.abs(amountInBs);
                    break;
            }
        });

        const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
        return round(Number(activeSession.openingBalance) + sales + withdrawals - expenses - deposits);
    };

    const handleCheckoutProcess = async (paymentData: any) => {
        try {
            const sale = await processSale(paymentData, activeSession?.id);
            message.success(t('pos.messages.sale_success', { invoice: sale.invoiceNumber }));
            setIsCheckoutOpen(false);
            setCompletedSale(sale);
            setIsInvoiceModalOpen(true);
            await refreshInvoiceNumber();
        } catch (error) {
            message.error(t('pos.messages.sale_error'));
            console.error('Sale processing error:', error);
        }
    };

    // Keyboard shortcuts (F2: Coupons, F3: Customer, F9: Checkout, F10: Cash Register, Del: Clear POS)
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'F2') {
            e.preventDefault();
            setIsCouponModalOpen(true);
        } else if (e.key === 'F3') {
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
            setIsCheckoutOpen(false);
        }
        initialize();
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeSession?.status]);

    const handleSelectRegister = (id: string) => {
        setRegisterId(id);
        localStorage.setItem('pos_register_id', id);
    };

    // Initial state rendering (Register selection or loading)
    if (!registerId) {
        if (user?.role === 'CASHIER') {
            if (isSessionLoading) {
                return (
                    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5' }}>
                        <Spin size="large" />
                        <Title level={3} style={{ marginTop: 20 }}>{t('pos.messages.finding_register')}</Title>
                    </div>
                );
            }

            return (
                <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5', padding: 20 }}>
                    <Card style={{ width: '100%', maxWidth: 500, textAlign: 'center' }}>
                        <Empty
                            description={
                                <Title level={4}>{t('pos.messages.no_register_assigned_title')}</Title>
                            }
                        >
                            <Text type="secondary">{t('pos.messages.no_register_assigned_desc')}</Text>
                            <div style={{ marginTop: 24 }}>
                                <Button type="primary" onClick={() => queryClient.invalidateQueries({ queryKey: ['activeSession'] })}>
                                    {t('pos.messages.retry_connection')}
                                </Button>
                            </div>
                        </Empty>
                    </Card>
                </div>
            );
        }

        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f0f2f5', padding: 20 }}>
                <Card title={<Title level={3} style={{ margin: 0 }}>{t('pos.messages.select_register_title')}</Title>} style={{ width: '100%', maxWidth: 500, textAlign: 'center' }}>
                    <Space direction="vertical" style={{ width: '100%' }} size="large">
                        <Text type="secondary">{t('pos.messages.select_register_desc')}</Text>
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
                <Title level={3} style={{ marginTop: 20 }}>{t('pos.messages.loading_pos')}</Title>
                <Button type="link" onClick={() => setRegisterId('')}>{t('pos.messages.change_register')}</Button>
            </div>
        );
    }

    return (
        <Layout style={{ height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <POSHeader onCajaClick={handleCajaClick} />

            {activeSession?.status === 'AWAITING_CLOSE' && (
                <div style={{ padding: '0 20px', marginTop: 10 }}>
                    <Alert
                        message={t('pos.messages.closure_in_progress')}
                        description={t('pos.messages.closure_requested')}
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
                                onCouponClick={() => setIsCouponModalOpen(true)}
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
                                        {t('pos.catalog.departments') || 'Catalog'}
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
                                        {t('pos.footer.items') || 'Cart'}
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
                            onCouponClick={() => setIsCouponModalOpen(true)}
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

            <CouponModal
                open={isCouponModalOpen}
                onOk={() => setIsCouponModalOpen(false)}
                onCancel={() => setIsCouponModalOpen(false)}
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
