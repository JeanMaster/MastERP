import { useState } from 'react';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { Card, Table, Button, Space, Input, message, Popconfirm, Tag, Tooltip, Grid, Popover, Image } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, PictureOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../services/productsApi';
import type { Product } from '../../services/productsApi';
import { ProductFormModal } from './ProductFormModal';

export const CompositeProductsPage = () => {
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
            message.success('Producto compuesto eliminado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al eliminar producto compuesto');
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

    // Filter products locally for search
    const filteredData = products.filter((product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
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
            width: '25%',
            render: (text: string, record: Product) => (
                <Space>
                    {record.imageUrl && (
                        <Popover
                            content={
                                <Image
                                    src={record.imageUrl}
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
            title: 'Componentes',
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
                        {record.components?.length || 0} Componentes
                    </Tag>
                </Tooltip>
            ),
        },
        {
            title: 'Costo de Receta',
            key: 'costPrice',
            width: '12%',
            render: (_: any, record: Product) => (
                <span style={{ fontWeight: 'bold' }}>
                    {record.currency.symbol} {record.costPrice.toFixed(2)}
                </span>
            ),
        },
        {
            title: 'Precio Venta',
            key: 'salePrice',
            width: '12%',
            render: (_: any, record: Product) => (
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                    {formatVenezuelanPrice(record.salePrice, record.currency.symbol, 2, true)}
                </span>
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
                        <div style={{ fontSize: 11, color: '#888' }}>
                            {record.subcategory.name}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: '15%',
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
                        title="¿Eliminar producto compuesto?"
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
            title={!isMobile ? "Productos Compuestos (Recetas)" : undefined}
            extra={!isMobile ? (
                <Space>
                    <Input
                        placeholder="Buscar receta..."
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                        allowClear
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['products'] })} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        Nueva Receta
                    </Button>
                </Space>
            ) : null}
        >
            {isMobile && (
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, marginBottom: 16 }}>🧩 Productos Compuestos</h2>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Input
                            placeholder="Buscar receta..."
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
                                Nueva Receta
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
                    showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} recetas`,
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
