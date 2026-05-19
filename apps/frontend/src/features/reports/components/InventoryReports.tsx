import { useEffect, useState } from 'react';
import { Card, Table, Spin, Empty, Row, Col, Statistic, Tooltip, Grid, Tag, Pagination } from 'antd';
import {
    WarningOutlined,
    ShopOutlined
} from '@ant-design/icons';
import { statsApi, type InventoryReport } from '../../../services/statsApi';
import { usePOSStore } from '../../../store/posStore';
import { ReportCurrencySelector } from './ReportCurrencySelector';
import { formatVenezuelanPriceOnly } from '../../../utils/formatters';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export const InventoryReports = () => {
    const { t } = useTranslation();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
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
        <div style={{ padding: isMobile ? 0 : 4 }}>
            {/* Summary Cards */}
            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#e6f7ff' }} styles={{ body: { padding: 16 } }}>
                        <Tooltip
                            title={
                                <div>
                                    <div style={{ marginBottom: 8, fontWeight: 'bold' }}>{t('reports.inventory.currency_selector_title')}</div>
                                    <ReportCurrencySelector
                                        value={selectedCurrency}
                                        onChange={setSelectedCurrency}
                                    />
                                </div>
                            }
                            trigger={isMobile ? 'click' : 'hover'}
                        >
                            <div style={{ cursor: 'pointer' }}>
                                <Statistic
                                    title={<Text type="secondary" style={{ fontSize: 11 }}>VALOR TOTAL</Text>}
                                    value={report.totalInventoryValue}
                                    precision={2}
                                    prefix={currencySymbol}
                                    styles={{ content: { color: '#1890ff', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                                />
                                <Text type="secondary" style={{ fontSize: 10 }}>Capital inmovilizado</Text>
                            </div>
                        </Tooltip>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f6ffed' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>DEPARTAMENTOS</Text>}
                            value={report.stockByDepartment.length}
                            styles={{ content: { color: '#52c41a', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                            suffix={<ShopOutlined style={{ opacity: 0.5 }} />}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Categorías activas</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fffbe6' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>STOCK BAJO</Text>}
                            value={report.lowStockProducts.length}
                            styles={{ content: { color: '#faad14', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                            suffix={<WarningOutlined style={{ opacity: 0.5 }} />}
                        />
                        <Text type="warning" style={{ fontSize: 10 }}>Unidades {'<'} 10</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={6}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fff1f0' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>POR AGOTARSE</Text>}
                            value={report.depletionForecast.length}
                            styles={{ content: { color: '#ff4d4f', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                            suffix={<WarningOutlined style={{ opacity: 0.5 }} />}
                        />
                        <Text type="danger" style={{ fontSize: 10 }}>Próximos 7 días</Text>
                    </Card>
                </Col>
            </Row>

            {/* Depletion Forecast */}
            <Card
                title={t('reports.inventory.forecast_title')}
                style={{ marginBottom: 16, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                extra={isMobile ? null : <span style={{ fontSize: 12, color: '#666' }}>{t('reports.inventory.forecast_desc')}</span>}
                styles={{ body: { padding: isMobile ? 0 : 24 } }}
            >
                {!isMobile ? (
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
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 8px' }}>
                        {report.depletionForecast.slice(0, 10).map((item: any) => (
                            <div key={item.name} style={{ 
                                padding: '16px', 
                                background: '#fff', 
                                borderRadius: 16, 
                                borderLeft: `4px solid ${item.daysRemaining <= 7 ? '#ff4d4f' : item.daysRemaining <= 14 ? '#faad14' : '#52c41a'}`,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)' 
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div style={{ maxWidth: '60%' }}>
                                        <Text strong style={{ fontSize: 14 }}>{item.name}</Text>
                                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>{item.category}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 10, color: '#8c8c8c', textTransform: 'uppercase' }}>{t('reports.inventory.days_left')}</div>
                                        <Tag color={item.daysRemaining <= 7 ? 'red' : item.daysRemaining <= 14 ? 'orange' : 'green'} style={{ margin: 0, fontWeight: 700 }}>
                                            {item.daysRemaining} {t('common.days')}
                                        </Tag>
                                    </div>
                                </div>
                                
                                <Row gutter={16} style={{ marginBottom: 12 }}>
                                    <Col span={12}>
                                        <Text type="secondary" style={{ fontSize: 11 }}>{t('common.stock')}:</Text>
                                        <div style={{ fontWeight: 600 }}>{item.stock} ud</div>
                                    </Col>
                                    <Col span={12}>
                                        <Text type="secondary" style={{ fontSize: 11 }}>{t('reports.inventory.velocity')}:</Text>
                                        <div style={{ fontWeight: 600 }}>{item.dailySalesVelocity.toFixed(2)} ud/día</div>
                                    </Col>
                                </Row>
                                
                                <div style={{ background: '#f9f9f9', padding: '8px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text strong style={{ fontSize: 12, color: '#1890ff' }}>{t('reports.inventory.needed_6m')}:</Text>
                                    <Text strong style={{ fontSize: 14 }}>{item.unitsNeeded6Months} ud</Text>
                                </div>
                            </div>
                        ))}
                        <div style={{ padding: '12px', textAlign: 'center' }}>
                            <Pagination size="small" total={report.depletionForecast.length} pageSize={10} simple onChange={() => {}} />
                        </div>
                    </div>
                )}
            </Card>

            {/* Stock by Department */}
            <Card 
                title={t('reports.inventory.stock_by_dept')} 
                style={{ marginBottom: 16, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                styles={{ body: { padding: isMobile ? 0 : 24 } }}
            >
                {!isMobile ? (
                    <Table
                        dataSource={report.stockByDepartment}
                        columns={deptColumns}
                        rowKey="department"
                        pagination={false}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {report.stockByDepartment.map((item: any) => (
                            <div key={item.department} style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{item.department}</div>
                                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>{item.units} {t('common.units')}</div>
                                </div>
                                <Text strong>{currencySymbol} {formatVenezuelanPriceOnly(item.value)}</Text>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Low Stock Products */}
            <Card 
                title={t('reports.inventory.low_stock_title')}
                style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                styles={{ body: { padding: isMobile ? 0 : 24 } }}
            >
                {!isMobile ? (
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
                ) : (
                    <div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {report.lowStockProducts.slice(0, 10).map((item: any) => (
                                <div key={item.name} style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>{item.category?.name}</div>
                                    </div>
                                    <Tag color={item.stock === 0 ? 'red' : 'orange'} style={{ margin: 0 }}>
                                        {item.stock} {t('common.units')}
                                    </Tag>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding: '12px', textAlign: 'center' }}>
                            <Pagination size="small" total={report.lowStockProducts.length} pageSize={10} simple />
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};
