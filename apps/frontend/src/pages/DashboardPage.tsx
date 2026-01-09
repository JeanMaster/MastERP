import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Table, Spin, Empty, Segmented } from 'antd';
import {
    ShoppingCartOutlined,
    ShopOutlined,
    BankOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
    PlusOutlined,
    FileTextOutlined,
    WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { statsApi, type DashboardStats } from '../services/statsApi';
import { formatVenezuelanPrice } from '../utils/formatters';
import { Select } from 'antd';
import { currenciesApi, type Currency } from '../services/currenciesApi';
import { companySettingsApi } from '../services/companySettingsApi';
import { useAuth } from '../features/auth/AuthProvider';

export const DashboardPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // Redirect Cashiers to POS as they shouldn't see the dashboard
    useEffect(() => {
        if (user?.role === 'CASHIER') {
            navigate('/sales/pos', { replace: true });
        }
    }, [user, navigate]);

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('7days');

    // Currency State
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(null);
    const [primaryCurrency, setPrimaryCurrency] = useState<Currency | null>(null);

    useEffect(() => {
        const initialize = async () => {
            setLoading(true);
            try {
                // 1. Fetch Currencies & Settings
                const [allCurrencies] = await Promise.all([
                    currenciesApi.getAll(),
                    companySettingsApi.getSettings()
                ]);
                setCurrencies(allCurrencies);

                const primary = allCurrencies.find(c => c.isPrimary) || null;
                setPrimaryCurrency(primary);

                // Default to Primary, or user preference if we stored it (not implemented yet)
                // Or maybe default to the preferred secondary if set?
                // Let's default to Primary (null means "Raw/Primary" in our logic usually, but here we want explicit ID)
                if (primary) {
                    setSelectedCurrencyId(primary.id);
                }

            } catch (error) {
                console.error("Error initializing dashboard:", error);
            } finally {
                // Initial fetch of stats happens in separate effect or here?
                // Let's let the other effect handle stats fetching to keep it clean,
                // but we need to ensure loading state is managed.
                // Actually, fetchStats handles its own loading.
            }
        };

        initialize();
    }, []);

    useEffect(() => {
        fetchStats();
    }, [range]);

    const fetchStats = async () => {
        try {
            // Only set global loading if it's the first load or range change?
            // Dashboard refresh might ideally be background.
            // keeping simple for now.
            if (!stats) setLoading(true);
            const data = await statsApi.getDashboardStats(range);
            setStats(data);
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper: Convert Amount
    const getConvertedAmount = (amountInBs: number) => {
        if (!selectedCurrencyId || !primaryCurrency) return amountInBs;
        if (selectedCurrencyId === primaryCurrency.id) return amountInBs;

        const targetCurrency = currencies.find(c => c.id === selectedCurrencyId);
        if (!targetCurrency || !targetCurrency.exchangeRate) return amountInBs;

        // Conversion: Amount in Bs / Exchange Rate
        const rate = Number(targetCurrency.exchangeRate);
        if (!rate) return amountInBs;
        return amountInBs / rate;
    };

    const getCurrencySymbol = () => {
        if (!selectedCurrencyId) return 'Bs.';
        const currency = currencies.find(c => c.id === selectedCurrencyId);
        return currency ? currency.symbol : 'Bs.';
    };

    const currentSymbol = getCurrencySymbol();

    const rangeLabels: Record<string, string> = {
        '7days': 'Últimos 7 días',
        '30days': 'Últimos 30 días',
        '1year': 'Último año',
        'all': 'Histórico total'
    };

    if (loading) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!stats) {
        return (
            <div style={{ padding: 24 }}>
                <Empty description="Error al cargar estadísticas" />
            </div>
        );
    }

    const monthChange = stats.thisMonthSales - stats.lastMonthSales;
    const monthChangePercent = stats.lastMonthSales
        ? ((monthChange / stats.lastMonthSales) * 100).toFixed(1)
        : 0;

    const topProductsColumns = [
        {
            title: 'Producto',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Unidades Vendidas',
            dataIndex: 'quantity',
            key: 'quantity',
            align: 'right' as const,
        },
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 24 }}>
                <Row justify="space-between" align="middle">
                    <Col xs={24} sm={12}>
                        <h1 className="responsive-title" style={{ margin: 0 }}>📊 Dashboard</h1>
                        <p style={{ color: '#666', marginTop: 8 }}>
                            Resumen de tu negocio
                        </p>
                    </Col>
                    <Col xs={24} sm={12} style={{ textAlign: 'right', marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <Select
                            style={{ width: 120 }}
                            value={selectedCurrencyId}
                            onChange={setSelectedCurrencyId}
                            options={currencies.map(c => ({ label: c.code, value: c.id }))}
                            loading={currencies.length === 0}
                        />
                        <Segmented
                            options={[
                                { label: '7 D (7D)', value: '7days' },
                                { label: '1 M', value: '30days' },
                                { label: '1 A', value: '1year' },
                                { label: 'Todo', value: 'all' },
                            ]}
                            value={range}
                            onChange={(value) => setRange(value as string)}
                        />
                    </Col>
                </Row>
            </div>

            {/* KPI Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Ventas Hoy"
                            value={getConvertedAmount(stats.todaySales)}
                            precision={2}
                            prefix={currentSymbol}
                            valueStyle={{ color: '#3f8600' }}
                            styles={{ content: { color: '#3f8600' } }}
                            suffix={<ShoppingCartOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Ventas Este Mes"
                            value={getConvertedAmount(stats.thisMonthSales)}
                            precision={2}
                            prefix={currentSymbol}
                            valueStyle={{ color: '#1890ff' }}
                            styles={{ content: { color: '#1890ff' } }}
                            suffix={
                                monthChange >= 0 ? (
                                    <ArrowUpOutlined style={{ color: '#3f8600' }} />
                                ) : (
                                    <ArrowDownOutlined style={{ color: '#cf1322' }} />
                                )
                            }
                        />
                        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                            {monthChange >= 0 ? '+' : ''}
                            {monthChangePercent}% vs mes anterior
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title="Balance de Caja"
                            value={getConvertedAmount(stats.cashBalance)}
                            precision={2}
                            prefix={currentSymbol}
                            valueStyle={{ color: '#722ed1' }}
                            styles={{ content: { color: '#722ed1' } }}
                            suffix={<BankOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card style={{ borderColor: stats.criticalStock > 0 ? '#faad14' : undefined }}>
                        <Statistic
                            title="Stock Crítico"
                            value={stats.criticalStock}
                            suffix={`/ ${stats.totalProducts}`}
                            valueStyle={{ color: stats.criticalStock > 0 ? '#faad14' : '#52c41a' }}
                            styles={{ content: { color: stats.criticalStock > 0 ? '#faad14' : '#52c41a' } }}
                            prefix={stats.criticalStock > 0 ? <WarningOutlined /> : <ShopOutlined />}
                        />
                        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                            Productos totales
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Charts and Tables */}
            <Row gutter={[16, 16]}>
                {/* Sales Trend */}
                <Col xs={24} lg={16}>
                    <Card title={`Tendencia de Ventas (${rangeLabels[range]})`}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={stats.salesTrend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: number) => formatVenezuelanPrice(value, currentSymbol)}
                                />
                                <Line
                                    type="monotone"
                                    dataKey={(data) => getConvertedAmount(data.sales)}
                                    name="Ventas"
                                    stroke="#1890ff"
                                    strokeWidth={2}
                                    dot={{ fill: '#1890ff' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>

                {/* Top Products */}
                <Col xs={24} lg={8}>
                    <Card title="Top 5 Productos Más Vendidos">
                        <Table
                            dataSource={stats.topProducts}
                            columns={topProductsColumns}
                            pagination={false}
                            rowKey="name"
                            size="small"
                        />
                    </Card>
                </Col>
            </Row>

            {/* Quick Actions */}
            <Card title="Accesos Rápidos" style={{ marginTop: 16 }}>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                        <Button
                            type="primary"
                            size="large"
                            icon={<ShoppingCartOutlined />}
                            onClick={() => navigate('/sales/pos')}
                            block
                        >
                            Punto de Venta
                        </Button>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Button
                            size="large"
                            icon={<PlusOutlined />}
                            onClick={() => navigate('/purchases/history')}
                            block
                        >
                            Registrar Compra
                        </Button>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Button
                            size="large"
                            icon={<FileTextOutlined />}
                            onClick={() => navigate('/reports')}
                            block
                        >
                            Ver Reportes
                        </Button>
                    </Col>
                </Row>
            </Card>
        </div>
    );
};
