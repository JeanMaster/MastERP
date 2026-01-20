import { useEffect, useState } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, Radio } from 'antd';
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const FinancialReports = () => {
    const [report, setReport] = useState<FinanceReport | null>(null);
    const [loading, setLoading] = useState(true);
    const { primaryCurrency, currencies } = usePOSStore();
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const [dateFilter, setDateFilter] = useState<string>('month');

    const currentCurrencyObj = currencies.find(c => c.code === selectedCurrency);
    const currencySymbol = currentCurrencyObj?.symbol || 'Bs';

    // Initialize to primary
    useEffect(() => {
        if (primaryCurrency && selectedCurrency === 'VES') {
            setSelectedCurrency(primaryCurrency.code);
        }
    }, [primaryCurrency]);

    useEffect(() => {
        fetchReport();
    }, [selectedCurrency, dateFilter]);

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
            }
            // 'all' leaves dates as undefined, backend handles it as everything or we could set a very early date
            // However, my backend logic defaults to current month if undefined. 
            // I should explicitly set a very early date for 'all' or adjust backend.
            // Let's adjust backend to handle 'all' if no dates provided? 
            // No, better to be explicit here.
            if (dateFilter === 'all') {
                startDate = '2000-01-01'; // Good enough for "Todo"
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
            <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!report) {
        return <Empty description="Error al cargar reporte financiero" />;
    }

    const profit = report.monthlySalesTotal - report.totalCostOfSales - report.totalExpenses;
    const paymentData = report.paymentMethodsBreakdown.map((item) => ({
        name: item.method,
        value: item.amount,
    }));

    // Map payment method to friendly name, icon and color
    const getPaymentMethodInfo = (method: string) => {
        // Handle currency-based payments (format: CURRENCY_xyz)
        if (method.startsWith('CURRENCY_')) {
            const currencyCode = method.replace('CURRENCY_', '').toUpperCase();
            const currencyMap: Record<string, { name: string; symbol: string; color: string; bgColor: string }> = {
                DLR: { name: 'Dólares', symbol: '$', color: '#52c41a', bgColor: '#f6ffed' },
                USD: { name: 'Dólares', symbol: '$', color: '#52c41a', bgColor: '#f6ffed' },
                EUR: { name: 'Euros', symbol: '€', color: '#1890ff', bgColor: '#e6f7ff' },
                COP: { name: 'Pesos Colombianos', symbol: 'COL$', color: '#faad14', bgColor: '#fffbe6' },
                VES: { name: 'Bolívares', symbol: 'Bs.', color: '#722ed1', bgColor: '#f9f0ff' },
                BRL: { name: 'Reales', symbol: 'R$', color: '#13c2c2', bgColor: '#e6fffb' },
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

        // Standard payment methods
        const standardMethods: Record<string, { displayName: string; icon: string; color: string; bgColor: string }> = {
            CASH: { displayName: 'Efectivo (Bs.)', icon: '💵', color: '#52c41a', bgColor: '#f6ffed' },
            DEBIT: { displayName: 'Débito', icon: '💳', color: '#1890ff', bgColor: '#e6f7ff' },
            CREDIT: { displayName: 'Crédito', icon: '💳', color: '#722ed1', bgColor: '#f9f0ff' },
            TRANSFER: { displayName: 'Transferencia', icon: '🏦', color: '#fa8c16', bgColor: '#fff7e6' },
            MOBILE: { displayName: 'Pago Móvil', icon: '📱', color: '#eb2f96', bgColor: '#fff0f6' },
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
        <div>
            {/* Filters */}
            <div style={{ marginBottom: 20 }}>
                <Row gutter={[16, 16]} align="middle" justify="space-between">
                    <Col xs={24} md={12}>
                        <Radio.Group
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            buttonStyle="solid"
                        >
                            <Radio.Button value="day">Hoy</Radio.Button>
                            <Radio.Button value="yesterday">Ayer</Radio.Button>
                            <Radio.Button value="month">Este Mes</Radio.Button>
                            <Radio.Button value="lastMonth">Mes Anterior</Radio.Button>
                            <Radio.Button value="all">Todo</Radio.Button>
                        </Radio.Group>
                    </Col>
                    <Col xs={24} md={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                            <span style={{ fontWeight: 'bold' }}>Moneda del Reporte:</span>
                            <ReportCurrencySelector
                                value={selectedCurrency}
                                onChange={setSelectedCurrency}
                                style={{ width: 200 }}
                            />
                        </div>
                    </Col>
                </Row>
            </div>

            {/* Summary Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={4}>
                    <Card>
                        <Statistic
                            title="Ingresos (Ventas)"
                            value={report.monthlySalesTotal}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#52c41a' }}
                            styles={{ content: { color: '#52c41a' } }}
                            suffix={<DollarOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card>
                        <Statistic
                            title="Costo Productos"
                            value={report.totalCostOfSales}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#faad14' }}
                            styles={{ content: { color: '#faad14' } }}
                            suffix={<ShoppingOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card>
                        <Statistic
                            title="Gastos Operativos"
                            value={report.totalExpenses}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#ff4d4f' }}
                            styles={{ content: { color: '#ff4d4f' } }}
                            suffix={<ShoppingOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card>
                        <Statistic
                            title="Utilidad Real"
                            value={profit}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}
                            styles={{ content: { color: profit >= 0 ? '#52c41a' : '#ff4d4f' } }}
                            suffix={<RiseOutlined />}
                        />
                        <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
                            Ventas - Costos - Gastos
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card>
                        <Statistic
                            title="Inversión Stock"
                            value={report.monthlyPurchasesTotal}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#1890ff' }}
                            styles={{ content: { color: '#1890ff' } }}
                            suffix={<ShoppingOutlined />}
                        />
                        <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
                            Compras realizadas
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card>
                        <Statistic
                            title="Métodos Pago"
                            value={report.paymentMethodsBreakdown.length}
                            valueStyle={{ color: '#1890ff' }}
                            styles={{ content: { color: '#1890ff' } }}
                            suffix={<CreditCardOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Charts */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={24} lg={14}>
                    <Card title={`Tendencia de Ventas (${dateFilter === 'day' ? 'Hoy' :
                            dateFilter === 'yesterday' ? 'Ayer' :
                                dateFilter === 'month' ? 'Este Mes' :
                                    dateFilter === 'lastMonth' ? 'Mes Anterior' :
                                        'Todo'
                        })`}>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={report.dailySalesData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number) => formatVenezuelanPrice(value)}
                                />
                                <Bar dataKey="amount" fill="#1890ff" />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col xs={24} lg={10}>
                    <Card title="Distribución por Método de Pago">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={paymentData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={(entry) => `${entry.name}: ${((entry.value / report.monthlySalesTotal) * 100).toFixed(1)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {paymentData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => formatVenezuelanPrice(value)}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
            </Row>

            {/* Currency Type Summary Breakdown */}
            <Card title="Resumen por Tipo de Moneda" style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]}>
                    {Object.entries(report.currencyTypeBreakdown).map(([type, amount]) => {
                        const typeKey = type as 'LOCAL' | 'FOREIGN';
                        const info = {
                            LOCAL: { displayName: 'Moneda Local (Bs.)', icon: '🇻🇪', color: '#52c41a', bgColor: '#f6ffed' },
                            FOREIGN: { displayName: 'Divisas (USD/Zelle/etc)', icon: '💵', color: '#1890ff', bgColor: '#e6f7ff' }
                        }[typeKey];

                        const percentage = ((amount / report.monthlySalesTotal) * 100).toFixed(1);

                        if (amount === 0) return null;

                        return (
                            <Col xs={24} sm={12} key={type}>
                                <Card
                                    style={{
                                        borderLeft: `4px solid ${info.color}`,
                                        backgroundColor: info.bgColor,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                    }}
                                    styles={{ body: { padding: 16 } }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: 16,
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
                                            <div style={{ fontSize: 26, fontWeight: 'bold', color: '#262626', marginBottom: 4 }}>
                                                {currencySymbol} {formatVenezuelanPrice(amount)}
                                            </div>
                                            <div style={{ fontSize: 13, color: '#8c8c8c' }}>
                                                {percentage}% del ingreso total
                                            </div>
                                        </div>
                                        <div style={{
                                            fontSize: 32,
                                            fontWeight: 'bold',
                                            color: info.color,
                                            opacity: 0.3,
                                        }}>
                                            {percentage}%
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            </Card>

            {/* Payment Methods Cards */}
            <Card title="Desglose Detallado de Métodos de Pago">
                <Row gutter={[16, 16]}>
                    {report.paymentMethodsBreakdown.map((payment) => {
                        const info = getPaymentMethodInfo(payment.method);
                        const percentage = ((payment.amount / report.monthlySalesTotal) * 100).toFixed(1);

                        return (
                            <Col xs={24} sm={12} lg={8} key={payment.method}>
                                <Card
                                    style={{
                                        borderLeft: `2px solid ${info.color}`, // Subtle border for detailed view
                                        backgroundColor: info.bgColor,
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                        transition: 'all 0.3s ease',
                                    }}
                                    hoverable
                                    styles={{ body: { padding: 12 } }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{
                                                fontSize: 13,
                                                fontWeight: 500,
                                                marginBottom: 4,
                                                color: info.color,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6
                                            }}>
                                                <span style={{ fontSize: 18 }}>{info.icon}</span>
                                                {info.displayName}
                                            </div>
                                            <div style={{ fontSize: 18, fontWeight: 'bold', color: '#262626' }}>
                                                {currencySymbol} {formatVenezuelanPrice(payment.amount)}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                                {percentage}%
                                            </div>
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