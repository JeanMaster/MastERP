import { useEffect } from 'react';
import { Card, Table, Button, Space, Tag, message, Popconfirm, Row, Col, Statistic, Typography, Alert, Empty, Grid } from 'antd';
import {
    LinkOutlined, DisconnectOutlined, SyncOutlined, CloudUploadOutlined,
    DeleteOutlined, ReloadOutlined, ShopOutlined, CheckCircleOutlined,
    CloseCircleOutlined, ExportOutlined, PauseOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mercadolibreApi } from '../../services/mercadolibreApi';
import type { MlProductMapping } from '../../services/mercadolibreApi';
import { useSearchParams } from 'react-router-dom';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export const MercadoLibrePage = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // Check for callback status from OAuth redirect
    useEffect(() => {
        const status = searchParams.get('status');
        if (status === 'success') {
            message.success('¡Cuenta de Mercado Libre vinculada exitosamente!');
            queryClient.invalidateQueries({ queryKey: ['ml-accounts'] });
            setSearchParams({});
        } else if (status === 'error') {
            message.error('Error al vincular la cuenta de Mercado Libre');
            setSearchParams({});
        }
    }, [searchParams]);

    // ─── Queries ──────────────────────────────────────────

    const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
        queryKey: ['ml-accounts'],
        queryFn: mercadolibreApi.getAccounts,
    });

    const { data: mappings = [], isLoading: loadingMappings } = useQuery({
        queryKey: ['ml-mappings'],
        queryFn: () => mercadolibreApi.getMappings(),
    });

    // ─── Mutations ────────────────────────────────────────

    const deleteAccountMutation = useMutation({
        mutationFn: mercadolibreApi.deleteAccount,
        onSuccess: () => {
            message.success('Cuenta desvinculada');
            queryClient.invalidateQueries({ queryKey: ['ml-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
        },
        onError: () => message.error('Error al desvincular la cuenta'),
    });

    const syncMutation = useMutation({
        mutationFn: mercadolibreApi.syncProduct,
        onSuccess: () => {
            message.success('Producto sincronizado con Mercado Libre');
            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al sincronizar');
        },
    });

    const unpublishMutation = useMutation({
        mutationFn: mercadolibreApi.unpublishProduct,
        onSuccess: () => {
            message.success('Publicación eliminada de Mercado Libre');
            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
            queryClient.invalidateQueries({ queryKey: ['ml-accounts'] });
        },
        onError: () => message.error('Error al despublicar'),
    });

    const pauseMutation = useMutation({
        mutationFn: mercadolibreApi.pauseProduct,
        onSuccess: () => {
            message.success('Publicación pausada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al pausar la publicación');
        },
    });

    const mockAccountMutation = useMutation({
        mutationFn: mercadolibreApi.createMockAccount,
        onSuccess: () => {
            message.success('¡Cuenta de prueba vinculada exitosamente!');
            queryClient.invalidateQueries({ queryKey: ['ml-accounts'] });
        },
        onError: () => message.error('Error al crear cuenta de prueba'),
    });

    // ─── Handlers ─────────────────────────────────────────

    const handleConnect = () => {
        const url = mercadolibreApi.getAuthUrl();
        window.location.href = url;
    };

    // ─── Mapping Table Columns ────────────────────────────

    const columns = [
        {
            title: 'Producto',
            key: 'product',
            render: (_: any, record: MlProductMapping) => (
                <Space>
                    {record.product.images && record.product.images.length > 0 && (
                        <img
                            src={record.product.images[0]}
                            alt={record.product.name}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                        />
                    )}
                    <Space direction="vertical" size={0}>
                        <Text strong>{record.product.name}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>SKU: {record.product.sku}</Text>
                    </Space>
                </Space>
            ),
        },
        {
            title: 'ID en ML',
            dataIndex: 'mlItemId',
            key: 'mlItemId',
            render: (mlItemId: string, record: MlProductMapping) => (
                <Space>
                    <Text code>{mlItemId}</Text>
                    {record.mlPermalink && (
                        <a href={record.mlPermalink} target="_blank" rel="noopener noreferrer">
                            <ExportOutlined />
                        </a>
                    )}
                </Space>
            ),
        },
        {
            title: 'Precio',
            key: 'price',
            align: 'right' as const,
            render: (_: any, record: MlProductMapping) => (
                <Text strong>{Number(record.product.salePrice).toFixed(2)}</Text>
            ),
        },
        {
            title: 'Stock',
            key: 'stock',
            align: 'right' as const,
            render: (_: any, record: MlProductMapping) => (
                <Text>{Math.floor(Number(record.product.stock))}</Text>
            ),
        },
        {
            title: 'Estado Sync',
            key: 'syncStatus',
            render: (_: any, record: MlProductMapping) => {
                if (record.syncStatus === 'SUCCESS') {
                    return <Tag icon={<CheckCircleOutlined />} color="success">Sincronizado</Tag>;
                }
                if (record.syncStatus === 'FAILED') {
                    return (
                        <Space direction="vertical" size={0}>
                            <Tag icon={<CloseCircleOutlined />} color="error">Error</Tag>
                            {record.syncError && <Text type="danger" style={{ fontSize: 11 }}>{record.syncError}</Text>}
                        </Space>
                    );
                }
                return <Tag color="default">Pendiente</Tag>;
            },
        },
        {
            title: 'Última Sync',
            key: 'lastSync',
            render: (_: any, record: MlProductMapping) =>
                record.lastSync
                    ? new Date(record.lastSync).toLocaleString('es-VE', { dateStyle: 'short', timeStyle: 'short' })
                    : '-',
        },
        {
            title: 'Acciones',
            key: 'actions',
            align: 'center' as const,
            render: (_: any, record: MlProductMapping) => (
                <Space>
                    <Button
                        type="text"
                        icon={<SyncOutlined />}
                        title="Sincronizar precio y stock"
                        loading={syncMutation.isPending}
                        onClick={() => syncMutation.mutate(record.productId)}
                    />
                    <Button
                        type="text"
                        icon={<PauseOutlined />}
                        title="Pausar publicación"
                        loading={pauseMutation.isPending}
                        onClick={() => pauseMutation.mutate(record.productId)}
                        style={{ color: '#faad14' }}
                    />
                    <Popconfirm
                        title="¿Eliminar publicación?"
                        description="Se cerrará la publicación en Mercado Libre."
                        onConfirm={() => unpublishMutation.mutate(record.productId)}
                        okText="Sí"
                        cancelText="No"
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} title="Despublicar" />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="fade-in">
            {/* Header */}
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: 16,
                gap: isMobile ? 12 : 0
            }}>
                <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>
                    <ShopOutlined style={{ marginRight: 8, color: '#faad14' }} />
                    Mercado Libre
                </Title>
                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => {
                            queryClient.invalidateQueries({ queryKey: ['ml-accounts'] });
                            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
                        }}
                    />
                    <Button
                        type="primary"
                        icon={<LinkOutlined />}
                        onClick={handleConnect}
                        style={{ background: '#faad14', borderColor: '#faad14' }}
                    >
                        Vincular Cuenta
                    </Button>
                    <Button
                        icon={<SyncOutlined />}
                        loading={mockAccountMutation.isPending}
                        onClick={() => mockAccountMutation.mutate()}
                    >
                        Vincular Prueba
                    </Button>
                </Space>
            </div>

            {/* Info Alert */}
            {accounts.length === 0 && !loadingAccounts && (
                <Alert
                    message="Sin cuentas vinculadas"
                    description="Para publicar productos en Mercado Libre, primero necesitas vincular tu cuenta. Haz clic en el botón 'Vincular Cuenta' para comenzar."
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* Accounts Summary */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card style={{ backgroundColor: '#fffbe6' }}>
                        <Statistic
                            title="Cuentas Vinculadas"
                            value={accounts.length}
                            prefix={<ShopOutlined />}
                            valueStyle={{ color: '#d48806' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card style={{ backgroundColor: '#f6ffed' }}>
                        <Statistic
                            title="Productos Publicados"
                            value={mappings.length}
                            prefix={<CloudUploadOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card style={{ backgroundColor: '#fff1f0' }}>
                        <Statistic
                            title="Con Errores"
                            value={mappings.filter(m => m.syncStatus === 'FAILED').length}
                            prefix={<CloseCircleOutlined />}
                            valueStyle={{ color: '#ff4d4f' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Linked Accounts */}
            {accounts.length > 0 && (
                <Card
                    title="Cuentas Vinculadas"
                    style={{ marginBottom: 24 }}
                    size="small"
                >
                    {accounts.map((acc) => (
                        <div
                            key={acc.id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 0',
                                borderBottom: '1px solid #f0f0f0',
                            }}
                        >
                            <Space>
                                <ShopOutlined style={{ color: '#faad14', fontSize: 20 }} />
                                <Space direction="vertical" size={0}>
                                    <Text strong>{acc.username || `Usuario ML #${acc.mlUserId}`}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {acc._count.productMappings} productos publicados ·
                                        Última act: {new Date(acc.updatedAt).toLocaleDateString('es-VE')}
                                    </Text>
                                </Space>
                            </Space>
                            <Popconfirm
                                title="¿Desvincular cuenta?"
                                description="Se eliminarán todos los mapeos de productos asociados."
                                onConfirm={() => deleteAccountMutation.mutate(acc.id)}
                                okText="Sí"
                                cancelText="No"
                            >
                                <Button size="small" danger icon={<DisconnectOutlined />}>
                                    Desvincular
                                </Button>
                            </Popconfirm>
                        </div>
                    ))}
                </Card>
            )}

            {/* Product Mappings Table */}
            <Card
                title="Productos Publicados"
                styles={{ body: { padding: 0 } }}
            >
                {mappings.length === 0 && !loadingMappings ? (
                    <Empty
                        description="No hay productos publicados en Mercado Libre"
                        style={{ padding: 40 }}
                    >
                        <Text type="secondary">
                            Publica productos desde el módulo de Inventario
                        </Text>
                    </Empty>
                ) : (
                    <Table
                        columns={columns}
                        dataSource={mappings}
                        rowKey="id"
                        loading={loadingMappings}
                        pagination={{ pageSize: 15 }}
                        scroll={{ x: 'max-content' }}
                    />
                )}
            </Card>
        </div>
    );
};
