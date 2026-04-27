import { useEffect, useState } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, Radio, Typography, Divider } from 'antd';
import {
    DollarOutlined,
    ShoppingOutlined,
    RiseOutlined,
    CreditCardOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { statsApi, type FinanceReport } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { usePOSStore } from '../../../store/posStore';
import { ReportCurrencySelector } from './ReportCurrencySelector';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

/**
 * FinancialReports Component
 * Core business intelligence dashboard. 
 * Provides real-time insights into Revenue, COGS, Profit Margins, and Payment Method distribution.
 * Supports granular date filtering and multi-currency reporting.
 */
export const FinancialReports = () => {
    const [report, setReport] = useState<FinanceReport | null>(null);
    const [loading, setLoading] = useState(true);
    const { primaryCurrency, currencies } = usePOSStore();
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const [dateFilter, setDateFilter] = useState<string>('month');

    const currentCurrencyObj = currencies.find(c => c.code === selectedCurrency);
    const currencySymbol = currentCurrencyObj?.symbol || 'Bs';

    // Auto-select primary currency on mount
    useEffect(() => {
        if (primaryCurrency && selectedCurrency === 'VES') {
            setSelectedCurrency(primaryCurrency.code);
        }
    }, [primaryCurrency]);

    useEffect(() => {
        fetchReport();
    }, [selectedCurrency, dateFilter]);

    /**
     * Fetches the finance data based on active filters.
     */
    const fetchReport = async () => {
        try {
            setLoading(true);
            let startDate: string | undefined;
            let endDate: string | undefined;

            if (dateFilter === 'day') {
                startDate = dayjs().format('YYYY-MM-DD');
                endDate = dayjs().format('YYYY-MM-DD');
            } else if (dateFilter === 'yesterday') {
                startDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
                endDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
            } else if (dateFilter === 'month') {
                startDate = dayjs().startOf('month').format('YYYY-MM-DD');
                endDate = dayjs().endOf('month').format('YYYY-MM-DD');
            } else if (dateFilter === 'lastMonth') {
                startDate = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
                endDate = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
            } else if (dateFilter === 'all') {
                startDate = '2000-01-01'; // Epoch-style broad range
                endDate = dayjs().format('YYYY-MM-DD');
            }

            const data = await statsApi.getFinanceReport(selectedCurrency, startDate, endDate);
            setReport(data);
        } catch (error) {
            console.error('Error fetching finance report:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: 50, textAlign: 'center' }}>
                <Spin size="large" tip="Calculating financial metrics..." />
            </div>
        );
    }

    if (!report) {
        return <Empty description="Failed to load financial report" />;
    }

    const displayIncome = report.monthlySalesTotal;
    const profit = displayIncome - report.totalCostOfSales - report.totalExpenses;
    const paymentData = report.paymentMethodsBreakdown.map((item) => ({
        name: item.method,
        value: item.amount,
    }));

    /**
     * Maps raw payment method codes to user-friendly labels, icons, and branding colors.
     */
    const getPaymentMethodInfo = (method: string) => {
        // Dynamic currency-based payments (e.g., CURRENCY_USD)
        if (method.startsWith('CURRENCY_')) {
            const currencyCode = method.replace('CURRENCY_', '').toUpperCase();
            const currencyMap: Record<string, { name: string; symbol: string; color: string; bgColor: string }> = {
                USD: { name: 'US Dollars ($)', symbol: '$', color: '#52c41a', bgColor: '#f6ffed' },
                DLR: { name: 'US Dollars ($)', symbol: '$', color: '#52c41a', bgColor: '#f6ffed' },
                EUR: { name: 'Euros (€)', symbol: '€', color: '#1890ff', bgColor: '#e6f7ff' },
                COP: { name: 'Colombian Pesos', symbol: 'COL$', color: '#faad14', bgColor: '#fffbe6' },
                VES: { name: 'Bolívares (Cash)', symbol: 'Bs.', color: '#722ed1', bgColor: '#f9f0ff' },
                BRL: { name: 'Brazilian Real', symbol: 'R$', color: '#13c2c2', bgColor: '#e6fffb' },
            };
            const currency = currencyMap[currencyCode] || {
                name: currencyCode,
                symbol: currencyCode,
                color: '#8c8c8c',
                bgColor: '#fafafa'
            };
            return {
                displayName: currency.name,
                icon: currency.symbol,
                color: currency.color,
                bgColor: currency.bgColor,
            };
        }

        // Standard payment modalities
        const standardMethods: Record<string, { displayName: string; icon: string; color: string; bgColor: string }> = {
            CASH: { displayName: 'Cash (Local Currency)', icon: '💵', color: '#52c41a', bgColor: '#f6ffed' },
            DEBIT: { displayName: 'Debit Card', icon: '💳', color: '#1890ff', bgColor: '#e6f7ff' },
            CREDIT: { displayName: 'Credit Card', icon: '💳', color: '#722ed1', bgColor: '#f9f0ff' },
            TRANSFER: { displayName: 'Bank Transfer', icon: '🏦', color: '#fa8c16', bgColor: '#fff7e6' },
            MOBILE: { displayName: 'Mobile Payment (Pago Móvil)', icon: '📱', color: '#eb2f96', bgColor: '#fff0f6' },
            ZELLE: { displayName: 'Zelle', icon: '💸', color: '#722ed1', bgColor: '#f9f0ff' },
        };

        return standardMethods[method] || {
            displayName: method,
            icon: '💰',
            color: '#8c8c8c',
            bgColor: '#fafafa'
        };
    };

    return (
        <div style={{ padding: '4px' }}>
            {/* Header & Filters */}
            <Card bordered={false} style={{ marginBottom: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Row gutter={[16, 16]} align="middle" justify="space-between">
                    <Col xs={24} md={12}>
                        <Space direction="vertical">
                            <Title level={4} style={{ margin: 0 }}>📈 Executive Summary</Title>
                            <Radio.Group
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                buttonStyle="solid"
                            >
                                <Radio.Button value="day">Today</Radio.Button>
                                <Radio.Button value="yesterday">Yesterday</Radio.Button>
                                <Radio.Button value="month">Current Month</Radio.Button>
                                <Radio.Button value="lastMonth">Last Month</Radio.Button>
                                <Radio.Button value="all">Lifetime</Radio.Button>
                            </Radio.Group>
                        </Space>
                    </Col>
                    <Col xs={24} md={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
                            <Text strong>Reporting Currency:</Text>
                            <ReportCurrencySelector
                                value={selectedCurrency}
                                onChange={setSelectedCurrency}
                                style={{ width: 200 }}
                            />
                        </div>
                    </Col>
                </Row>
            </Card>

            {/* Core Metrics Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} hoverable>
                        <Statistic
                            title="Gross Revenue"
                            value={displayIncome}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#52c41a' }}
                            suffix={<DollarOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} hoverable>
                        <Statistic
                            title="Cost of Goods (COGS)"
                            value={report.totalCostOfSales}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#faad14' }}
                            suffix={<ShoppingOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} hoverable>
                        <Statistic
                            title="Operating Expenses"
                            value={report.totalExpenses}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#ff4d4f' }}
                            suffix={<ShoppingOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} style={{ background: profit >= 0 ? '#f6ffed' : '#fff1f0' }}>
                        <Statistic
                            title="Net Operational Profit"
                            value={profit}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}
                            suffix={<RiseOutlined />}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Formula: Revenue - Costs - Expenses</Text>
                    </Card>
                </Col>
            </Row>

            {/* Secondary Metrics Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} size="small">
                        <Statistic
                            title="Monetary Refunds"
                            value={report.totalMonetaryRefunds}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#ff4d4f', fontSize: '20px' }}
                            suffix={<CreditCardOutlined />}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Direct cash returned to customers</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} size="small">
                        <Statistic
                            title="Product Exchanges"
                            value={report.totalExchangeValue}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#faad14', fontSize: '20px' }}
                            suffix={<ShoppingOutlined />}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Value of items swapped</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} size="small">
                        <Statistic
                            title="New Stock Investment"
                            value={report.monthlyPurchasesTotal}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#1890ff', fontSize: '20px' }}
                            suffix={<ShoppingOutlined />}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Total procurement from suppliers</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} size="small">
                        <Statistic
                            title="Active Payment Methods"
                            value={report.paymentMethodsBreakdown.length}
                            valueStyle={{ color: '#722ed1', fontSize: '20px' }}
                            suffix={<CreditCardOutlined />}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Unique modalities used in this period</Text>
                    </Card>
                </Col>
            </Row>

            {/* Charts Section */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={14}>
                    <Card bordered={false} title="Sales Volume Tendency" style={{ height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <ResponsiveContainer width="100%" height={320}>
                            <BarChart data={report.dailySalesData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip
                                    formatter={(value: number) => formatVenezuelanPrice(value, currencySymbol)}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="amount" fill="#1890ff" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col xs={24} lg={10}>
                    <Card bordered={false} title="Payment Distribution" style={{ height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <ResponsiveContainer width="100%" height={320}>
                            <PieChart>
                                <Pie
                                    data={paymentData}
                                    cx="50%"
                                    cy="45%"
                                    labelLine={false}
                                    label={(entry) => `${entry.name}: ${((entry.value / report.monthlySalesTotal) * 100).toFixed(0)}%`}
                                    outerRadius={85}
                                    innerRadius={50}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {paymentData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatVenezuelanPrice(value, currencySymbol)} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
            </Row>

            {/* Currency Type Summary Breakdown */}
            <Card bordered={false} title="Currency Type Performance Summary" style={{ marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Row gutter={[16, 16]}>
                    {Object.entries(report.currencyTypeBreakdown).map(([type, amount]) => {
                        const typeKey = type as 'LOCAL' | 'FOREIGN';
                        const info = {
                            LOCAL: { displayName: 'Local Currency (VES)', icon: '🇻🇪', color: '#52c41a', bgColor: '#f6ffed' },
                            FOREIGN: { displayName: 'Foreign Exchange (USD/EUR/etc)', icon: '🌎', color: '#1890ff', bgColor: '#e6f7ff' }
                        }[typeKey];

                        const percentage = ((amount / report.monthlySalesTotal) * 100).toFixed(1);
                        if (amount === 0) return null;

                        return (
                            <Col xs={24} sm={12} key={type}>
                                <Card
                                    style={{
                                        borderLeft: `4px solid ${info.color}`,
                                        backgroundColor: info.bgColor,
                                        borderRadius: '8px'
                                    }}
                                    styles={{ body: { padding: 20 } }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{
                                                fontSize: 14,
                                                fontWeight: 600,
                                                marginBottom: 8,
                                                color: info.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8
                                            }}>
                                                <span style={{ fontSize: 24 }}>{info.icon}</span>
                                                {info.displayName}
                                            </div>
                                            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#262626' }}>
                                                {formatVenezuelanPrice(amount, currencySymbol)}
                                            </div>
                                            <Text type="secondary">{percentage}% of total revenue</Text>
                                        </div>
                                        <div style={{ fontSize: 40, fontWeight: 'bold', color: info.color, opacity: 0.15 }}>
                                            {percentage}%
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            </Card>

            {/* Detailed Payment Breakdown Grid */}
            <Card bordered={false} title="Granular Payment Method Breakdown" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Row gutter={[16, 16]}>
                    {report.paymentMethodsBreakdown.map((payment) => {
                        const info = getPaymentMethodInfo(payment.method);
                        const percentage = ((payment.amount / report.monthlySalesTotal) * 100).toFixed(1);

                        return (
                            <Col xs={24} sm={12} lg={8} key={payment.method}>
                                <Card
                                    style={{
                                        border: '1px solid #f0f0f0',
                                        backgroundColor: info.bgColor,
                                        borderRadius: '8px'
                                    }}
                                    hoverable
                                    styles={{ body: { padding: 16 } }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{
                                                fontSize: 13,
                                                fontWeight: 600,
                                                color: info.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                marginBottom: 4
                                            }}>
                                                <span style={{ fontSize: 20 }}>{info.icon}</span>
                                                {info.displayName}
                                            </div>
                                            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#262626' }}>
                                                {formatVenezuelanPrice(payment.amount, currencySymbol)}
                                            </div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>Share: {percentage}%</Text>
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            </Card>
        </div>
    );
};