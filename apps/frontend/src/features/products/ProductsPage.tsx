import { useState } from 'react';
import { Card, Table, Button, Space, Input, App, Popconfirm, Tag, Tooltip, Image, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, PictureOutlined, ShopOutlined, CloudUploadOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../services/productsApi';
import type { Product } from '../../services/productsApi';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { ProductFormModal } from './ProductFormModal';
import { MlPublishModal } from './MlPublishModal';
import { mercadolibreApi } from '../../services/mercadolibreApi';
import { useTranslation } from 'react-i18next';

/**
 * ProductsPage Component
 * Main interface for inventory management of finished goods.
 * Includes search, CRUD operations, and Mercado Libre integration status.
 * Supports internationalization (i18n).
 */
export const ProductsPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isMlModalOpen, setIsMlModalOpen] = useState(false);
    const [mlProduct, setMlProduct] = useState<Product | null>(null);
    const queryClient = useQueryClient();

    // Fetch products
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products'],
        queryFn: () => productsApi.getAll(),
    });

    // Fetch ML mappings and accounts to show status in table
    const { data: mlMappings = [] } = useQuery({
        queryKey: ['ml-mappings'],
        queryFn: () => mercadolibreApi.getMappings(),
    });

    const { data: mlAccounts = [] } = useQuery({
        queryKey: ['ml-accounts'],
        queryFn: () => mercadolibreApi.getAccounts(),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: productsApi.delete,
        onSuccess: () => {
            message.success(t('products.finished.delete_success'));
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
            title: '',
            key: 'image_thumb',
            width: 60,
            render: (_: any, record: Product) => (
                <div style={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #f0f0f0',
                    borderRadius: 4,
                    overflow: 'hidden',
                    backgroundColor: '#fafafa'
                }}>
                    {record.images && record.images.length > 0 ? (
                        <Image
                            src={record.images[0]}
                            alt="thumb"
                            width={40}
                            height={40}
                            style={{ objectFit: 'cover' }}
                            preview={{
                                mask: <div style={{ fontSize: 12 }}><EyeOutlined /></div>,
                            }}
                        />
                    ) : (
                        <PictureOutlined style={{ color: '#ccc', fontSize: 20 }} />
                    )}
                </div>
            ),
        },
        {
            title: t('products.finished.sku'),
            dataIndex: 'sku',
            key: 'sku',
            width: '10%',
        },
        {
            title: t('products.finished.name'),
            dataIndex: 'name',
            key: 'name',
            width: '20%',
            render: (text: string, record: Product) => (
                <Space>
                    <Tooltip title={text} placement="topLeft">
                        <div
                            style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: 'pointer',
                                fontWeight: 500,
                                color: '#1890ff'
                            }}
                            onClick={() => {
                                setEditingProduct(record);
                                setIsModalOpen(true);
                            }}
                        >
                            {text}
                        </div>
                    </Tooltip>
                    {record.type === 'COMPOSED' && (
                        <Tooltip title={t('products.finished.combo_tooltip')}>
                            <Tag color="purple" style={{ fontSize: '10px' }}>{t('products.finished.combo_tag')}</Tag>
                        </Tooltip>
                    )}
                </Space>
            ),
        },
        {
            title: t('products.finished.category'),
            key: 'category',
            width: '12%',
            render: (_: any, record: Product) => (
                <div>
                    <div>{record.category.name}</div>
                    {record.subcategory && (
                        <div style={{ fontSize: 12, color: '#888' }}>
                            → {record.subcategory.name}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: t('products.finished.currency'),
            key: 'currency',
            width: '8%',
            render: (_: any, record: Product) => (
                <Tag color="blue">{record.currency.symbol}</Tag>
            ),
        },
        {
            title: t('products.finished.cost_price'),
            key: 'costPrice',
            width: '10%',
            render: (_: any, record: Product) => (
                <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    display: 'inline-block'
                }}>
                    {record.currency.symbol} {record.costPrice.toFixed(2)}
                </span>
            ),
        },
        {
            title: t('products.finished.prices'),
            key: 'prices',
            width: '12%',
            render: (_: any, record: Product) => {
                const hasExtraPrices = record.offerPrice || record.wholesalePrice;

                const tooltipContent = hasExtraPrices ? (
                    <div style={{ fontSize: 12 }}>
                        {record.offerPrice && (
                            <div style={{ marginBottom: 4 }}>
                                <strong>{t('products.finished.offer')}:</strong> {record.currency.symbol} {record.offerPrice.toFixed(2)}
                            </div>
                        )}
                        {record.wholesalePrice && (
                            <div>
                                <strong>{t('products.finished.wholesale')}:</strong> {formatVenezuelanPrice(record.wholesalePrice, record.currency.symbol, 2, true)}
                            </div>
                        )}
                    </div>
                ) : null;

                return (
                    <Tooltip title={tooltipContent} placement="top">
                        <span
                            style={{
                                cursor: hasExtraPrices ? 'help' : 'default',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%',
                                display: 'inline-block'
                            }}
                        >
                            {formatVenezuelanPrice(record.salePrice, record.currency.symbol, 2, true)}
                        </span>
                    </Tooltip>
                );
            },
        },
        {
            title: t('products.finished.stock'),
            key: 'stock',
            width: '8%',
            render: (_: any, record: Product) => {
                const isService = record.type === 'SERVICE';
                return (
                    <Tag color={isService ? 'blue' : record.stock > 10 ? 'green' : record.stock > 0 ? 'orange' : 'red'}>
                        {isService ? '∞' : record.stock}
                    </Tag>
                );
            },
        },
        {
            title: t('products.finished.unit'),
            key: 'unit',
            width: '8%',
            render: (_: any, record: Product) => record.unit?.abbreviation || '-',
        },
        {
            title: <Space><ShopOutlined /> {t('products.finished.ml_status')}</Space>,
            key: 'mercadolibre',
            width: '12%',
            align: 'center' as const,
            render: (_: any, record: Product) => {
                const mapping = mlMappings.find(m => m.productId === record.id);
                const hasAccounts = mlAccounts.length > 0;

                if (mapping) {
                    const isError = mapping.syncStatus === 'FAILED';
                    return (
                        <Tooltip title={isError ? `Error: ${mapping.syncError}` : t('products.finished.published')}>
                            <a href={mapping.mlPermalink || '#'} target="_blank" rel="noopener noreferrer">
                                <Tag
                                    icon={isError ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                                    color={isError ? 'error' : 'success'}
                                    style={{ cursor: 'pointer' }}
                                >
                                    ML
                                </Tag>
                            </a>
                        </Tooltip>
                    );
                }

                return (
                    <Button
                        type="text"
                        size="small"
                        icon={<CloudUploadOutlined />}
                        disabled={!hasAccounts}
                        onClick={() => {
                            setMlProduct(record);
                            setIsMlModalOpen(true);
                        }}
                        title={hasAccounts ? t('products.finished.publish') : t('products.finished.ml_no_accounts')}
                    >
                        {t('products.finished.publish')}
                    </Button>
                );
            }
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: '10%',
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
                        title={t('products.finished.delete_confirm')}
                        description={t('products.finished.delete_desc')}
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
            title={!isMobile ? t('products.finished.title') : undefined}
            extra={!isMobile ? (
                <Space>
                    <Input
                        placeholder={t('products.finished.search_placeholder')}
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                        allowClear
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        {t('products.finished.new_button')}
                    </Button>
                </Space>
            ) : null}
        >
            {isMobile && (
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, marginBottom: 16 }}>📦 {t('products.finished.title')}</h2>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Input
                            placeholder={t('products.finished.search_placeholder')}
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
                                {t('products.finished.new_short')}
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
                    showTotal: (total, range) => t('products.finished.pagination_total', { rangeStart: range[0], rangeEnd: range[1], total }),
                    size: isMobile ? 'small' : 'default',
                    responsive: true,
                    position: ['bottomRight']
                }}
            />

            <ProductFormModal
                open={isModalOpen}
                product={editingProduct}
                onClose={handleModalClose}
            />

            <MlPublishModal
                open={isMlModalOpen}
                product={mlProduct}
                onClose={() => {
                    setIsMlModalOpen(false);
                    setMlProduct(null);
                }}
            />
        </Card>
    );
};
