import { Card, Table, Statistic, Row, Col, Typography, Tag, Space, Spin, Empty, Progress, Grid } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUpOutlined, ArrowDownOutlined, GlobalOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { ReportCurrencySelector } from './ReportCurrencySelector';
import { usePOSStore } from '../../../store/posStore';

const { Text, Title } = Typography;

/**
 * BalanceReports Component
 * Provides a comprehensive financial overview of the business.
 * Displays Income vs. Expenses (COGS, OpEx, Stock) across time, 
 * allowing the user to view data in different currencies (VES, USD, etc.) 
 * using historical exchange rates.
 */
export const BalanceReports = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const { currencies } = usePOSStore();

    const { data, isLoading, error } = useQuery({
        queryKey: ['balanceReport', selectedCurrency],
        queryFn: () => statsApi.getBalanceReport(selectedCurrency),
    });

    if (isLoading) return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;
    if (error || !data) return <Empty description="Error loading financial balance" />;

    const totalIncome = data.reduce((sum, item) => sum + item.income, 0);
    const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0);
    const totalPurchases = data.reduce((sum, item) => sum + (item.purchases || 0), 0);
    const totalCOGS = data.reduce((sum, item) => sum + (item.cogs || 0), 0);
    const netBalance = totalIncome - totalCOGS - totalExpenses;

    const currentCurrencyObj = currencies.find(c => c.code === selectedCurrency);
    const currencySymbol = currentCurrencyObj?.symbol || 'Bs';

    const columns = [
        {
            title: 'Month',
            dataIndex: 'month',
            key: 'month',
            render: (text: string) => <Text strong>{text}</Text>,
        },
        {
            title: 'Gross Revenue',
            dataIndex: 'income',
            key: 'income',
            render: (val: number) => <Text style={{ color: '#52c41a' }}>{formatVenezuelanPrice(val, currencySymbol)}</Text>,
            align: 'right' as const,
        },
        {
            title: 'COGS (Inventory Cost)',
            dataIndex: 'cogs',
            key: 'cogs',
            render: (val: number) => <Text style={{ color: '#1890ff' }}>{formatVenezuelanPrice(val, currencySymbol)}</Text>,
            align: 'right' as const,
        },
        {
            title: 'Stock Investment',
            dataIndex: 'purchases',
            key: 'purchases',
            render: (val: number | undefined) => <Text style={{ color: '#722ed1' }}>{formatVenezuelanPrice(val || 0, currencySymbol)}</Text>,
            align: 'right' as const,
        },
        {
            title: 'Operating Expenses',
            dataIndex: 'expenses',
            key: 'expenses',
            render: (val: number) => <Text style={{ color: '#ff4d4f' }}>{formatVenezuelanPrice(val, currencySymbol)}</Text>,
            align: 'right' as const,
        },
        {
            title: 'Op. Cost %',
            dataIndex: 'operatingCostRatio',
            key: 'operatingCostRatio',
            render: (val: number | undefined) => {
                const percent = val || 0;
                return (
                    <div style={{ width: 100 }}>
                        <Progress percent={percent} size="small" status={percent > 80 ? 'exception' : 'active'} showInfo={false} />
                        <Text type="secondary" style={{ fontSize: 11 }}>{percent.toFixed(1)}%</Text>
                    </div>
                );
            },
        },
        {
            title: 'Net Profit',
            dataIndex: 'total',
            key: 'total',
            render: (val: number) => (
                <Tag color={val >= 0 ? 'green' : 'red'} style={{ fontSize: '14px', padding: '4px 8px' }}>
                    {formatVenezuelanPrice(val, currencySymbol)}
                </Tag>
            ),
            align: 'right' as const,
        },
        {
            title: 'Profit Margin',
            dataIndex: 'profitMargin',
            key: 'profitMargin',
            render: (val: number | undefined) => {
                const margin = val || 0;
                return (
                    <Tag color={margin > 20 ? 'gold' : 'default'}>{margin.toFixed(1)}%</Tag>
                );
            },
            align: 'right' as const,
        },
    ];

    const filteredData = data.filter(item =>
        item.income > 0 || item.expenses > 0 || item.purchases > 0 || item.cogs > 0
    );

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row align="middle" justify="space-between" gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Balance Financiero</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Resumen de ingresos, costos y utilidad operativa anual.</Text>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <GlobalOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                            <div>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>MONEDA DEL REPORTE</Text>
                                <ReportCurrencySelector
                                    value={selectedCurrency}
                                    onChange={setSelectedCurrency}
                                    style={{ width: isMobile ? 140 : 180 }}
                                />
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>

            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>INGRESOS BRUTOS</Text>}
                            value={totalIncome}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#52c41a', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Total ventas</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>COSTO VENTAS</Text>}
                            value={totalCOGS}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#1890ff', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Inversión en stock</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>GASTOS OP.</Text>}
                            value={totalExpenses}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#ff4d4f', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Gastos operativos</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>COMPRAS</Text>}
                            value={totalPurchases}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#722ed1', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Inversión reposición</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card variant="borderless" style={{ background: '#f6ffed', borderRadius: 12, border: '1px solid #b7eb8f', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic 
                            title={<Text type="secondary" style={{ fontSize: 11 }}>BALANCE NETO DISPONIBLE</Text>}
                            value={netBalance} 
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: netBalance >= 0 ? '#52c41a' : '#cf1322', fontSize: isMobile ? 22 : 26, fontWeight: 800 } }}
                            suffix={netBalance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Fórmula: Ingresos - COGS - Gastos</Text>
                    </Card>
                </Col>
            </Row>

            <Card title={<Text strong>Flujo de Caja Anual (Ingresos vs Egresos)</Text>} variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', minWidth: 0 }}>
                <div style={{ height: isMobile ? 300 : 400, minWidth: 0, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                        <BarChart data={data} margin={{ top: 10, right: 10, left: isMobile ? -20 : 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                                dataKey="month" 
                                axisLine={false} 
                                tickLine={false} 
                                fontSize={10}
                                tickFormatter={(val) => isMobile ? val.substring(0, 3) : val}
                            />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                fontSize={10}
                                tickFormatter={(val) => isMobile ? `${(val/1000).toFixed(0)}k` : val.toLocaleString()}
                                width={isMobile ? 35 : 60}
                            />
                            <Tooltip 
                                formatter={(value: number) => [`${currencySymbol} ${formatVenezuelanPrice(value)}`, '']}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            {!isMobile && <Legend iconType="circle" verticalAlign="top" height={36} />}
                            <Bar name="Ventas" dataKey="income" fill="#52c41a" radius={[4, 4, 0, 0]} />
                            <Bar name="Costos" dataKey="cogs" fill="#1890ff" radius={[4, 4, 0, 0]} />
                            <Bar name="Gastos" dataKey="expenses" fill="#ff4d4f" radius={[4, 4, 0, 0]} />
                            <Bar name="Inversión" dataKey="purchases" fill="#722ed1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card 
                title={isMobile ? "Monthly Breakdown" : "Monthly Balance Breakdown"} 
                variant="borderless" 
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 24 }}
                styles={{ body: { padding: isMobile ? 0 : 24 } }}
            >
                {!isMobile ? (
                    <Table
                        dataSource={filteredData}
                        columns={columns}
                        pagination={false}
                        rowKey="month"
                        bordered
                        size="middle"
                        summary={(pageData) => {
                            let totalIncome = 0;
                            let totalExpenses = 0;
                            let totalPurchases = 0;
                            let totalCOGS = 0;

                            pageData.forEach(({ income, expenses, purchases, cogs }) => {
                                totalIncome += income;
                                totalExpenses += expenses;
                                totalPurchases += (purchases || 0);
                                totalCOGS += (cogs || 0);
                            });

                            const totalNetBalance = totalIncome - totalCOGS - totalExpenses;
                            const totalMargin = totalIncome > 0 ? (totalNetBalance / totalIncome) * 100 : 0;

                            return (
                                <Table.Summary fixed>
                                    <Table.Summary.Row style={{ background: '#fafafa' }}>
                                        <Table.Summary.Cell index={0}><Text strong>ANNUAL TOTAL</Text></Table.Summary.Cell>
                                        <Table.Summary.Cell index={1} align="right">
                                            <Text strong style={{ color: '#52c41a' }}>{formatVenezuelanPrice(totalIncome, currencySymbol)}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={2} align="right">
                                            <Text strong style={{ color: '#1890ff' }}>{formatVenezuelanPrice(totalCOGS, currencySymbol)}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={3} align="right">
                                            <Text strong style={{ color: '#722ed1' }}>{formatVenezuelanPrice(totalPurchases, currencySymbol)}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={4} align="right">
                                            <Text strong style={{ color: '#ff4d4f' }}>{formatVenezuelanPrice(totalExpenses, currencySymbol)}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={5}></Table.Summary.Cell>
                                        <Table.Summary.Cell index={6} align="right">
                                            <Text strong style={{ color: totalNetBalance >= 0 ? '#52c41a' : '#cf1322' }}>
                                                {formatVenezuelanPrice(totalNetBalance, currencySymbol)}
                                            </Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={7} align="right">
                                            <Tag color={totalMargin > 20 ? 'gold' : 'default'} style={{ fontWeight: 'bold' }}>
                                                {totalMargin.toFixed(1)}%
                                            </Tag>
                                        </Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </Table.Summary>
                            );
                        }}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filteredData.map((item: any) => (
                            <Card key={item.month} variant="borderless" style={{ background: '#fafafa', borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <Text strong style={{ fontSize: 16 }}>{item.month}</Text>
                                    <Tag color={item.total >= 0 ? 'success' : 'error'} style={{ margin: 0, fontWeight: 700, borderRadius: 6 }}>
                                        {item.total >= 0 ? 'UTILIDAD' : 'PÉRDIDA'}
                                    </Tag>
                                </div>
                                
                                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                                    <Col span={12}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase' }}>Ingresos</Text>
                                        <Text strong style={{ color: '#52c41a' }}>{formatVenezuelanPrice(item.income, currencySymbol)}</Text>
                                    </Col>
                                    <Col span={12} style={{ textAlign: 'right' }}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase' }}>Costos Stock</Text>
                                        <Text strong style={{ color: '#1890ff' }}>{formatVenezuelanPrice(item.cogs, currencySymbol)}</Text>
                                    </Col>
                                    <Col span={12}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase' }}>Gastos Op.</Text>
                                        <Text strong style={{ color: '#ff4d4f' }}>{formatVenezuelanPrice(item.expenses, currencySymbol)}</Text>
                                    </Col>
                                    <Col span={12} style={{ textAlign: 'right' }}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', textTransform: 'uppercase' }}>Margen</Text>
                                        <Text strong>{(item.profitMargin || 0).toFixed(1)}%</Text>
                                    </Col>
                                </Row>
                                
                                <div style={{ padding: '10px 12px', background: item.total >= 0 ? '#f6ffed' : '#fff1f0', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: item.total >= 0 ? '1px solid #d9f7be' : '1px solid #ffa39e' }}>
                                    <Text strong style={{ fontSize: 12 }}>RESULTADO NETO:</Text>
                                    <Text strong style={{ color: item.total >= 0 ? '#52c41a' : '#cf1322', fontSize: 15 }}>
                                        {formatVenezuelanPrice(item.total, currencySymbol)}
                                    </Text>
                                </div>
                                
                                {item.purchases > 0 && (
                                    <div style={{ marginTop: 8, textAlign: 'center' }}>
                                        <Text type="secondary" style={{ fontSize: 11 }}>Inversión en Reposición: </Text>
                                        <Text strong style={{ color: '#722ed1', fontSize: 11 }}>{formatVenezuelanPrice(item.purchases, currencySymbol)}</Text>
                                    </div>
                                )}
                            </Card>
                        ))}
                        
                        <Card variant="borderless" style={{ background: '#fff', borderRadius: 16, border: '2px solid #f0f5ff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                            <Title level={5} style={{ marginBottom: 16, textAlign: 'center' }}>RESUMEN ANUAL</Title>
                            <Row gutter={[16, 16]}>
                                <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 10 }}>TOTAL VENTAS</Text>
                                    <div style={{ fontWeight: 700, color: '#52c41a', fontSize: 16 }}>{formatVenezuelanPrice(totalIncome, currencySymbol)}</div>
                                </Col>
                                <Col span={12} style={{ textAlign: 'right' }}>
                                    <Text type="secondary" style={{ fontSize: 10 }}>TOTAL COSTOS</Text>
                                    <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 16 }}>{formatVenezuelanPrice(totalCOGS, currencySymbol)}</div>
                                </Col>
                                <Col span={12}>
                                    <Text type="secondary" style={{ fontSize: 10 }}>TOTAL GASTOS</Text>
                                    <div style={{ fontWeight: 700, color: '#ff4d4f', fontSize: 16 }}>{formatVenezuelanPrice(totalExpenses, currencySymbol)}</div>
                                </Col>
                                <Col span={12} style={{ textAlign: 'right' }}>
                                    <Text type="secondary" style={{ fontSize: 10 }}>TOTAL UTILIDAD</Text>
                                    <div style={{ fontWeight: 800, color: netBalance >= 0 ? '#52c41a' : '#cf1322', fontSize: 18 }}>
                                        {formatVenezuelanPrice(netBalance, currencySymbol)}
                                    </div>
                                </Col>
                            </Row>
                        </Card>
                    </div>
                )}
            </Card>
        </Space>
    );
};
