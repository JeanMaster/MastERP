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
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

/**
 * MercadoLibrePage Component
 * Management interface for Mercado Libre (ML) integration.
 * Allows linking accounts, managing active listings, and synchronizing inventory/pricing in real-time.
 */
export const MercadoLibrePage = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();

    // Check for callback status from OAuth redirect
    useEffect(() => {
        const status = searchParams.get('status');
        if (status === 'success') {
            message.success('Mercado Libre account linked successfully!');
            queryClient.invalidateQueries({ queryKey: ['ml-accounts'] });
            setSearchParams({});
        } else if (status === 'error') {
            message.error('Error linking Mercado Libre account');
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
            message.success('Account unlinked');
            queryClient.invalidateQueries({ queryKey: ['ml-accounts'] });
            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
        },
        onError: () => message.error('Error unlinking account'),
    });

    const syncMutation = useMutation({
        mutationFn: mercadolibreApi.syncProduct,
        onSuccess: () => {
            message.success('Product synchronized with Mercado Libre');
            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error synchronizing');
        },
    });

    const unpublishMutation = useMutation({
        mutationFn: mercadolibreApi.unpublishProduct,
        onSuccess: () => {
            message.success('Listing removed from Mercado Libre');
            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
            queryClient.invalidateQueries({ queryKey: ['ml-accounts'] });
        },
        onError: () => message.error('Error unpublishing'),
    });

    const pauseMutation = useMutation({
        mutationFn: mercadolibreApi.pauseProduct,
        onSuccess: () => {
            message.success('Listing paused successfully');
            queryClient.invalidateQueries({ queryKey: ['ml-mappings'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error pausing listing');
        },
    });

    const mockAccountMutation = useMutation({
        mutationFn: mercadolibreApi.createMockAccount,
        onSuccess: () => {
            message.success('Test account linked successfully!');
            queryClient.invalidateQueries({ queryKey: ['ml-accounts'] });
        },
        onError: () => message.error('Error creating test account'),
    });

    // ─── Handlers ─────────────────────────────────────────

    const handleConnect = () => {
        const url = mercadolibreApi.getAuthUrl();
        window.location.href = url;
    };

    // ─── Mapping Table Columns ────────────────────────────

    const columns = [
        {
            title: 'Product',
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
            title: 'ML ID',
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
            title: 'Price',
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
            title: 'Sync Status',
            key: 'syncStatus',
            render: (_: any, record: MlProductMapping) => {
                if (record.syncStatus === 'SUCCESS') {
                    return <Tag icon={<CheckCircleOutlined />} color="success">Synced</Tag>;
                }
                if (record.syncStatus === 'FAILED') {
                    return (
                        <Space direction="vertical" size={0}>
                            <Tag icon={<CloseCircleOutlined />} color="error">Error</Tag>
                            {record.syncError && <Text type="danger" style={{ fontSize: 11 }}>{record.syncError}</Text>}
                        </Space>
                    );
                }
                return <Tag color="default">Pending</Tag>;
            },
        },
        {
            title: 'Last Sync',
            key: 'lastSync',
            render: (_: any, record: MlProductMapping) =>
                record.lastSync
                    ? dayjs(record.lastSync).format('MM/DD/YYYY HH:mm')
                    : '-',
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'center' as const,
            render: (_: any, record: MlProductMapping) => (
                <Space>
                    <Button
                        type="text"
                        icon={<SyncOutlined />}
                        title="Sync price and stock"
                        loading={syncMutation.isPending}
                        onClick={() => syncMutation.mutate(record.productId)}
                    />
                    <Button
                        type="text"
                        icon={<PauseOutlined />}
                        title="Pause listing"
                        loading={pauseMutation.isPending}
                        onClick={() => pauseMutation.mutate(record.productId)}
                        style={{ color: '#faad14' }}
                    />
                    <Popconfirm
                        title="Delete listing?"
                        description="This listing will be closed on Mercado Libre."
                        onConfirm={() => unpublishMutation.mutate(record.productId)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} title="Unpublish" />
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
                        Link Account
                    </Button>
                    <Button
                        icon={<SyncOutlined />}
                        loading={mockAccountMutation.isPending}
                        onClick={() => mockAccountMutation.mutate()}
                    >
                        Link Test Account
                    </Button>
                </Space>
            </div>

            {/* Info Alert */}
            {accounts.length === 0 && !loadingAccounts && (
                <Alert
                    message="No linked accounts"
                    description="To publish products on Mercado Libre, you first need to link your account. Click 'Link Account' to begin."
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
                            title="Linked Accounts"
                            value={accounts.length}
                            prefix={<ShopOutlined />}
                            valueStyle={{ color: '#d48806' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card style={{ backgroundColor: '#f6ffed' }}>
                        <Statistic
                            title="Published Products"
                            value={mappings.length}
                            prefix={<CloudUploadOutlined />}
                            valueStyle={{ color: '#52c41a' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card style={{ backgroundColor: '#fff1f0' }}>
                        <Statistic
                            title="With Errors"
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
                    title="Linked Accounts"
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
                                    <Text strong>{acc.username || `ML User #${acc.mlUserId}`}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {acc._count.productMappings} published products ·
                                        Last act: {dayjs(acc.updatedAt).format('MM/DD/YYYY')}
                                    </Text>
                                </Space>
                            </Space>
                            <Popconfirm
                                title="Unlink account?"
                                description="All associated product mappings will be removed."
                                onConfirm={() => deleteAccountMutation.mutate(acc.id)}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button size="small" danger icon={<DisconnectOutlined />}>
                                    Unlink
                                </Button>
                            </Popconfirm>
                        </div>
                    ))}
                </Card>
            )}

            {/* Product Mappings Table */}
            <Card
                title="Published Products"
                styles={{ body: { padding: 0 } }}
            >
                {mappings.length === 0 && !loadingMappings ? (
                    <Empty
                        description="No products published on Mercado Libre"
                        style={{ padding: 40 }}
                    >
                        <Text type="secondary">
                            Publish products from the Inventory module
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
