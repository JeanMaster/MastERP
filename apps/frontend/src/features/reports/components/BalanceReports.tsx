import { Card, Table, Statistic, Row, Col, Typography, Tag, Space, Spin, Empty, Progress } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUpOutlined, ArrowDownOutlined, GlobalOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { ReportCurrencySelector } from './ReportCurrencySelector';
import { usePOSStore } from '../../../store/posStore';

const { Text, Title } = Typography;

export const BalanceReports = () => {
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const { currencies } = usePOSStore();

    const { data, isLoading, error } = useQuery({
        queryKey: ['balanceReport', selectedCurrency],
        queryFn: () => statsApi.getBalanceReport(selectedCurrency),
    });

    if (isLoading) return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;
    if (error || !data) return <Empty description="Error al cargar el balance" />;

    const totalIncome = data.reduce((sum, item) => sum + item.income, 0);
    const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0);
    const totalPurchases = data.reduce((sum, item) => sum + (item.purchases || 0), 0);
    const totalCOGS = data.reduce((sum, item) => sum + (item.cogs || 0), 0);
    const netBalance = totalIncome - totalCOGS - totalExpenses;
    // Removed unused cashFlow variable

    const currentCurrencyObj = currencies.find(c => c.code === selectedCurrency);
    const currencySymbol = currentCurrencyObj?.symbol || 'Bs';

    const columns = [
        {
            title: 'Mes',
            dataIndex: 'month',
            key: 'month',
            render: (text: string) => <Text strong>{text}</Text>,
        },
        {
            title: 'Ingresos (Ventas)',
            dataIndex: 'income',
            key: 'income',
            render: (val: number) => <Text style={{ color: '#52c41a' }}>{formatVenezuelanPrice(val, currencySymbol)}</Text>,
            align: 'right' as const,
        },
        {
            title: 'Costo de Ventas (COGS)',
            dataIndex: 'cogs',
            key: 'cogs',
            render: (val: number) => <Text style={{ color: '#1890ff' }}>{formatVenezuelanPrice(val, currencySymbol)}</Text>,
            align: 'right' as const,
        },
        {
            title: 'Inversión Stock',
            dataIndex: 'purchases',
            key: 'purchases',
            render: (val: number | undefined) => <Text style={{ color: '#722ed1' }}>{formatVenezuelanPrice(val || 0, currencySymbol)}</Text>,
            align: 'right' as const,
        },
        {
            title: 'Gastos Operativos',
            dataIndex: 'expenses',
            key: 'expenses',
            render: (val: number) => <Text style={{ color: '#ff4d4f' }}>{formatVenezuelanPrice(val, currencySymbol)}</Text>,
            align: 'right' as const,
        },
        {
            title: '% Costos Op.',
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
            title: 'Balance Neto',
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
            title: '% Margen',
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
            <Card>
                <Row align="middle" justify="space-between">
                    <Col>
                        <Title level={4} style={{ margin: 0 }}>📊 Reporte Financiero Anual</Title>
                        <Text type="secondary">Visualiza tu rendimiento ajustado a tasas históricas</Text>
                    </Col>
                    <Col>
                        <Space>
                            <GlobalOutlined />
                            <Text strong>Moneda de Visualización:</Text>
                            <ReportCurrencySelector
                                value={selectedCurrency}
                                onChange={setSelectedCurrency}
                                style={{ width: 150 }}
                            />
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false}>
                        <Statistic
                            title="Ingresos Totales"
                            value={totalIncome}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false}>
                        <Statistic
                            title="Costo Ventas (COGS)"
                            value={totalCOGS}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#1890ff' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false}>
                        <Statistic
                            title="Gastos Operativos"
                            value={totalExpenses}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#ff4d4f' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false}>
                        <Statistic
                            title="Inversión Stock"
                            value={totalPurchases}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#722ed1' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card bordered={false} style={{ background: '#f6ffed' }}>
                        <Statistic
                            title="Utilidad Real Acumulada"
                            value={netBalance}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: netBalance >= 0 ? '#52c41a' : '#cf1322' }}
                            suffix={netBalance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                        />
                        <div style={{ fontSize: 10, color: '#666' }}>Ventas - COGS - Gastos</div>
                    </Card>
                </Col>
            </Row>

            <Card title="Gráfico de Salud Financiera (Ingresos vs Egresos)">
                <div style={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `${currencySymbol} ${formatVenezuelanPrice(value)}`} />
                            <Legend />
                            <Bar name="Ingresos" dataKey="income" fill="#52c41a" radius={[4, 4, 0, 0]} />
                            <Bar name="COGS" dataKey="cogs" fill="#1890ff" radius={[4, 4, 0, 0]} />
                            <Bar name="Gastos" dataKey="expenses" fill="#ff4d4f" radius={[4, 4, 0, 0]} />
                            <Bar name="Inversión" dataKey="purchases" fill="#722ed1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card title="Detalle Mensual de Balance">
                <Table
                    dataSource={filteredData}
                    columns={columns}
                    pagination={false}
                    rowKey="month"
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
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0}><Text strong>TOTAL ANUAL</Text></Table.Summary.Cell>
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
            </Card>
        </Space>
    );
};
