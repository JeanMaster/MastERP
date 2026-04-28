import { useEffect, useState } from 'react';
import { Card, Table, Spin, Empty, Row, Col, Statistic, Tooltip } from 'antd';
import { ShopOutlined, DollarOutlined, WarningOutlined } from '@ant-design/icons';
import { statsApi, type InventoryReport } from '../../../services/statsApi';
import { usePOSStore } from '../../../store/posStore';
import { ReportCurrencySelector } from './ReportCurrencySelector';
import { formatVenezuelanPriceOnly } from '../../../utils/formatters';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export const InventoryReports = () => {
    const { t } = useTranslation();
    const [report, setReport] = useState<InventoryReport | null>(null);
    const [loading, setLoading] = useState(true);
    const { primaryCurrency, currencies } = usePOSStore();
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const [pageSize, setPageSize] = useState<number>(10);

    const currentCurrencyObj = currencies.find(c => c.code === selectedCurrency);
    const currencySymbol = currentCurrencyObj?.symbol || 'Bs';

    // Initialize to primary
    useEffect(() => {
        if (primaryCurrency && selectedCurrency === 'VES') {
            setSelectedCurrency(primaryCurrency.code);
        }
    }, [primaryCurrency]);

    useEffect(() => {
        if (selectedCurrency) {
            fetchReport();
        }
    }, [selectedCurrency]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const data = await statsApi.getInventoryReport(selectedCurrency);
            setReport(data);
        } catch (error) {
            console.error('Error fetching inventory report:', error);
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
        return <Empty description={t('common.error')} />;
    }

    const deptColumns = [
        {
            title: t('common.department'),
            dataIndex: 'department',
            key: 'department',
        },
        {
            title: t('common.units'),
            dataIndex: 'units',
            key: 'units',
            align: 'right' as const,
            sorter: (a: any, b: any) => a.units - b.units,
        },
        {
            title: t('common.total_value'),
            dataIndex: 'value',
            key: 'value',
            align: 'right' as const,
            sorter: (a: any, b: any) => a.value - b.value,
            render: (value: number) => `${currencySymbol} ${formatVenezuelanPriceOnly(value)}`,
        },
    ];

    const depletionColumns = [
        { title: t('common.product'), dataIndex: 'name', key: 'name' },
        { title: t('common.category'), dataIndex: 'category', key: 'category' },
        { title: t('common.stock'), dataIndex: 'stock', key: 'stock', align: 'right' as const },
        {
            title: t('reports.inventory.velocity'),
            dataIndex: 'dailySalesVelocity',
            key: 'velocity',
            align: 'right' as const,
            render: (v: number) => v.toFixed(2)
        },
        {
            title: t('reports.inventory.days_left'),
            dataIndex: 'daysRemaining',
            key: 'daysRemaining',
            align: 'right' as const,
            sorter: (a: any, b: any) => a.daysRemaining - b.daysRemaining,
            render: (d: number) => (
                <span style={{ color: d <= 7 ? '#ff4d4f' : d <= 14 ? '#faad14' : '#52c41a', fontWeight: 'bold' }}>
                    {d} {t('common.days')}
                </span>
            )
        },
        {
            title: t('reports.inventory.needed_6m'),
            dataIndex: 'unitsNeeded6Months',
            key: 'needed',
            align: 'right' as const,
            render: (n: number) => (
                <Tooltip title={t('reports.inventory.needed_6m_tooltip')}>
                    <Text strong>{n}</Text>
                </Tooltip>
            )
        },
    ];

    const lowStockColumns = [
        {
            title: t('common.product'),
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: t('common.category'),
            dataIndex: ['category', 'name'],
            key: 'category',
        },
        {
            title: t('common.stock'),
            dataIndex: 'stock',
            key: 'stock',
            align: 'right' as const,
            sorter: (a: any, b: any) => a.stock - b.stock,
            render: (stock: number) => (
                <span style={{ color: stock === 0 ? '#ff4d4f' : '#faad14' }}>
                    {stock}
                </span>
            ),
        },
    ];

    return (
        <div>
            {/* Summary Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Tooltip
                            title={
                                <div>
                                    <div style={{ marginBottom: 4, fontWeight: 'bold' }}>{t('reports.inventory.currency_selector_title')}</div>
                                    <ReportCurrencySelector
                                        value={selectedCurrency}
                                        onChange={setSelectedCurrency}
                                    />
                                </div>
                            }
                        >
                            <div style={{ cursor: 'pointer' }}>
                                <Statistic
                                    title={
                                        <span>
                                            {t('reports.inventory.total_value')} <DollarOutlined style={{ fontSize: 12, marginLeft: 4 }} />
                                        </span>
                                    }
                                    value={report.totalInventoryValue}
                                    precision={2}
                                    prefix={currencySymbol}
                                    valueStyle={{ color: '#1890ff' }}
                                    styles={{ content: { color: '#1890ff' } }}
                                />
                            </div>
                        </Tooltip>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title={t('reports.inventory.departments')}
                            value={report.stockByDepartment.length}
                            valueStyle={{ color: '#52c41a' }}
                            styles={{ content: { color: '#52c41a' } }}
                            suffix={<ShopOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title={t('reports.inventory.low_stock')}
                            value={report.lowStockProducts.length}
                            valueStyle={{ color: '#faad14' }}
                            styles={{ content: { color: '#faad14' } }}
                            suffix={<WarningOutlined />}
                        />
                        <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
                            {t('common.units')} {'<'} 10
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card>
                        <Statistic
                            title={t('reports.inventory.near_depletion')}
                            value={report.depletionForecast.length}
                            valueStyle={{ color: '#ff4d4f' }}
                            styles={{ content: { color: '#ff4d4f' } }}
                            suffix={<WarningOutlined />}
                        />
                        <div style={{ marginTop: 8, fontSize: 10, color: '#666' }}>
                            {t('reports.inventory.depletion_notice')}
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Depletion Forecast */}
            <Card
                title={t('reports.inventory.forecast_title')}
                style={{ marginBottom: 16 }}
                extra={<span style={{ fontSize: 12, color: '#666' }}>{t('reports.inventory.forecast_desc')}</span>}
            >
                <Table
                    dataSource={report.depletionForecast}
                    columns={depletionColumns}
                    rowKey="name"
                    pagination={{
                        defaultPageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50']
                    }}
                />
            </Card>

            {/* Stock by Department */}
            <Card title={t('reports.inventory.stock_by_dept')} style={{ marginBottom: 16 }}>
                <Table
                    dataSource={report.stockByDepartment}
                    columns={deptColumns}
                    rowKey="department"
                    pagination={false}
                />
            </Card>

            {/* Low Stock Products */}
            <Card title={t('reports.inventory.low_stock_title')}>
                <Table
                    dataSource={report.lowStockProducts}
                    columns={lowStockColumns}
                    rowKey="name"
                    pagination={{
                        pageSize,
                        showSizeChanger: true,
                        onShowSizeChange: (_, size) => setPageSize(size),
                        pageSizeOptions: ['10', '20', '50', '100']
                    }}
                />
            </Card>
        </div>
    );
};
