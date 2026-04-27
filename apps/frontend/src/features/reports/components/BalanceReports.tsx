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

/**
 * BalanceReports Component
 * Provides a comprehensive financial overview of the business.
 * Displays Income vs. Expenses (COGS, OpEx, Stock) across time, 
 * allowing the user to view data in different currencies (VES, USD, etc.) 
 * using historical exchange rates.
 */
export const BalanceReports = () => {
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
            <Card bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Row align="middle" justify="space-between">
                    <Col>
                        <Title level={4} style={{ margin: 0 }}>📊 Annual Financial Balance</Title>
                        <Text type="secondary">View your performance adjusted to historical exchange rates.</Text>
                    </Col>
                    <Col>
                        <Space>
                            <GlobalOutlined style={{ color: '#1890ff' }} />
                            <Text strong>Reporting Currency:</Text>
                            <ReportCurrencySelector
                                value={selectedCurrency}
                                onChange={setSelectedCurrency}
                                style={{ width: 150 }}
                            />
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false}>
                        <Statistic
                            title="Total Revenue"
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
                            title="Total COGS"
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
                            title="Total OpEx"
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
                            title="Stock Investment"
                            value={totalPurchases}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#722ed1' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                        <Statistic
                            title="Cumulative Net Profit"
                            value={netBalance}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: netBalance >= 0 ? '#52c41a' : '#cf1322' }}
                            suffix={netBalance >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>Formula: Revenue - COGS - OpEx</Text>
                    </Card>
                </Col>
            </Row>

            <Card title="Financial Health Trends (Inflow vs. Outflow)" bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ height: 350 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip 
                                formatter={(value: number) => `${currencySymbol} ${formatVenezuelanPrice(value)}`}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            <Legend iconType="circle" />
                            <Bar name="Revenue" dataKey="income" fill="#52c41a" radius={[4, 4, 0, 0]} />
                            <Bar name="COGS" dataKey="cogs" fill="#1890ff" radius={[4, 4, 0, 0]} />
                            <Bar name="OpEx" dataKey="expenses" fill="#ff4d4f" radius={[4, 4, 0, 0]} />
                            <Bar name="Investment" dataKey="purchases" fill="#722ed1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card title="Monthly Balance Breakdown" bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
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
            </Card>
        </Space>
    );
};
