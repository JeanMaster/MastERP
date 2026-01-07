import { Layout, Typography, Row, Col, Space, Popover, Grid, Button } from 'antd';
import { useState, useEffect } from 'react';
import { usePOSStore } from '../../../store/posStore';
import { SyncOutlined } from '@ant-design/icons';
import { formatVenezuelanPrice, formatVenezuelanPriceOnly } from '../../../utils/formatters';
import { ClientPurchaseHistoryCompact } from '../../../components/ClientPurchaseHistory';

const { Header } = Layout;
const { Title, Text } = Typography;

export const POSHeader = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const { totals, activeCustomer, customerId, preferredSecondaryCurrency, currencies, primaryCurrency, nextInvoiceNumber, initialize } = usePOSStore();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleSync = async () => {
        setIsRefreshing(true);
        try {
            await initialize();
        } finally {
            setIsRefreshing(false);
        }
    };
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

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
                    </div>
                </Col>
            </Row>
        </Header>
    );
};
