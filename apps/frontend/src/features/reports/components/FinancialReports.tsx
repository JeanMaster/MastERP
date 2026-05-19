import { useEffect, useState } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, Radio, Typography, Grid } from 'antd';
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
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
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
                <Spin size="large" tip="Calculating financial metrics...">
                    <div style={{ padding: 50 }} />
                </Spin>
            </div>
        );
    }

    if (!report) {
        return <Empty description="Failed to load financial report" />;
    }

    const displayIncome = report.monthlySalesTotal;
    const profit = displayIncome - report.totalCostOfSales - report.totalExpenses;
    const paymentData = report.paymentMethodsBreakdown.map((item: any) => ({
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
        <div style={{ padding: '0px' }}>
            {/* Header & Filters */}
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row gutter={[16, 24]} align="middle">
                    <Col xs={24} lg={12}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Reporte Financiero</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Resumen ejecutivo de ingresos, costos y utilidad.</Text>
                    </Col>
                    <Col xs={24} lg={12}>
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <div style={{ minWidth: isMobile ? '100%' : 200 }}>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>MONEDA</Text>
                                <ReportCurrencySelector
                                    value={selectedCurrency}
                                    onChange={setSelectedCurrency}
                                />
                            </div>
                            <div>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>PERÍODO</Text>
                                <Radio.Group
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    buttonStyle="solid"
                                    size="large"
                                    block={isMobile}
                                >
                                    <Radio.Button value="day">Hoy</Radio.Button>
                                    <Radio.Button value="month">Mes</Radio.Button>
                                    <Radio.Button value="lastMonth">Ant.</Radio.Button>
                                    <Radio.Button value="all">Todo</Radio.Button>
                                </Radio.Group>
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* Core Metrics Row */}
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f6ffed' }} styles={{ body: { padding: isMobile ? 12 : 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>INGRESOS TOTALES</Text>}
                            value={displayIncome}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#52c41a', fontSize: isMobile ? 20 : 24, fontWeight: 800 } }}
                            suffix={<DollarOutlined style={{ opacity: 0.5 }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fff7e6' }} styles={{ body: { padding: 12 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>COSTO DE VENTAS</Text>}
                            value={report.totalCostOfSales}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#faad14', fontSize: isMobile ? 20 : 24, fontWeight: 800 } }}
                            suffix={<ShoppingOutlined style={{ opacity: 0.5 }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fff1f0' }} styles={{ body: { padding: 12 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>GASTOS TOTALES</Text>}
                            value={report.totalExpenses}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#ff4d4f', fontSize: isMobile ? 20 : 24, fontWeight: 800 } }}
                            suffix={<CreditCardOutlined style={{ opacity: 0.5 }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: profit >= 0 ? '#e6f7ff' : '#fff1f0' }} styles={{ body: { padding: 12 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>UTILIDAD NETA</Text>}
                            value={profit}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: profit >= 0 ? '#1890ff' : '#cf1322', fontSize: isMobile ? 20 : 24, fontWeight: 800 } }}
                            suffix={<RiseOutlined style={{ opacity: 0.5 }} />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Secondary Metrics Row */}
            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" size="small" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 10 }}>Monetizaciones</Text>}
                            value={report.totalMonetaryRefunds}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#ff4d4f', fontSize: 16, fontWeight: 700 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" size="small" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 10 }}>Margen Bruto</Text>}
                            value={displayIncome > 0 ? ((displayIncome - report.totalCostOfSales) / displayIncome) * 100 : 0}
                            precision={1}
                            suffix="%"
                            styles={{ content: { color: '#faad14', fontSize: 16, fontWeight: 700 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" size="small" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 10 }}>Ratio de Gastos</Text>}
                            value={displayIncome > 0 ? (report.totalExpenses / displayIncome) * 100 : 0}
                            precision={1}
                            suffix="%"
                            styles={{ content: { color: '#1890ff', fontSize: 16, fontWeight: 700 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" size="small" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>Métodos Pago</Text>}
                            value={report.paymentMethodsBreakdown.length}
                            styles={{ content: { color: '#722ed1', fontSize: 16, fontWeight: 700 } }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Charts Section */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={14}>
                    <Card variant="borderless" title={<Text strong>Volumen de Ventas Diario</Text>} style={{ height: '100%', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', minWidth: 0 }}>
                        <div style={{ width: '100%', height: isMobile ? 250 : 350, minHeight: isMobile ? 250 : 350, minWidth: 0, position: 'relative' }}>
                            <ResponsiveContainer minWidth={0} width="100%" height="100%" debounce={50}>
                                <BarChart data={report.dailySalesData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={10} tickFormatter={(val) => dayjs(val).format('DD/MM')} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={10} tickFormatter={(val) => isMobile ? `${(val/1000).toFixed(0)}k` : val.toLocaleString()} />
                                    <Tooltip
                                        formatter={(value: number) => formatVenezuelanPrice(value, currencySymbol)}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="amount" fill="#1890ff" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} lg={10}>
                    <Card variant="borderless" title={<Text strong>Distribución de Cobros</Text>} style={{ height: '100%', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', minWidth: 0 }}>
                        <div style={{ width: '100%', height: isMobile ? 300 : 350, minHeight: isMobile ? 300 : 350, minWidth: 0, position: 'relative' }}>
                            <ResponsiveContainer minWidth={0} width="100%" height="100%" debounce={50}>
                                <PieChart>
                                    <Pie
                                        data={paymentData}
                                        cx="50%"
                                        cy="45%"
                                        labelLine={false}
                                        label={(entry) => isMobile ? `${((entry.value / report.monthlySalesTotal) * 100).toFixed(0)}%` : `${entry.name}: ${((entry.value / report.monthlySalesTotal) * 100).toFixed(0)}%`}
                                        outerRadius={isMobile ? 70 : 85}
                                        innerRadius={isMobile ? 40 : 50}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {paymentData.map((_entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatVenezuelanPrice(value, currencySymbol)} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Currency Type Summary Breakdown */}
            <Card variant="borderless" title={<Text strong>Ingresos por Tipo de Moneda</Text>} style={{ marginBottom: 24, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Row gutter={[16, 16]}>
                    {Object.entries(report.currencyTypeBreakdown).map(([type, amount]: [string, any]) => {
                        const typeKey = type as 'LOCAL' | 'FOREIGN';
                        const info = {
                            LOCAL: { displayName: 'Moneda Local (VES)', icon: '🇻🇪', color: '#52c41a', bgColor: '#f6ffed' },
                            FOREIGN: { displayName: 'Divisas (USD/EUR)', icon: '🌎', color: '#1890ff', bgColor: '#e6f7ff' }
                        }[typeKey];

                        const percentage = ((amount / report.monthlySalesTotal) * 100).toFixed(1);
                        if (amount === 0) return null;

                        return (
                            <Col xs={24} sm={12} key={type}>
                                <Card
                                    variant="borderless"
                                    style={{
                                        borderLeft: `4px solid ${info.color}`,
                                        backgroundColor: info.bgColor,
                                        borderRadius: '12px'
                                    }}
                                    styles={{ body: { padding: isMobile ? 16 : 20 } }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{
                                                fontSize: 13,
                                                fontWeight: 600,
                                                marginBottom: 4,
                                                color: info.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8
                                            }}>
                                                <span style={{ fontSize: 20 }}>{info.icon}</span>
                                                {info.displayName}
                                            </div>
                                            <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: '#262626' }}>
                                                {formatVenezuelanPrice(amount, currencySymbol)}
                                            </div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>{percentage}% del total recaudado</Text>
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            </Card>

            {/* Detailed Payment Breakdown Grid */}
            <Card variant="borderless" title={<Text strong>Desglose Detallado por Método</Text>} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 24 }}>
                <Row gutter={[12, 12]}>
                    {report.paymentMethodsBreakdown.map((payment: any) => {
                        const info = getPaymentMethodInfo(payment.method);
                        const percentage = ((payment.amount / report.monthlySalesTotal) * 100).toFixed(1);

                        return (
                            <Col xs={24} sm={12} lg={8} key={payment.method}>
                                <Card
                                    variant="borderless"
                                    style={{
                                        border: '1px solid #f0f0f0',
                                        backgroundColor: info.bgColor,
                                        borderRadius: '12px'
                                    }}
                                    styles={{ body: { padding: 16 } }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                color: info.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                marginBottom: 4
                                            }}>
                                                <span style={{ fontSize: 18 }}>{info.icon}</span>
                                                {info.displayName}
                                            </div>
                                            <div style={{ fontSize: 20, fontWeight: 800, color: '#262626' }}>
                                                {formatVenezuelanPrice(payment.amount, currencySymbol)}
                                            </div>
                                            <Text type="secondary" style={{ fontSize: 11 }}>Representa el {percentage}%</Text>
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