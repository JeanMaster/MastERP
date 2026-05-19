import { useState } from 'react';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { Card, Table, Button, Space, Input, App, Popconfirm, Grid, Tooltip, List, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined, NodeIndexOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../services/productsApi';
import { currenciesApi } from '../../services/currenciesApi';
import type { Product } from '../../services/productsApi';
import { ServiceFormModal } from './services/ServiceFormModal';
import { useTranslation } from 'react-i18next';

/**
 * ServicesPage Component
 * Management interface for professional services (intangible products).
 * Lists services with multi-currency price conversion tooltips.
 */
export const ServicesPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Product | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    // Fetch services (products with type = SERVICE)
    const { data: services = [], isLoading: isLoadingServices } = useQuery({
        queryKey: ['services'],
        queryFn: () => productsApi.getAll({ type: 'SERVICE' }),
    });

    // Fetch currencies for price conversion display
    const { data: currencies = [] } = useQuery({
        queryKey: ['currencies'],
        queryFn: () => currenciesApi.getAll(),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: productsApi.delete,
        onSuccess: () => {
            message.success(t('products.services.delete_success'));
            queryClient.invalidateQueries({ queryKey: ['services'] });
        },
        onError: () => {
            message.error(t('common.error'));
        },
    });

    const handleEdit = (service: Product) => {
        setEditingService(service);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingService(null);
    };

    // Client-side filtering
    const filteredServices = services.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        {
            title: t('common.code'),
            dataIndex: 'sku',
            key: 'sku',
            width: 120,
        },
        {
            title: t('common.name'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: Product) => (
                <Space direction="vertical" size={0}>
                    <span style={{ fontWeight: 500 }}>{text}</span>
                    <span style={{ fontSize: '11px', color: '#888' }}>{record.category.name}</span>
                </Space>
            ),
        },
        {
            title: t('common.cost'),
            key: 'cost',
            width: 120,
            render: (_: any, record: Product) => (
                <span style={{ color: '#888' }}>
                    {formatVenezuelanPrice(record.costPrice || 0, record.currency.symbol)}
                </span>
            ),
            align: 'right' as const,
        },
        {
            title: t('common.sale_price'),
            key: 'price',
            width: 140,
            render: (_: any, record: Product) => {
                // Calculate prices in other active currencies for the tooltip
                const pricesInOtherCurrencies = currencies
                    .filter(c => c.active && c.id !== record.currencyId)
                    .map(targetCurrency => {
                        let priceInPrimary = record.salePrice;
                        const productCurrency = currencies.find(c => c.id === record.currencyId);

                        if (productCurrency && !productCurrency.isPrimary && productCurrency.exchangeRate) {
                            priceInPrimary = record.salePrice * Number(productCurrency.exchangeRate);
                        }

                        let convertedPrice = priceInPrimary;
                        if (!targetCurrency.isPrimary && targetCurrency.exchangeRate) {
                            convertedPrice = priceInPrimary / Number(targetCurrency.exchangeRate);
                        }

                        return {
                            currency: targetCurrency,
                            price: convertedPrice
                        };
                    });

                const tooltipContent = pricesInOtherCurrencies.length > 0 ? (
                    <div style={{ fontSize: 12 }}>
                        {pricesInOtherCurrencies.map((item) => (
                            <div key={item.currency.id} style={{ marginBottom: 2 }}>
                                <strong>{item.currency.symbol}:</strong> {formatVenezuelanPrice(item.price, item.currency.symbol, 2, true)}
                            </div>
                        ))}
                    </div>
                ) : null;

                return (
                    <Space direction="vertical" size={0} style={{ textAlign: 'right', width: '100%' }}>
                        <Tooltip title={tooltipContent} placement="top">
                            <span style={{ fontWeight: 'bold', color: '#2ecc71', cursor: tooltipContent ? 'help' : 'default' }}>
                                {formatVenezuelanPrice(record.salePrice, record.currency.symbol)}
                            </span>
                        </Tooltip>
                    </Space>
                );
            },
            align: 'right' as const,
        },
        {
            title: t('common.actions'),
            key: 'actions',
            align: 'center' as const,
            width: 100,
            render: (_: any, record: Product) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    />
                    <Popconfirm
                        title={t('products.services.delete_confirm')}
                        description={t('products.services.delete_desc')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={!isMobile ? t('products.services.title') : undefined}
            extra={!isMobile ? (
                <Space>
                    <Input
                        placeholder={t('products.services.search_placeholder')}
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                        allowClear
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['services'] })} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                        {t('products.services.new_button')}
                    </Button>
                </Space>
            ) : null}
        >
            {isMobile && (
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, marginBottom: 16 }}>🛠️ {t('products.services.title')}</h2>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Input
                            placeholder={t('products.services.search_placeholder')}
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
                                onClick={() => setIsModalOpen(true)}
                                style={{ flex: 1 }}
                                size="large"
                            >
                                {t('common.add')}
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['services'] })}
                                size="large"
                            />
                        </div>
                    </Space>
                </div>
            )}

            {!isMobile ? (
                <Table
                    columns={columns}
                    dataSource={filteredServices}
                    rowKey="id"
                    loading={isLoadingServices}
                    pagination={{
                        defaultPageSize: 15,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '15', '20', '50', '100'],
                        responsive: true,
                        position: ['bottomRight']
                    }}
                />
            ) : (
                <List
                    loading={isLoadingServices}
                    dataSource={filteredServices}
                    pagination={{
                        pageSize: 10,
                        size: 'small',
                        simple: true,
                    }}
                    renderItem={(item: Product) => (
                        <List.Item
                            onClick={() => handleEdit(item)}
                            style={{ 
                                padding: '16px', 
                                cursor: 'pointer',
                                background: '#fff',
                                marginBottom: 12,
                                borderRadius: 16,
                                border: '1px solid #f0f0f0',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                display: 'block'
                            }}
                        >
                            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                <div style={{
                                    width: 44,
                                    height: 44,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 12,
                                    backgroundColor: '#eff6ff',
                                    color: '#3b82f6',
                                    flexShrink: 0
                                }}>
                                    <NodeIndexOutlined style={{ fontSize: 20 }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ 
                                        fontWeight: 700, 
                                        fontSize: 16, 
                                        color: '#111827',
                                        lineHeight: '1.2',
                                        marginBottom: 4
                                    }}>
                                        {item.name}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                                        <Tag color="blue" style={{ fontSize: 10, margin: 0, borderRadius: 4 }}>{item.sku}</Tag>
                                        <span style={{ marginLeft: 8 }}>{item.category.name}</span>
                                    </div>
                                </div>
                                <EditOutlined style={{ color: '#9ca3af', fontSize: 16 }} />
                            </div>

                            <div style={{ 
                                background: '#f8fafc', 
                                padding: '12px', 
                                borderRadius: 12,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                border: '1px solid #f1f5f9'
                            }}>
                                <div>
                                    <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{t('common.sale_price')}</div>
                                    <div style={{ fontWeight: 800, color: '#10b981', fontSize: 18 }}>
                                        {formatVenezuelanPrice(item.salePrice, item.currency.symbol)}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{t('common.cost')}</div>
                                    <div style={{ fontWeight: 600, color: '#64748b', fontSize: 14 }}>
                                        {item.currency.symbol}{item.costPrice.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
            )}

            <ServiceFormModal
                open={isModalOpen}
                service={editingService}
                onClose={handleCloseModal}
            />
        </Card>
    );
};
