
import { useState } from 'react';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { Card, Table, Button, Space, Input, message, Popconfirm, Grid, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../../services/productsApi';
import { currenciesApi } from '../../services/currenciesApi'; // Import currenciesApi
import type { Product } from '../../services/productsApi';
import { ServiceFormModal } from './services/ServiceFormModal';

export const ServicesPage = () => {
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

    // Fetch currencies for conversion
    const { data: currencies = [] } = useQuery({
        queryKey: ['currencies'],
        queryFn: () => currenciesApi.getAll(),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: productsApi.delete,
        onSuccess: () => {
            message.success('Servicio eliminado');
            queryClient.invalidateQueries({ queryKey: ['services'] });
        },
        onError: () => {
            message.error('Error al eliminar servicio');
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

    // Filter
    const filteredServices = services.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        {
            title: 'Código',
            dataIndex: 'sku',
            key: 'sku',
            width: 120,
        },
        {
            title: 'Nombre',
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
            title: 'Costo',
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
            title: 'Precio Venta',
            key: 'price',
            width: 140,
            render: (_: any, record: Product) => {
                // Calculate prices in other currencies
                const pricesInOtherCurrencies = currencies
                    .filter(c => c.active && c.id !== record.currencyId) // Filter active and different from product currency
                    .map(targetCurrency => {
                        // 1. Calculate price in Primary Currency (Bs usually)
                        // If product is in Primary, price is raw. If not, multiply by its rate.
                        // Assuming rates are stored as "Bs per CurrencyUnit"

                        let priceInPrimary = record.salePrice;
                        const productCurrency = currencies.find(c => c.id === record.currencyId);

                        if (productCurrency && !productCurrency.isPrimary && productCurrency.exchangeRate) {
                            priceInPrimary = record.salePrice * Number(productCurrency.exchangeRate);
                        }

                        // 2. Convert to Target Currency
                        // If target is Primary, price is priceInPrimary.
                        // If target is Secondary, divide by its rate.
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
                                {/* Fix: Pass currency symbol explicitly to avoid double suffix */}
                                {formatVenezuelanPrice(record.salePrice, record.currency.symbol)}
                            </span>
                        </Tooltip>
                    </Space>
                );
            },
            align: 'right' as const,
        },
        {
            title: 'Acciones',
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
                        title="¿Eliminar servicio?"
                        description="Esta acción no se puede deshacer."
                        onConfirm={() => handleDelete(record.id)}
                        okText="Sí"
                        cancelText="No"
                    >
                        <Button type="text" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div className="fade-in" style={{ padding: isMobile ? '8px' : '0' }}>
            <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: 16,
                gap: isMobile ? 12 : 0
            }}>
                <h1 style={{ margin: 0, fontSize: isMobile ? '1.5rem' : '2rem' }}>Servicios</h1>
                <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }} align={isMobile ? 'end' : 'center'}>
                    <Input
                        placeholder="Buscar servicio..."
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: isMobile ? '100%' : 250 }}
                    />
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['services'] })}
                        />
                        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
                            {isMobile ? 'Nuevo' : 'Nuevo Servicio'}
                        </Button>
                    </Space>
                </Space>
            </div>

            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    columns={columns}
                    dataSource={filteredServices}
                    rowKey="id"
                    loading={isLoadingServices}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 'max-content' }}
                />
            </Card>

            <ServiceFormModal
                open={isModalOpen}
                service={editingService}
                onClose={handleCloseModal}
            />
        </div>
    );
};
