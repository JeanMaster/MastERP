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
    Col
} from 'antd';
import {
    PlusOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
    ReloadOutlined,
    ClearOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { inventoryAdjustmentsApi, type InventoryAdjustment } from '../../services/inventoryAdjustmentsApi';
import { productsApi } from '../../services/productsApi';
import dayjs from 'dayjs';
import { CreateAdjustmentModal } from './components/CreateAdjustmentModal';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const reasonLabels: Record<string, string> = {
    DAMAGE: '🔨 Damage',
    LOSS: '📉 Loss',
    ERROR: '❌ Correction',
    INITIAL: '📦 Initial Stock',
    RETURN: '↩️ Return',
    TRANSFER: '↔️ Transfer',
    OTHER: '📝 Other'
};

/**
 * InventoryAdjustmentsPage Component
 * Management view for manual inventory adjustments (stock counts, damage reports, loss corrections).
 * Provides filters by product, adjustment type, and date range.
 */
export const InventoryAdjustmentsPage = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [filters, setFilters] = useState<any>({});

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
            title: 'Date',
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
            title: 'Product',
            key: 'product',
            render: (_: any, record: InventoryAdjustment) => (
                <div>
                    <div><strong>{record.product.name}</strong></div>
                    <div style={{ fontSize: 11, color: '#888' }}>{record.product.sku}</div>
                </div>
            )
        },
        {
            title: 'Type',
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
                        {isIncrease ? 'Increase' : 'Decrease'}
                    </Tag>
                );
            }
        },
        {
            title: 'Quantity',
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
            title: 'Stock Change',
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
            title: 'Reason',
            dataIndex: 'reason',
            key: 'reason',
            width: 120,
            render: (reason: string) => (
                <Tag>{reasonLabels[reason] || reason}</Tag>
            )
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            ellipsis: true,
            render: (notes: string) => notes || '-'
        },
        {
            title: 'Performed By',
            dataIndex: 'performedBy',
            key: 'performedBy',
            width: 130
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <Title level={2}>📦 Inventory Adjustments</Title>

            <Card style={{ marginBottom: 16 }}>
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                        <Select
                            placeholder="Filter by product"
                            showSearch
                            allowClear
                            style={{ width: '100%' }}
                            optionFilterProp="children"
                            value={filters.productId}
                            onChange={(value) => handleFilterChange('productId', value)}
                            options={products.map(p => ({
                                label: `${p.name} (${p.sku})`,
                                value: p.id
                            }))}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={4}>
                        <Select
                            placeholder="Type"
                            allowClear
                            style={{ width: '100%' }}
                            value={filters.type}
                            onChange={(value) => handleFilterChange('type', value)}
                        >
                            <Select.Option value="INCREASE">↑ Increase</Select.Option>
                            <Select.Option value="DECREASE">↓ Decrease</Select.Option>
                        </Select>
                    </Col>
                    <Col xs={24} sm={12} md={5}>
                        <Select
                            placeholder="Reason"
                            allowClear
                            style={{ width: '100%' }}
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
                            format="MM/DD/YYYY"
                            onChange={handleDateRangeChange}
                        />
                    </Col>
                    <Col xs={24} sm={24} md={3}>
                        <Space>
                            <Button
                                icon={<ClearOutlined />}
                                onClick={handleClearFilters}
                            >
                                Clear
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => refetch()}
                            />
                        </Space>
                    </Col>
                </Row>
            </Card>

            <Card
                title="Adjustment History"
                extra={
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setIsModalVisible(true)}
                    >
                        New Adjustment
                    </Button>
                }
            >
                <Table
                    dataSource={adjustments}
                    columns={columns}
                    rowKey="id"
                    pagination={{
                        pageSize: 15,
                        showTotal: (total) => `Total: ${total} adjustments`
                    }}
                />
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
