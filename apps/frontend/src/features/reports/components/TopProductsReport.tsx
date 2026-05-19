import { useState, useEffect } from 'react';
import { Table, DatePicker, Segmented, Row, Col, Select, Tag, Typography, Grid, Card, Divider } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { statsApi, type TopProduct } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { usePOSStore } from '../../../store/posStore';
import { ReportCurrencySelector } from './ReportCurrencySelector';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

export const TopProductsReport = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const { currencies, primaryCurrency } = usePOSStore();
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');

    // Find symbol for selected currency
    const currentCurrencyObj = currencies.find(c => c.code === selectedCurrency);
    const currencySymbol = currentCurrencyObj?.symbol || 'Bs';

    // Initialize currency to primary if available
    useEffect(() => {
        if (primaryCurrency && selectedCurrency === 'VES') {
            setSelectedCurrency(primaryCurrency.code);
        }
    }, [primaryCurrency]);

    const [dates, setDates] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().subtract(30, 'days'),
        dayjs()
    ]);
    const [sortBy, setSortBy] = useState<'units' | 'profit'>('units');
    const [limit, setLimit] = useState(10);

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['top-products', dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'), sortBy, limit, selectedCurrency],
        queryFn: () => statsApi.getTopProducts({
            startDate: dates[0].format('YYYY-MM-DD'),
            endDate: dates[1].format('YYYY-MM-DD'),
            sortBy,
            limit,
            currency: selectedCurrency
        })
    });

    const columns = [
        {
            title: '#',
            key: 'rank',
            width: 60,
            render: (_: any, __: any, index: number) => (
                <div style={{
                    fontWeight: 'bold',
                    color: index < 3 ? '#cf1322' : '#595959',
                    fontSize: index < 3 ? 16 : 14
                }}>
                    {index + 1}
                </div>
            )
        },
        {
            title: 'Producto',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Unidades Vendidas',
            dataIndex: 'units',
            key: 'units',
            sorter: (a: TopProduct, b: TopProduct) => a.units - b.units,
            render: (value: number) => (
                <Tag color="blue" style={{ fontSize: 14 }}>
                    {value}
                </Tag>
            )
        },
        {
            title: 'Ingresos Totales',
            dataIndex: 'revenue',
            key: 'revenue',
            align: 'right' as const,
            render: (value: number) => formatVenezuelanPrice(value, currencySymbol)
        },
        {
            title: 'Costo Total',
            dataIndex: 'totalCost',
            key: 'totalCost',
            align: 'right' as const,
            render: (value: number) => (
                <span style={{ color: '#8c8c8c' }}>
                    {formatVenezuelanPrice(value, currencySymbol)}
                </span>
            )
        },
        {
            title: 'Margen %',
            dataIndex: 'margin',
            key: 'margin',
            align: 'right' as const,
            render: (value: number) => (
                <Tag color={value >= 30 ? 'green' : value >= 15 ? 'orange' : 'red'}>
                    {value.toFixed(2)}%
                </Tag>
            )
        },
        {
            title: 'Ganancia Estimada',
            dataIndex: 'profit',
            key: 'profit',
            align: 'right' as const,
            render: (value: number) => (
                <span style={{
                    color: value >= 0 ? '#389e0d' : '#cf1322',
                    fontWeight: 'bold'
                }}>
                    {formatVenezuelanPrice(value, currencySymbol)}
                </span>
            )
        }
    ];

    return (
        <div style={{ padding: isMobile ? '0px' : '0px' }}>
            {/* Header section */}
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row gutter={[16, 24]} align="middle">
                    <Col xs={24} lg={12}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Top Productos</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Análisis de rendimiento y rentabilidad por producto.</Text>
                    </Col>
                    <Col xs={24} lg={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <div>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>RANGO DE FECHAS</Text>
                                <RangePicker
                                    value={dates}
                                    onChange={(vals) => {
                                        if (vals && vals[0] && vals[1]) {
                                            setDates([vals[0], vals[1]]);
                                        }
                                    }}
                                    style={{ width: '100%', borderRadius: 8 }}
                                    allowClear={false}
                                    size="large"
                                />
                            </div>
                        </div>
                    </Col>
                </Row>
                
                <Divider style={{ margin: '20px 0' }} />
                
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} lg={8}>
                        <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 11, color: '#8c8c8c' }}>ORDENAR POR</Text>
                        <Segmented
                            options={[
                                { label: 'Unidades', value: 'units' },
                                { label: 'Ganancia', value: 'profit' }
                            ]}
                            value={sortBy}
                            onChange={(val) => setSortBy(val as 'units' | 'profit')}
                            block
                            size="large"
                            style={{ borderRadius: 8, padding: 4 }}
                        />
                    </Col>
                    <Col xs={12} lg={8}>
                        <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 11, color: '#8c8c8c' }}>MONEDA</Text>
                        <ReportCurrencySelector
                            value={selectedCurrency}
                            onChange={setSelectedCurrency}
                        />
                    </Col>
                    <Col xs={12} lg={8}>
                        <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 11, color: '#8c8c8c' }}>MOSTRAR</Text>
                        <Select
                            value={limit}
                            onChange={setLimit}
                            options={[
                                { label: 'Top 10', value: 10 },
                                { label: 'Top 20', value: 20 },
                                { label: 'Top 50', value: 50 },
                                { label: 'Top 100', value: 100 },
                            ]}
                            style={{ width: '100%' }}
                            size="large"
                        />
                    </Col>
                </Row>
            </div>

            {!isMobile ? (
                <Table
                    columns={columns}
                    dataSource={products}
                    rowKey="id"
                    loading={isLoading}
                    pagination={false}
                    bordered={false}
                    style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    summary={(pageData) => {
                        const totalProfit = pageData.reduce((acc, curr) => acc + curr.profit, 0);
                        const totalUnits = pageData.reduce((acc, curr) => acc + curr.units, 0);
                        const totalRevenue = pageData.reduce((acc, curr) => acc + curr.revenue, 0);
                        const totalCost = pageData.reduce((acc, curr) => acc + curr.totalCost, 0);
                        const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

                        return (
                            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                                <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
                                <Table.Summary.Cell index={1}>-</Table.Summary.Cell>
                                <Table.Summary.Cell index={2}>
                                    {totalUnits} Unidades
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={3} align="right">
                                    {formatVenezuelanPrice(totalRevenue, currencySymbol)}
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={4} align="right">
                                    {formatVenezuelanPrice(totalCost, currencySymbol)}
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={5} align="right">
                                    {avgMargin.toFixed(2)}%
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={6} align="right">
                                    {formatVenezuelanPrice(totalProfit, currencySymbol)}
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                        );
                    }}
                />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {products.map((item: any, index: number) => (
                        <Card 
                            key={item.id} 
                            variant="borderless"
                            styles={{ body: { padding: 16 } }}
                            style={{ 
                                borderRadius: 16, 
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)', 
                                borderLeft: index < 3 ? `4px solid ${index === 0 ? '#faad14' : index === 1 ? '#bfbfbf' : '#d46b08'}` : 'none',
                                background: '#fff'
                            }}
                        >
                            <Row gutter={16} align="top">
                                <Col span={4}>
                                    <div style={{ 
                                        width: 32, 
                                        height: 32, 
                                        borderRadius: '50%', 
                                        background: index === 0 ? '#fffbe6' : index === 1 ? '#f5f5f5' : index === 2 ? '#fff7e6' : '#f0f0f0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        color: index === 0 ? '#faad14' : index === 1 ? '#8c8c8c' : index === 2 ? '#d46b08' : '#595959',
                                        fontSize: 16,
                                        boxShadow: index < 3 ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                                    }}>
                                        {index + 1}
                                    </div>
                                </Col>
                                <Col span={20}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <div style={{ maxWidth: '70%' }}>
                                            <Text strong style={{ fontSize: 15, lineHeight: 1.2, display: 'block' }}>{item.name}</Text>
                                            <Text type="secondary" style={{ fontSize: 11 }}>Rendimiento #{index + 1}</Text>
                                        </div>
                                        <Tag color="blue" style={{ margin: 0, borderRadius: 6, fontWeight: 700 }}>{item.units} UDS</Tag>
                                    </div>
                                    
                                    <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
                                        <Col span={12}>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase' }}>Ingreso</Text>
                                            <Text strong style={{ fontSize: 13 }}>{formatVenezuelanPrice(item.revenue, currencySymbol)}</Text>
                                        </Col>
                                        <Col span={12} style={{ textAlign: 'right' }}>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase' }}>Margen</Text>
                                            <Text strong style={{ fontSize: 13, color: item.margin >= 30 ? '#389e0d' : item.margin >= 15 ? '#faad14' : '#cf1322' }}>
                                                {item.margin.toFixed(1)}%
                                            </Text>
                                        </Col>
                                    </Row>
                                    
                                    <div style={{ marginTop: 12, padding: '10px 12px', background: '#f6ffed', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #d9f7be' }}>
                                        <Text style={{ fontSize: 11, color: '#389e0d', fontWeight: 600 }}>GANANCIA:</Text>
                                        <Text strong style={{ fontSize: 15, color: '#389e0d' }}>
                                            {formatVenezuelanPrice(item.profit, currencySymbol)}
                                        </Text>
                                    </div>
                                </Col>
                            </Row>
                        </Card>
                    ))}
                    
                    {/* Summary Card for Mobile */}
                    <Card variant="borderless" style={{ background: '#fff', borderRadius: 16, marginTop: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Title level={5} style={{ margin: 0, marginBottom: 16, textAlign: 'center' }}>Resumen Totales</Title>
                        <Row gutter={[16, 16]}>
                            <Col span={12}>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Total Unidades:</Text>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>{products.reduce((acc: number, curr: any) => acc + curr.units, 0)}</div>
                            </Col>
                            <Col span={12} style={{ textAlign: 'right' }}>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Total Ingresos:</Text>
                                <div style={{ fontWeight: 700, fontSize: 16 }}>{formatVenezuelanPrice(products.reduce((acc: number, curr: any) => acc + curr.revenue, 0), currencySymbol)}</div>
                            </Col>
                            <Col span={24}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0f5ff', padding: '12px 16px', borderRadius: 12 }}>
                                    <Text strong style={{ color: '#0050b3' }}>GANANCIA TOTAL:</Text>
                                    <Text strong style={{ color: '#0050b3', fontSize: 20 }}>
                                        {formatVenezuelanPrice(products.reduce((acc: number, curr: any) => acc + curr.profit, 0), currencySymbol)}
                                    </Text>
                                </div>
                            </Col>
                        </Row>
                    </Card>
                </div>
            )}
        </div>
    );
};
