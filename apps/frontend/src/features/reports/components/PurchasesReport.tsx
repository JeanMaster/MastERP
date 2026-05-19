import { useState, useEffect } from 'react';
import { Card, Typography, DatePicker, Row, Col, Statistic, Table, Grid } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { statsApi } from '../../../services/statsApi';
import { usePOSStore } from '../../../store/posStore';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { ReportCurrencySelector } from './ReportCurrencySelector';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

export const PurchasesReport = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const { primaryCurrency, currencies } = usePOSStore();
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([dayjs().startOf('month'), dayjs().endOf('month')]);

    const currentCurrencyObj = currencies.find(c => c.code === selectedCurrency);
    const currencySymbol = currentCurrencyObj?.symbol || 'Bs';

    // Initialize to primary
    useEffect(() => {
        if (primaryCurrency && selectedCurrency === 'VES') {
            setSelectedCurrency(primaryCurrency.code);
        }
    }, [primaryCurrency]);

    const startDate = dateRange?.[0]?.format('YYYY-MM-DD');
    const endDate = dateRange?.[1]?.format('YYYY-MM-DD');

    const { data: purchasesData, isLoading } = useQuery({
        queryKey: ['purchasesReport', selectedCurrency, startDate, endDate],
        queryFn: () => statsApi.getPurchasesReport(selectedCurrency, startDate, endDate),
        enabled: !!selectedCurrency
    });

    const supplierColumns = [
        {
            title: 'Proveedor',
            dataIndex: 'supplier',
            key: 'supplier',
        },
        {
            title: 'Monto Total Comprado',
            dataIndex: 'amount',
            key: 'amount',
            align: 'right' as const,
            render: (val: number) => formatVenezuelanPrice(val, currencySymbol),
        },
    ];

    return (
        <div style={{ padding: '0px' }}>
            {/* Header and Controls */}
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col xs={24} lg={10}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Historial de Compras</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Análisis de inversión y abastecimiento.</Text>
                    </Col>
                    <Col xs={24} lg={14} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <div style={{ minWidth: 150 }}>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>MONEDA</Text>
                                <ReportCurrencySelector
                                    value={selectedCurrency}
                                    onChange={setSelectedCurrency}
                                />
                            </div>
                            <div style={{ minWidth: isMobile ? '100%' : 280 }}>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>PERÍODO</Text>
                                <RangePicker 
                                    value={dateRange} 
                                    onChange={(dates: any) => setDateRange(dates)} 
                                    allowClear={false}
                                    style={{ width: '100%' }}
                                    size="large"
                                />
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>

            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={8}>
                    <Card variant="borderless" loading={isLoading} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#e6f7ff' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>TOTAL COMPRAS</Text>}
                            value={purchasesData?.totalPurchases || 0}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#1890ff', fontSize: isMobile ? 22 : 26, fontWeight: 800 } }}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card variant="borderless" loading={isLoading} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fff7e6' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>COGS (Costo Ventas)</Text>}
                            value={purchasesData?.totalCOGS || 0}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#faad14', fontSize: isMobile ? 22 : 26, fontWeight: 800 } }}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card variant="borderless" loading={isLoading} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: (purchasesData?.inventoryDelta ?? 0) >= 0 ? '#f6ffed' : '#fff1f0' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>DELTA INVENTARIO</Text>}
                            value={purchasesData?.inventoryDelta || 0}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: (purchasesData?.inventoryDelta ?? 0) >= 0 ? '#52c41a' : '#ff4d4f', fontSize: isMobile ? 22 : 26, fontWeight: 800 } }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card 
                title={<Text strong>Tendencia de Inversión</Text>} 
                variant="borderless" 
                style={{ marginBottom: 24, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                styles={{ body: { padding: isMobile ? 8 : 24 } }}
                loading={isLoading}
            >
                <div style={{ height: isMobile ? 250 : 350, minHeight: isMobile ? 250 : 350, width: '100%', minWidth: 0, position: 'relative' }}>
                    {(purchasesData?.dailyPurchases?.length ?? 0) > 0 ? (
                        <ResponsiveContainer minWidth={0} width="100%" height="100%" debounce={50}>
                            <AreaChart data={purchasesData?.dailyPurchases}>
                                <defs>
                                    <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#fa8c16" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#fa8c16" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis 
                                    dataKey="date" 
                                    fontSize={10}
                                    tickFormatter={(val) => dayjs(val).format('DD/MM')} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis 
                                    fontSize={10}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(val) => isMobile ? `${(val/1000).toFixed(0)}k` : val.toLocaleString()}
                                />
                                <Tooltip 
                                    labelFormatter={(label) => dayjs(label).format('DD MMMM YYYY')}
                                    formatter={(value: any) => [formatVenezuelanPrice(value, currencySymbol), 'Compras']}
                                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Area 
                                    type="monotone" 
                                    dataKey="amount" 
                                    stroke="#fa8c16" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorPurchases)" 
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c' }}>
                            No hay compras registradas en este período
                        </div>
                    )}
                </div>
            </Card>

            <Card 
                title={<Text strong>Desglose por Proveedor</Text>} 
                variant="borderless" 
                style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                styles={{ body: { padding: isMobile ? 8 : 24 } }}
                loading={isLoading}
            >
                {!isMobile ? (
                    <Table
                        columns={supplierColumns}
                        dataSource={purchasesData?.purchasesBySupplier || []}
                        rowKey="supplier"
                        loading={isLoading}
                        size="middle"
                        pagination={{ 
                            defaultPageSize: 10, 
                            showSizeChanger: true, 
                            pageSizeOptions: ['10', '20', '50'] 
                        }}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {(purchasesData?.purchasesBySupplier || []).map((item: any) => (
                            <Card key={item.supplier} variant="borderless" style={{ borderRadius: 12, background: '#fafafa' }} styles={{ body: { padding: 16 } }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <Text strong style={{ fontSize: 14 }}>{item.supplier}</Text>
                                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>Total Invertido</div>
                                    </div>
                                    <Text strong style={{ color: '#1890ff', fontSize: 16 }}>
                                        {formatVenezuelanPrice(item.amount, currencySymbol)}
                                    </Text>
                                </div>
                            </Card>
                        ))}
                        {(purchasesData?.purchasesBySupplier || []).length === 0 && (
                            <div style={{ padding: 40, textAlign: 'center' }}>
                                <Text type="secondary">No hay datos de proveedores</Text>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </div>
    );
};
