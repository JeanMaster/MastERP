import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Table, Spin, Empty, Segmented, FloatButton } from 'antd';
import {
    ShoppingCartOutlined,
    ShopOutlined,
    BankOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
    PlusOutlined,
    FileTextOutlined,
    WarningOutlined,
    RobotOutlined,
    RollbackOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { statsApi, type DashboardStats } from '../services/statsApi';
import { formatVenezuelanPrice } from '../utils/formatters';
import { Select } from 'antd';
import { currenciesApi, type Currency } from '../services/currenciesApi';
import { companySettingsApi } from '../services/companySettingsApi';
import { useAuth } from '../features/auth/AuthProvider';
import { AIAssistantModal } from '../components/AIAssistantModal';
import { useTranslation } from 'react-i18next';

export const DashboardPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Redirect Cashiers to POS as they shouldn't see the dashboard
    useEffect(() => {
        if (user?.role === 'CASHIER') {
            navigate('/app/sales/pos', { replace: true });
        }
    }, [user, navigate]);

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('7days');
    const [aiModalVisible, setAiModalVisible] = useState(false);

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
                if (primary) {
                    setSelectedCurrencyId(primary.id);
                }

            } catch (error) {
                console.error("Error initializing dashboard:", error);
            } finally {
                // setLoading(false) is called in fetchStats
            }
        };

        initialize();
    }, []);

    useEffect(() => {
        fetchStats();
    }, [range]);

    const fetchStats = async () => {
        try {
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
                <Empty description={t('common.error_loading')} />
            </div>
        );
    }

    const salesMonthChange = stats.thisMonthSales - stats.lastMonthSales;
    const salesMonthChangePercent = stats.lastMonthSales
        ? ((salesMonthChange / stats.lastMonthSales) * 100).toFixed(1)
        : 0;

    const topProductsColumns = [
        {
            title: t('products.finished.name'),
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: t('common.units_sold'),
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
                        <h1 className="responsive-title" style={{ margin: 0 }}>📊 {t('dashboard.title')}</h1>
                        <p style={{ color: '#666', marginTop: 8 }}>
                            {t('dashboard.summary')}
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
                                { label: '7 D', value: '7days' },
                                { label: '1 M', value: '30days' },
                                { label: '1 A', value: '1year' },
                                { label: t('common.all'), value: 'all' },
                            ]}
                            value={range}
                            onChange={(value) => setRange(value as string)}
                        />
                    </Col>
                </Row>
            </div>

            {/* KPI Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={4}>
                    <Card size="small">
                        <Statistic
                            title={t('dashboard.sales_today')}
                            value={getConvertedAmount(stats.todaySales)}
                            precision={2}
                            prefix={currentSymbol}
                            valueStyle={{ color: '#3f8600', fontSize: '20px' }}
                            styles={{ content: { color: '#3f8600', fontSize: '20px' } }}
                            suffix={<ShoppingCartOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={7}>
                    <Card size="small" style={{ border: '1px solid #1890ff44' }}>
                        <Statistic
                            title={t('dashboard.sales_month_revalued')}
                            value={getConvertedAmount(stats.thisMonthSales)}
                            precision={2}
                            prefix={currentSymbol}
                            valueStyle={{ color: '#1890ff', fontSize: '20px' }}
                            styles={{ content: { color: '#1890ff', fontSize: '20px' } }}
                            suffix={
                                salesMonthChange >= 0 ? (
                                    <ArrowUpOutlined style={{ color: '#3f8600', fontSize: '14px' }} />
                                ) : (
                                    <ArrowDownOutlined style={{ color: '#cf1322', fontSize: '14px' }} />
                                )
                            }
                        />
                        <div style={{ marginTop: 4, fontSize: 11, color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{salesMonthChange >= 0 ? '+' : ''}{salesMonthChangePercent}% {t('dashboard.vs_last_month')}</span>
                            <span title={t('dashboard.nominal_desc')}>
                                {t('dashboard.nominal')}: {formatVenezuelanPrice(getConvertedAmount(stats.thisMonthSalesNominal), currentSymbol)}
                            </span>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card size="small">
                        <Statistic
                            title={t('dashboard.cash_balance')}
                            value={getConvertedAmount(stats.cashBalance)}
                            precision={2}
                            prefix={currentSymbol}
                            valueStyle={{ color: '#722ed1', fontSize: '20px' }}
                            styles={{ content: { color: '#722ed1', fontSize: '20px' } }}
                            suffix={<BankOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={5}>
                    <Card size="small" style={{ borderColor: '#ff4d4f99' }}>
                        <Statistic
                            title={t('dashboard.returns_exchanges')}
                            value={getConvertedAmount(stats.monthReturns?.netImpact || 0)}
                            precision={2}
                            prefix={currentSymbol}
                            valueStyle={{ color: '#ff4d4f', fontSize: '20px' }}
                            styles={{ content: { color: '#ff4d4f', fontSize: '20px' } }}
                            suffix={<RollbackOutlined />}
                        />
                        <div style={{ marginTop: 4, fontSize: 11, color: '#666' }}>
                            {t('dashboard.refunds')}: {formatVenezuelanPrice(getConvertedAmount(stats.monthReturns?.totalRefundsPaid || 0), currentSymbol)}
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card size="small" style={{ borderColor: stats.criticalStock > 0 ? '#faad14' : undefined }}>
                        <Statistic
                            title={t('dashboard.critical_stock')}
                            value={stats.criticalStock}
                            suffix={`/ ${stats.totalProducts}`}
                            valueStyle={{ color: stats.criticalStock > 0 ? '#faad14' : '#52c41a', fontSize: '20px' }}
                            styles={{ content: { color: stats.criticalStock > 0 ? '#faad14' : '#52c41a', fontSize: '20px' } }}
                            prefix={stats.criticalStock > 0 ? <WarningOutlined /> : <ShopOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Charts and Tables */}
            <Row gutter={[16, 16]}>
                {/* Sales Trend */}
                <Col xs={24} lg={16}>
                    <Card title={t('dashboard.sales_trend')}>
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
                                    name={t('pos.footer.total')}
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
                    <Card title={t('dashboard.top_products')}>
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
            <Card title={t('dashboard.quick_access')} style={{ marginTop: 16 }}>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={8}>
                        <Button
                            type="primary"
                            size="large"
                            icon={<ShoppingCartOutlined />}
                            onClick={() => navigate('/app/sales/pos')}
                            block
                        >
                            {t('dashboard.pos_button')}
                        </Button>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Button
                            size="large"
                            icon={<PlusOutlined />}
                            onClick={() => navigate('/app/purchases/history')}
                            block
                        >
                            {t('dashboard.register_purchase')}
                        </Button>
                    </Col>
                    <Col xs={24} sm={8}>
                        <Button
                            size="large"
                            icon={<FileTextOutlined />}
                            onClick={() => navigate('/app/reports')}
                            block
                        >
                            {t('dashboard.view_reports')}
                        </Button>
                    </Col>
                </Row>
            </Card>

            {/* AI Assistant FloatButton */}
            <FloatButton
                icon={<RobotOutlined />}
                type="primary"
                style={{ right: 24, bottom: 24 }}
                tooltip={t('dashboard.ai_assistant')}
                onClick={() => setAiModalVisible(true)}
            />

            {/* AI Assistant Modal */}
            <AIAssistantModal
                visible={aiModalVisible}
                onClose={() => setAiModalVisible(false)}
            />
        </div>
    );
};
