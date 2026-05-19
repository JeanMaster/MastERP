import { useState } from 'react';
import {
    Card,
    Table,
    Button,
    Select,
    DatePicker,
    Space,
    Tag,
    Typography,
    Row,
    Col,
    Grid,
    List
} from 'antd';
import {
    PlusOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
    ReloadOutlined,
    ClearOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { inventoryAdjustmentsApi, type InventoryAdjustment } from '../../services/inventoryAdjustmentsApi';
import { productsApi } from '../../services/productsApi';
import dayjs from 'dayjs';
import { CreateAdjustmentModal } from './components/CreateAdjustmentModal';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

/**
 * InventoryAdjustmentsPage Component
 * Management view for manual inventory adjustments (stock counts, damage reports, loss corrections).
 * Provides filters by product, adjustment type, and date range.
 */
export const InventoryAdjustmentsPage = () => {
    const { t } = useTranslation();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [filters, setFilters] = useState<any>({});

    const reasonLabels: Record<string, string> = {
        DAMAGE: t('adjustments.reasons.DAMAGE'),
        LOSS: t('adjustments.reasons.LOSS'),
        ERROR: t('adjustments.reasons.ERROR'),
        INITIAL: t('adjustments.reasons.INITIAL'),
        RETURN: t('adjustments.reasons.RETURN'),
        TRANSFER: t('adjustments.reasons.TRANSFER'),
        OTHER: t('adjustments.reasons.OTHER')
    };

    const { data: adjustments = [], refetch } = useQuery({
        queryKey: ['inventory-adjustments', filters],
        queryFn: () => inventoryAdjustmentsApi.findAll(filters)
    });

    const { data: products = [] } = useQuery({
        queryKey: ['products-active'],
        queryFn: () => productsApi.getAll()
    });

    const handleFilterChange = (key: string, value: any) => {
        setFilters((prev: any) => ({
            ...prev,
            [key]: value
        }));
    };

    const handleDateRangeChange = (dates: any) => {
        if (dates) {
            setFilters((prev: any) => ({
                ...prev,
                startDate: dates[0].format('YYYY-MM-DD'),
                endDate: dates[1].format('YYYY-MM-DD')
            }));
        } else {
            setFilters((prev: any) => {
                const { startDate, endDate, ...rest } = prev;
                return rest;
            });
        }
    };

    const handleClearFilters = () => {
        setFilters({});
    };

    const columns = [
        {
            title: t('adjustments.date'),
            dataIndex: 'createdAt',
            key: 'date',
            width: 150,
            render: (date: string) => (
                <div>
                    <div><strong>{dayjs(date).format('MM/DD/YYYY')}</strong></div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                        {dayjs(date).format('HH:mm')}
                    </div>
                </div>
            )
        },
        {
            title: t('adjustments.product'),
            key: 'product',
            render: (_: any, record: InventoryAdjustment) => (
                <div>
                    <div><strong>{record.product.name}</strong></div>
                    <div style={{ fontSize: 11, color: '#888' }}>{record.product.sku}</div>
                </div>
            )
        },
        {
            title: t('adjustments.type'),
            dataIndex: 'type',
            key: 'type',
            width: 120,
            align: 'center' as const,
            render: (type: string) => {
                const isIncrease = type === 'INCREASE';
                return (
                    <Tag
                        icon={isIncrease ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                        color={isIncrease ? 'success' : 'error'}
                    >
                        {isIncrease ? t('adjustments.increase') : t('adjustments.decrease')}
                    </Tag>
                );
            }
        },
        {
            title: t('adjustments.quantity'),
            dataIndex: 'quantity',
            key: 'quantity',
            width: 100,
            align: 'right' as const,
            render: (quantity: number, record: InventoryAdjustment) => {
                const isIncrease = record.type === 'INCREASE';
                return (
                    <Text strong style={{ color: isIncrease ? '#52c41a' : '#ff4d4f' }}>
                        {isIncrease ? '+' : '-'}{quantity}
                    </Text>
                );
            }
        },
        {
            title: t('adjustments.stock_change'),
            key: 'stock',
            width: 150,
            align: 'center' as const,
            render: (_: any, record: InventoryAdjustment) => (
                <div>
                    <span style={{ color: '#888' }}>{record.previousStock}</span>
                    {' → '}
                    <strong style={{ color: '#1890ff' }}>{record.newStock}</strong>
                </div>
            )
        },
        {
            title: t('adjustments.reason'),
            dataIndex: 'reason',
            key: 'reason',
            width: 120,
            render: (reason: string) => (
                <Tag>{reasonLabels[reason] || reason}</Tag>
            )
        },
        {
            title: t('adjustments.notes'),
            dataIndex: 'notes',
            key: 'notes',
            ellipsis: true,
            render: (notes: string) => notes || '-'
        },
        {
            title: t('adjustments.performed_by'),
            dataIndex: 'performedBy',
            key: 'performedBy',
            width: 130
        }
    ];

    const isMobile = !Grid.useBreakpoint().lg;

    return (
        <div style={{ padding: isMobile ? 8 : 24 }}>
            <Title level={isMobile ? 3 : 2} style={{ marginBottom: 16 }}>📦 {t('adjustments.title')}</Title>

            <Card style={{ marginBottom: 16 }} styles={{ body: { padding: isMobile ? 12 : 24 } }}>
                <Row gutter={[12, 12]}>
                    <Col xs={24} sm={12} md={6}>
                        <Select
                            placeholder={t('adjustments.search_product')}
                            showSearch
                            allowClear
                            style={{ width: '100%' }}
                            size={isMobile ? 'large' : 'middle'}
                            optionFilterProp="children"
                            value={filters.productId}
                            onChange={(value) => handleFilterChange('productId', value)}
                            options={products.map(p => ({
                                label: `${p.name} (${p.sku})`,
                                value: p.id
                            }))}
                        />
                    </Col>
                    <Col xs={12} sm={6} md={4}>
                        <Select
                            placeholder={t('adjustments.type')}
                            allowClear
                            style={{ width: '100%' }}
                            size={isMobile ? 'large' : 'middle'}
                            value={filters.type}
                            onChange={(value) => handleFilterChange('type', value)}
                        >
                            <Select.Option value="INCREASE">↑ {t('adjustments.increase')}</Select.Option>
                            <Select.Option value="DECREASE">↓ {t('adjustments.decrease')}</Select.Option>
                        </Select>
                    </Col>
                    <Col xs={12} sm={6} md={5}>
                        <Select
                            placeholder={t('adjustments.reason')}
                            allowClear
                            style={{ width: '100%' }}
                            size={isMobile ? 'large' : 'middle'}
                            value={filters.reason}
                            onChange={(value) => handleFilterChange('reason', value)}
                        >
                            {Object.entries(reasonLabels).map(([key, label]) => (
                                <Select.Option key={key} value={key}>
                                    {label}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <RangePicker
                            style={{ width: '100%' }}
                            size={isMobile ? 'large' : 'middle'}
                            format="MM/DD/YYYY"
                            onChange={handleDateRangeChange}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={3}>
                        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                            <Button
                                icon={<ClearOutlined />}
                                onClick={handleClearFilters}
                                size={isMobile ? 'large' : 'middle'}
                            >
                                {isMobile ? undefined : t('adjustments.clear_filters')}
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => refetch()}
                                size={isMobile ? 'large' : 'middle'}
                            />
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Card
                title={!isMobile ? t('adjustments.history') : undefined}
                styles={{ body: { padding: isMobile ? 0 : 24 } }}
                extra={!isMobile ? (
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setIsModalVisible(true)}
                    >
                        {t('adjustments.new')}
                    </Button>
                ) : null}
            >
                {isMobile && (
                    <div style={{ padding: '16px 16px 0 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: 16 }}>{t('adjustments.history')}</Text>
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => setIsModalVisible(true)}
                            size="large"
                        >
                            {t('adjustments.new')}
                        </Button>
                    </div>
                )}

                {!isMobile ? (
                    <Table
                        dataSource={adjustments}
                        columns={columns}
                        rowKey="id"
                        pagination={{
                            pageSize: 15,
                            showTotal: (total) => t('adjustments.total_count', { total })
                        }}
                    />
                ) : (
                    <List
                        dataSource={adjustments}
                        style={{ padding: 12 }}
                        pagination={{
                            pageSize: 10,
                            size: 'small',
                            simple: true,
                        }}
                        renderItem={(item: InventoryAdjustment) => {
                            const isIncrease = item.type === 'INCREASE';
                            return (
                                <List.Item
                                    style={{ 
                                        padding: '16px', 
                                        background: '#fff',
                                        marginBottom: 12,
                                        borderRadius: 16,
                                        border: '1px solid #f0f0f0',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                        display: 'block'
                                    }}
                                >
                                    <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 12, color: '#9ca3af' }}>
                                                {dayjs(item.createdAt).format('DD/MM/YYYY')}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#9ca3af' }}>
                                                {dayjs(item.createdAt).format('HH:mm A')}
                                            </div>
                                        </div>
                                        <Tag
                                            icon={isIncrease ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                                            color={isIncrease ? 'success' : 'error'}
                                            style={{ margin: 0, borderRadius: 6, padding: '2px 8px' }}
                                        >
                                            {isIncrease ? t('adjustments.increase') : t('adjustments.decrease')}
                                        </Tag>
                                    </div>
                                    
                                    <div style={{ width: '100%', marginBottom: 12 }}>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{item.product.name}</div>
                                        <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{item.product.sku}</div>
                                    </div>

                                    <div style={{ 
                                        display: 'flex', 
                                        width: '100%', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        background: '#f9fafb',
                                        padding: '10px 12px',
                                        borderRadius: 12,
                                        marginBottom: item.notes ? 12 : 0
                                    }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('adjustments.reason')}</div>
                                            <div style={{ fontWeight: 600, color: '#374151' }}>{reasonLabels[item.reason] || item.reason}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('adjustments.quantity')}</div>
                                            <Text strong style={{ fontSize: 18, color: isIncrease ? '#10b981' : '#ef4444' }}>
                                                {isIncrease ? '+' : '-'}{item.quantity}
                                            </Text>
                                        </div>
                                    </div>
                                    
                                    {item.notes && (
                                        <div style={{ 
                                            padding: '8px 12px', 
                                            borderLeft: '3px solid #e5e7eb',
                                            fontSize: 13, 
                                            color: '#6b7280',
                                            width: '100%',
                                            fontStyle: 'italic',
                                            background: '#ffffff'
                                        }}>
                                            "{item.notes}"
                                        </div>
                                    )}
                                </List.Item>
                            );
                        }}
                    />
                )}
            </Card>

            <CreateAdjustmentModal
                open={isModalVisible}
                onCancel={() => setIsModalVisible(false)}
                onSuccess={() => {
                    setIsModalVisible(false);
                    refetch();
                }}
            />
        </div>
    );
};
