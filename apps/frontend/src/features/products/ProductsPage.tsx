import { useState } from 'react';
import { Card, Table, Button, Space, Input, message, Popconfirm, Tag, Tooltip, Image, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, PictureOutlined, ShopOutlined, CloudUploadOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../services/productsApi';
import type { Product } from '../../services/productsApi';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { ProductFormModal } from './ProductFormModal';
import { MlPublishModal } from './MlPublishModal';
import { mercadolibreApi } from '../../services/mercadolibreApi';

export const ProductsPage = () => {
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
            message.success('Producto eliminado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al eliminar producto');
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

    // Filter products
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
            title: 'SKU',
            dataIndex: 'sku',
            key: 'sku',
            width: '10%',
        },
        {
            title: 'Nombre',
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
                        <Tooltip title="Producto Compuesto (Combo)">
                            <Tag color="purple" style={{ fontSize: '10px' }}>COMBO</Tag>
                        </Tooltip>
                    )}
                </Space>
            ),
        },
        {
            title: 'Categoría',
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
            title: 'Moneda',
            key: 'currency',
            width: '8%',
            render: (_: any, record: Product) => (
                <Tag color="blue">{record.currency.symbol}</Tag>
            ),
        },
        {
            title: 'Precio Costo',
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
            title: 'Precios',
            key: 'prices',
            width: '12%',
            render: (_: any, record: Product) => {
                const hasExtraPrices = record.offerPrice || record.wholesalePrice;

                const tooltipContent = hasExtraPrices ? (
                    <div style={{ fontSize: 12 }}>
                        {record.offerPrice && (
                            <div style={{ marginBottom: 4 }}>
                                <strong>Oferta:</strong> {record.currency.symbol} {record.offerPrice.toFixed(2)}
                            </div>
                        )}
                        {record.wholesalePrice && (
                            <div>
                                <strong>Al Mayor:</strong> {formatVenezuelanPrice(record.wholesalePrice, record.currency.symbol, 2, true)}
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
            title: 'Stock',
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
            title: 'Unidad',
            key: 'unit',
            width: '8%',
            render: (_: any, record: Product) => record.unit?.abbreviation || '-',
        },
        {
            title: <Space><ShopOutlined /> Mercado Libre</Space>,
            key: 'mercadolibre',
            width: '12%',
            align: 'center' as const,
            render: (_: any, record: Product) => {
                const mapping = mlMappings.find(m => m.productId === record.id);
                const hasAccounts = mlAccounts.length > 0;

                if (mapping) {
                    const isError = mapping.syncStatus === 'FAILED';
                    return (
                        <Tooltip title={isError ? `Error: ${mapping.syncError}` : "Publicado y sincronizado"}>
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
                        title={hasAccounts ? "Publicar en Mercado Libre" : "Vincula una cuenta de ML primero"}
                    >
                        Publicar
                    </Button>
                );
            }
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: '10%',
            render: (_: any, record: Product) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        Editar
                    </Button>
                    <Popconfirm
                        title="¿Eliminar producto?"
                        description="Esta acción no se puede deshacer"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Eliminar"
                        cancelText="Cancelar"
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            Eliminar
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={!isMobile ? "Productos Terminados" : undefined}
            extra={!isMobile ? (
                <Space>
                    <Input
                        placeholder="Buscar producto..."
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                        allowClear
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        Nuevo Producto
                    </Button>
                </Space>
            ) : null}
        >
            {isMobile && (
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, marginBottom: 16 }}>📦 Productos Terminados</h2>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Input
                            placeholder="Buscar producto..."
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
                                Nuevo
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
                    showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} productos`,
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
