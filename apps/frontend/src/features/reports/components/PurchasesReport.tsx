import { useState, useEffect } from 'react';
import { Card, Typography, Space, DatePicker, Row, Col, Statistic, Table } from 'antd';
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

const { Title } = Typography;
const { RangePicker } = DatePicker;

export const PurchasesReport = () => {
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
        <Card>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Title level={4} style={{ margin: 0 }}>Historial de Compras de Mercancía</Title>
                    <Space size="middle">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 'bold' }}>Moneda:</span>
                            <ReportCurrencySelector
                                value={selectedCurrency}
                                onChange={setSelectedCurrency}
                                style={{ width: 200 }}
                            />
                        </div>
                        <RangePicker 
                            value={dateRange} 
                            onChange={(dates: any) => setDateRange(dates)} 
                            allowClear={false}
                        />
                    </Space>
                </div>

                <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                        <Card size="small" loading={isLoading}>
                            <Statistic 
                                title="Total Invertido (Compras)" 
                                value={formatVenezuelanPrice(purchasesData?.totalPurchases || 0, currencySymbol)} 
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card size="small" loading={isLoading}>
                            <Statistic 
                                title="COGS (Costo de lo Vendido)" 
                                value={formatVenezuelanPrice(purchasesData?.totalCOGS || 0, currencySymbol)} 
                                valueStyle={{ color: '#faad14' }}
                            />
                        </Card>
                    </Col>
                    <Col xs={24} md={8}>
                        <Card size="small" loading={isLoading}>
                            <Statistic 
                                title="Variación Inventario (Neto)" 
                                value={formatVenezuelanPrice(purchasesData?.inventoryDelta || 0, currencySymbol)} 
                                valueStyle={{ color: (purchasesData?.inventoryDelta ?? 0) >= 0 ? '#1890ff' : '#ff4d4f' }}
                            />
                        </Card>
                    </Col>
                </Row>

                <div style={{ marginTop: 24 }}>
                    <Title level={5}>Tendencia de Compras</Title>
                    <Card size="small" loading={isLoading}>
                        <div style={{ height: 350, width: '100%' }}>
                            {(purchasesData?.dailyPurchases?.length ?? 0) > 0 ? (
                                <ResponsiveContainer>
                                    <AreaChart data={purchasesData?.dailyPurchases}>
                                        <defs>
                                            <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#fa8c16" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#fa8c16" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis 
                                            dataKey="date" 
                                            tickFormatter={(val) => dayjs(val).format('DD/MM')} 
                                        />
                                        <YAxis />
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <Tooltip 
                                            labelFormatter={(label) => dayjs(label).format('DD MMMM YYYY')}
                                            formatter={(value: any) => [formatVenezuelanPrice(value, currencySymbol), 'Compras']}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="amount" 
                                            stroke="#fa8c16" 
                                            fillOpacity={1} 
                                            fill="url(#colorPurchases)" 
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                                    No hay compras registradas en este período
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                <div style={{ marginTop: 24 }}>
                    <Title level={5}>Desglose por Proveedor</Title>
                    <Table
                        columns={supplierColumns}
                        dataSource={purchasesData?.purchasesBySupplier || []}
                        rowKey="supplier"
                        loading={isLoading}
                        size="small"
                        pagination={{ 
                            defaultPageSize: 10, 
                            showSizeChanger: true, 
                            pageSizeOptions: ['10', '20', '50'] 
                        }}
                    />
                </div>
            </Space>
        </Card>
    );
};
