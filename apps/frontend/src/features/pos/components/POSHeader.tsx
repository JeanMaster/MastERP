import { Layout, Typography, Row, Col, Space, Popover, Grid, Button, Tooltip, Tag, Alert } from 'antd';
import { useState, useEffect } from 'react';
import { usePOSStore } from '../../../store/posStore';
import { SyncOutlined, LogoutOutlined, FullscreenOutlined, FullscreenExitOutlined, ShopOutlined } from '@ant-design/icons';
import { cashRegisterApi } from '../../../services/cashRegisterApi';
import { formatVenezuelanPrice, formatVenezuelanPriceOnly } from '../../../utils/formatters';
import { ClientPurchaseHistoryCompact } from '../../../components/ClientPurchaseHistory';
import { useAuth } from '../../auth/AuthProvider';

import { useQuery } from '@tanstack/react-query';

const { Header } = Layout;
const { Title, Text } = Typography;

export const POSHeader = ({ onCajaClick }: { onCajaClick?: () => void }) => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const { user, logout } = useAuth();
    const { totals, activeCustomer, customerId, preferredSecondaryCurrency, currencies, primaryCurrency, nextInvoiceNumber, initialize } = usePOSStore();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Fetch active session to check status
    const { data: activeSession } = useQuery({
        queryKey: ['activeSession'],
        queryFn: () => cashRegisterApi.getActiveSession()
    });

    const handleSync = async () => {
        setIsRefreshing(true);
        try {
            await initialize();
        } finally {
            setIsRefreshing(false);
        }
    };
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            clearInterval(timer);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    return (
        <Header style={{
            height: 'auto',
            minHeight: isMobile ? '60px' : '80px',
            background: '#ffffff',
            padding: isMobile ? '5px 10px' : '10px 20px',
            borderBottom: '1px solid #f0f0f0',
            lineHeight: 'normal',
            display: 'flex',
            alignItems: 'center',
            zIndex: 10
        }}>
            <Row style={{ width: '100%' }} align="middle" justify="space-between" gutter={[8, 8]}>
                {/* Izquierda: Info Contextual */}
                <Col xs={14} md={12}>
                    <Space size={isMobile ? "small" : "large"} wrap={!isMobile}>
                        {!isMobile && (
                            <>
                                <Space direction="vertical" size={0}>
                                    <Text type="secondary" style={{ fontSize: 10 }}>Fecha</Text>
                                    <Text strong style={{ fontSize: 13 }}>{currentTime.toLocaleDateString()}</Text>
                                </Space>
                                <Space direction="vertical" size={0}>
                                    <Text type="secondary" style={{ fontSize: 10 }}>Hora</Text>
                                    <Text strong style={{ fontSize: 13 }}>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                </Space>
                            </>
                        )}
                        <Space direction="vertical" size={0}>
                            <Text type="secondary" style={{ fontSize: 10 }}>Cliente</Text>
                            <Space size={4}>
                                <Text strong style={{ fontSize: isMobile ? 12 : 16 }}>{activeCustomer}</Text>
                                {customerId && !isMobile && <ClientPurchaseHistoryCompact clientId={customerId} />}
                            </Space>
                        </Space>
                        {!isMobile && (
                            <Space direction="vertical" size={0}>
                                <Text type="secondary" style={{ fontSize: 10 }}>Factura</Text>
                                <Text strong style={{ fontSize: 16, color: '#1890ff' }}>{nextInvoiceNumber}</Text>
                            </Space>
                        )}

                        {(!activeSession || (activeSession.cashierId === user?.username && !activeSession.verifiedAt)) && (
                            <div style={{ marginLeft: isMobile ? 0 : 20, flex: 1 }}>
                                <Alert
                                    message={
                                        !activeSession
                                            ? (user?.role === 'ADMIN' ? "MODO ADMINISTRADOR" : "ADVERTENCIA: CAJA NO ABIERTA")
                                            : "ARQUEO PENDIENTE"
                                    }
                                    description={
                                        !activeSession
                                            ? (user?.role === 'ADMIN' ? "Operando sin sesión de caja" : "SOLICITAR APERTURA")
                                            : "Realice apertura"
                                    }
                                    type={user?.role === 'ADMIN' && !activeSession ? "info" : "warning"}
                                    showIcon
                                    banner
                                    style={{
                                        borderRadius: 8,
                                        padding: '4px 12px',
                                        fontSize: isMobile ? 10 : 12,
                                        fontWeight: 'bold'
                                    }}
                                />
                            </div>
                        )}
                    </Space>
                </Col>

                {/* Derecha: Totales */}
                <Col xs={10} md={12} style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: isMobile ? 8 : 24 }}>
                        {!isMobile && (
                            <>
                                <div style={{ textAlign: 'right' }}>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Subtotal</Text>
                                    <Text style={{ fontSize: 16 }}>{formatVenezuelanPriceOnly(totals.subtotal)}</Text>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>I.V.A.</Text>
                                    <Text style={{ fontSize: 16 }}>{formatVenezuelanPriceOnly(totals.tax)}</Text>
                                </div>
                            </>
                        )}

                        <Popover
                            placement="bottomRight"
                            title="Otras Monedas"
                            content={
                                <div style={{ minWidth: 200 }}>
                                    <div style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', marginBottom: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text type="secondary">Subtotal:</Text>
                                            <Text>{formatVenezuelanPrice(totals.subtotal, 'Bs')}</Text>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <Text type="secondary">I.V.A.:</Text>
                                            <Text>{formatVenezuelanPrice(totals.tax, 'Bs')}</Text>
                                        </div>
                                    </div>
                                    {currencies
                                        .filter(c => c.id !== primaryCurrency?.id && c.code !== preferredSecondaryCurrency?.code)
                                        .map(currency => {
                                            const rate = Number(currency.exchangeRate || 0);
                                            const amount = rate > 0 ? totals.total / rate : 0;
                                            return (
                                                <div key={currency.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                                                    <span>{currency.name} ({currency.symbol})</span>
                                                    <strong style={{ color: '#1890ff' }}>{formatVenezuelanPriceOnly(amount)}</strong>
                                                </div>
                                            );
                                        })
                                    }
                                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                                        <Button
                                            type="primary"
                                            ghost
                                            size="small"
                                            icon={<SyncOutlined spin={isRefreshing} />}
                                            onClick={handleSync}
                                            loading={isRefreshing}
                                            style={{ width: '100%' }}
                                        >
                                            Sincronizar Tasas
                                        </Button>
                                    </div>
                                </div>
                            }
                        >
                            <div style={{
                                background: '#e6f7ff',
                                padding: isMobile ? '2px 8px' : '5px 15px',
                                borderRadius: 8,
                                border: '1px solid #91caff',
                                textAlign: 'right',
                                cursor: 'help'
                            }}>
                                <Text type="secondary" style={{ fontSize: isMobile ? 9 : 11, display: 'block' }}>Total</Text>
                                <Title level={isMobile ? 5 : 2} style={{ margin: 0, color: '#096dd9', lineHeight: 1 }}>
                                    {formatVenezuelanPrice(totals.total, isMobile ? '' : 'Bs')}
                                </Title>
                                <Text type="secondary" style={{ fontSize: isMobile ? 10 : 12 }}>
                                    {formatVenezuelanPrice(totals.totalUsd, preferredSecondaryCurrency?.symbol || '$')}
                                </Text>
                            </div>
                        </Popover>

                        <Tooltip title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa (Modo Kiosco)"}>
                            <Button
                                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                                onClick={toggleFullscreen}
                                size={isMobile ? "small" : "middle"}
                            />
                        </Tooltip>

                        {user?.role === 'CASHIER' && (
                            <Space size="small">
                                {activeSession?.status === 'OPEN' ? (
                                    <Button
                                        type="primary"
                                        icon={<ShopOutlined />}
                                        onClick={onCajaClick}
                                        size={isMobile ? "small" : "middle"}
                                        style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                                    >
                                        {!isMobile && 'Caja'}
                                    </Button>
                                ) : (
                                    <Tag color="warning" icon={<SyncOutlined spin />}>
                                        Cierre Pendiente
                                    </Tag>
                                )}
                                <Button
                                    danger
                                    type="primary"
                                    icon={<LogoutOutlined />}
                                    onClick={logout}
                                    size={isMobile ? "small" : "middle"}
                                    title="Cerrar Sesión"
                                >
                                    {!isMobile && 'Salir'}
                                </Button>
                            </Space>
                        )}
                    </div>
                </Col>
            </Row>
        </Header>
    );
};
