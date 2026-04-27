import { useState } from 'react';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { Card, Table, Button, Space, Input, message, Popconfirm, Tag, Tooltip, Grid, Popover, Image } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, PictureOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../services/productsApi';
import type { Product } from '../../services/productsApi';
import { ProductFormModal } from './ProductFormModal';
import { useTranslation } from 'react-i18next';

/**
 * CompositeProductsPage Component
 * Specialized interface for managing composed products (combos or recipes).
 * Lists products that are made up of multiple other components.
 * Supports internationalization (i18n).
 */
export const CompositeProductsPage = () => {
    const { t } = useTranslation();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    // Fetch composite products
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products', 'composed'],
        queryFn: () => productsApi.getAll({ type: 'COMPOSED' }),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: productsApi.delete,
        onSuccess: () => {
            message.success(t('products.composite.delete_success'));
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('common.error'));
        },
    });

    const handleAdd = () => {
        setEditingProduct(null);
        setIsModalOpen(true);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    // Client-side filtering
    const filteredData = products.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        {
            title: t('products.composite.sku'),
            dataIndex: 'sku',
            key: 'sku',
            width: '10%',
        },
        {
            title: t('products.composite.name'),
            dataIndex: 'name',
            key: 'name',
            width: '25%',
            render: (text: string, record: Product) => (
                <Space>
                    {record.images && record.images.length > 0 && (
                        <Popover
                            content={
                                <Image
                                    src={record.images[0]}
                                    alt={text}
                                    style={{ maxWidth: 200, maxHeight: 200 }}
                                    preview={false}
                                />
                            }
                            title={text}
                            trigger="hover"
                            placement="right"
                        >
                            <PictureOutlined style={{ color: '#1890ff', cursor: 'pointer' }} />
                        </Popover>
                    )}
                    <Tooltip title={text} placement="topLeft">
                        <div style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                        }}>
                            {text}
                        </div>
                    </Tooltip>
                </Space>
            ),
        },
        {
            title: t('products.composite.components'),
            key: 'components',
            width: '15%',
            render: (_: any, record: Product) => (
                <Tooltip title={
                    record.components?.map(c => (
                        <div key={c.id}>
                            • {c.componentProduct.name} (x{c.quantity})
                        </div>
                    ))
                }>
                    <Tag icon={<NodeIndexOutlined />} color="purple">
                        {t('products.composite.components_count', { count: record.components?.length || 0 })}
                    </Tag>
                </Tooltip>
            ),
        },
        {
            title: t('products.composite.recipe_cost'),
            key: 'costPrice',
            width: '12%',
            render: (_: any, record: Product) => (
                <span style={{ fontWeight: 'bold' }}>
                    {record.currency.symbol} {record.costPrice.toFixed(2)}
                </span>
            ),
        },
        {
            title: t('products.composite.sale_price'),
            key: 'salePrice',
            width: '12%',
            render: (_: any, record: Product) => (
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                    {formatVenezuelanPrice(record.salePrice, record.currency.symbol, 2, true)}
                </span>
            ),
        },
        {
            title: t('products.composite.category'),
            key: 'category',
            width: '12%',
            render: (_: any, record: Product) => (
                <div>
                    <div>{record.category.name}</div>
                    {record.subcategory && (
                        <div style={{ fontSize: 11, color: '#888' }}>
                            {record.subcategory.name}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: '15%',
            render: (_: any, record: Product) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        {t('common.edit')}
                    </Button>
                    <Popconfirm
                        title={t('products.composite.delete_confirm')}
                        description={t('products.composite.delete_desc')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('common.delete')}
                        cancelText={t('common.cancel')}
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            {t('common.delete')}
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={!isMobile ? t('products.composite.title') : undefined}
            extra={!isMobile ? (
                <Space>
                    <Input
                        placeholder={t('products.composite.search_placeholder')}
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                        allowClear
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        {t('products.composite.new_button')}
                    </Button>
                </Space>
            ) : null}
        >
            {isMobile && (
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, marginBottom: 16 }}>{t('products.composite.mobile_title')}</h2>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Input
                            placeholder={t('products.composite.search_placeholder')}
                            prefix={<SearchOutlined />}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%' }}
                            size="large"
                            allowClear
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAdd}
                                style={{ flex: 1 }}
                                size="large"
                            >
                                {t('products.composite.new_button')}
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })}
                                size="large"
                            />
                        </div>
                    </Space>
                </div>
            )}

            <Table
                columns={columns}
                dataSource={filteredData}
                rowKey="id"
                loading={isLoading}
                scroll={{ x: isMobile ? 800 : undefined }}
                pagination={{
                    defaultPageSize: 15,
                    showSizeChanger: true,
                    pageSizeOptions: ['10', '15', '20', '50', '100'],
                    showTotal: (total, range) => t('products.composite.pagination_total', { rangeStart: range[0], rangeEnd: range[1], total }),
                    size: isMobile ? 'small' : 'default',
                    responsive: true,
                    position: ['bottomRight']
                }}
            />

            <ProductFormModal
                open={isModalOpen}
                product={editingProduct}
                onClose={handleModalClose}
                defaultType="COMPOSED"
            />
        </Card>
    );
};
