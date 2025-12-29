import { Card, Table, Statistic, Row, Col, Typography, Tag, Space, Spin, Empty, Select, Progress } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUpOutlined, ArrowDownOutlined, GlobalOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { currenciesApi } from '../../../services/currenciesApi';

const { Text, Title } = Typography;
const { Option } = Select;

export const BalanceReports = () => {
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');

    // Fetch currencies for selector
    const { data: currencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
    });

    const { data, isLoading, error } = useQuery({
        queryKey: ['balanceReport', selectedCurrency],
        queryFn: () => statsApi.getBalanceReport(selectedCurrency),
    });

    if (isLoading) return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;
    if (error || !data) return <Empty description="Error al cargar el balance" />;

    const totalIncome = data.reduce((sum, item) => sum + item.income, 0);
    const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0);
    const totalPurchases = data.reduce((sum, item) => sum + (item.purchases || 0), 0);
    const netBalance = totalIncome - totalExpenses - totalPurchases;

    const currencySymbol = selectedCurrency === 'VES' ? 'Bs.' : selectedCurrency;

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
            title: 'Costos (Mercancía)',
            dataIndex: 'purchases',
            key: 'purchases',
            render: (val: number | undefined) => <Text style={{ color: '#fa8c16' }}>{formatVenezuelanPrice(val || 0, currencySymbol)}</Text>,
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
                            <Select
                                value={selectedCurrency}
                                onChange={setSelectedCurrency}
                                style={{ width: 120 }}
                                loading={!currencies}
                            >
                                <Option value="VES">Bolívares</Option>
                                {currencies?.filter(c => c.code !== 'VES').map(c => (
                                    <Option key={c.id} value={c.code}>{c.name}</Option>
                                ))}
                            </Select>
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Row gutter={16}>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Ingresos Totales (12m)"
                            value={totalIncome}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#52c41a' }}
                            styles={{ content: { color: '#52c41a' } }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Egresos Totales (12m)"
                            value={totalExpenses}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#ff4d4f' }}
                            styles={{ content: { color: '#ff4d4f' } }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic
                            title="Utilidad Neta Acumulada"
                            value={netBalance}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: netBalance >= 0 ? '#1890ff' : '#cf1322' }}
                            styles={{ content: { color: netBalance >= 0 ? '#1890ff' : '#cf1322' } }}
                            suffix={netBalance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                        />
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
                            <Bar name="Egresos" dataKey="expenses" fill="#ff4d4f" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card title="Detalle Mensual de Balance">
                <Table
                    dataSource={data}
                    columns={columns}
                    pagination={false}
                    rowKey="month"
                    summary={(pageData) => {
                        let totalIncome = 0;
                        let totalExpenses = 0;
                        let totalPurchases = 0;

                        pageData.forEach(({ income, expenses, purchases }) => {
                            totalIncome += income;
                            totalExpenses += expenses;
                            totalPurchases += (purchases || 0);
                        });

                        return (
                            <Table.Summary fixed>
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0}><Text strong>TOTAL ANUAL</Text></Table.Summary.Cell>
                                    <Table.Summary.Cell index={1} align="right">
                                        <Text strong style={{ color: '#52c41a' }}>{formatVenezuelanPrice(totalIncome, currencySymbol)}</Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={2} align="right">
                                        <Text strong style={{ color: '#fa8c16' }}>{formatVenezuelanPrice(totalPurchases, currencySymbol)}</Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={3} align="right">
                                        <Text strong style={{ color: '#ff4d4f' }}>{formatVenezuelanPrice(totalExpenses, currencySymbol)}</Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={4}></Table.Summary.Cell>
                                    <Table.Summary.Cell index={5} align="right">
                                        <Text strong style={{ color: (totalIncome - (totalExpenses + totalPurchases)) >= 0 ? '#1890ff' : '#cf1322' }}>
                                            {formatVenezuelanPrice(totalIncome - (totalExpenses + totalPurchases), currencySymbol)}
                                        </Text>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={5}></Table.Summary.Cell>
                                </Table.Summary.Row>
                            </Table.Summary>
                        );
                    }}
                />
            </Card>
        </Space>
    );
};
