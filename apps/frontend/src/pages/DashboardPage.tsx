import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Table, Spin, Empty, Segmented, FloatButton, Typography, Grid } from 'antd';
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

const { Title, Text } = Typography;

export const DashboardPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;

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

                // Default to Primary
                if (primary) {
                    setSelectedCurrencyId(primary.id);
                }

            } catch (error) {
                console.error("Error initializing dashboard:", error);
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
        <div style={{ padding: isMobile ? 12 : 24 }}>
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                        <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>📊 {t('dashboard.title')}</Title>
                        <Text type="secondary">{t('dashboard.summary')}</Text>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', gap: 12, justifyContent: isMobile ? 'flex-start' : 'flex-end', flexWrap: 'wrap' }}>
                            <Select
                                style={{ width: 120 }}
                                value={selectedCurrencyId}
                                onChange={setSelectedCurrencyId}
                                options={currencies.map(c => ({ label: c.code, value: c.id }))}
                                size="large"
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
                                size="large"
                            />
                        </div>
                    </Col>
                </Row>
            </div>

            {/* KPI Cards */}
            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f6ffed' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>{t('dashboard.sales_today').toUpperCase()}</Text>}
                            value={getConvertedAmount(stats.todaySales)}
                            precision={2}
                            prefix={currentSymbol}
                            styles={{ content: { color: '#52c41a', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                            suffix={<ShoppingCartOutlined style={{ opacity: 0.5 }} />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={24} lg={7}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#e6f7ff', border: '1px solid #1890ff44' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>{t('dashboard.sales_month_revalued').toUpperCase()}</Text>}
                            value={getConvertedAmount(stats.thisMonthSales)}
                            precision={2}
                            prefix={currentSymbol}
                            styles={{ content: { color: '#1890ff', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                            suffix={
                                salesMonthChange >= 0 ? (
                                    <ArrowUpOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                                ) : (
                                    <ArrowDownOutlined style={{ color: '#ff4d4f', fontSize: '16px' }} />
                                )
                            }
                        />
                        <div style={{ marginTop: 8, fontSize: 11, color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                            <Text type={salesMonthChange >= 0 ? 'success' : 'danger'} strong>
                                {salesMonthChange >= 0 ? '+' : ''}{salesMonthChangePercent}% {t('dashboard.vs_last_month')}
                            </Text>
                            <span title={t('dashboard.nominal_desc')}>
                                {t('dashboard.nominal')}: {formatVenezuelanPrice(getConvertedAmount(stats.thisMonthSalesNominal), currentSymbol)}
                            </span>
                        </div>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f9f0ff' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>{t('dashboard.cash_balance').toUpperCase()}</Text>}
                            value={getConvertedAmount(stats.cashBalance)}
                            precision={2}
                            prefix={currentSymbol}
                            styles={{ content: { color: '#722ed1', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                            suffix={<BankOutlined style={{ opacity: 0.5 }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={5}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fff1f0' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>{t('dashboard.returns_exchanges').toUpperCase()}</Text>}
                            value={getConvertedAmount(stats.monthReturns?.netImpact || 0)}
                            precision={2}
                            prefix={currentSymbol}
                            styles={{ content: { color: '#ff4d4f', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                            suffix={<RollbackOutlined style={{ opacity: 0.5 }} />}
                        />
                        <div style={{ marginTop: 4, fontSize: 10, color: '#8c8c8c' }}>
                            {t('dashboard.refunds')}: {formatVenezuelanPrice(getConvertedAmount(stats.monthReturns?.totalRefundsPaid || 0), currentSymbol)}
                        </div>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={2}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: stats.criticalStock > 0 ? '#fff7e6' : '#f6ffed' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>ALERTA</Text>}
                            value={stats.criticalStock}
                            styles={{ content: { color: stats.criticalStock > 0 ? '#faad14' : '#52c41a', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                            prefix={stats.criticalStock > 0 ? <WarningOutlined /> : <ShopOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Charts and Tables */}
            <Row gutter={[16, 16]}>
                {/* Sales Trend */}
                <Col xs={24} lg={16}>
                    <Card variant="borderless" title={<Text strong>{t('dashboard.sales_trend')}</Text>} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ width: '100%', height: 300, minHeight: 300, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                                <LineChart data={stats.salesTrend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={10} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={10} />
                                    <Tooltip
                                        formatter={(value: number) => formatVenezuelanPrice(value, currentSymbol)}
                                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey={(data) => getConvertedAmount(data.sales)}
                                        name={t('pos.footer.total')}
                                        stroke="#1890ff"
                                        strokeWidth={3}
                                        dot={{ fill: '#1890ff', r: 4 }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>

                {/* Top Products */}
                <Col xs={24} lg={8}>
                    <Card variant="borderless" title={<Text strong>{t('dashboard.top_products')}</Text>} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
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
            <Card variant="borderless" title={<Text strong>{t('dashboard.quick_access')}</Text>} style={{ marginTop: 16, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Row gutter={[12, 12]}>
                    <Col xs={24} sm={8}>
                        <Button
                            type="primary"
                            size="large"
                            icon={<ShoppingCartOutlined />}
                            onClick={() => navigate('/app/sales/pos')}
                            block
                            style={{ height: 60, borderRadius: 12, fontWeight: 600 }}
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
                            style={{ height: 60, borderRadius: 12, fontWeight: 600 }}
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
                            style={{ height: 60, borderRadius: 12, fontWeight: 600 }}
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
