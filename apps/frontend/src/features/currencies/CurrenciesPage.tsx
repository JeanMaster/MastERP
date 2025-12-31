import { useState } from 'react';
import { Card, Table, Button, Space, Input, message, Popconfirm, Tag, Badge, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, StarFilled, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { currenciesApi } from '../../services/currenciesApi';
import type { Currency } from '../../services/currenciesApi';
import { CurrencyFormModal } from './CurrencyFormModal';

const { useBreakpoint } = Grid;

export const CurrenciesPage = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    // Fetch currencies
    const { data: currencies = [], isLoading } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: currenciesApi.delete,
        onSuccess: () => {
            message.success('Moneda eliminada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['currencies'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al eliminar moneda');
        },
    });

    const handleAdd = () => {
        setEditingCurrency(null);
        setIsModalOpen(true);
    };

    const handleEdit = (currency: Currency) => {
        setEditingCurrency(currency);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingCurrency(null);
    };

    // Filter currencies
    const filteredData = currencies.filter((currency) =>
        currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        currency.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get primary currency for displaying symbol in exchange rates
    const primaryCurrency = currencies.find(c => c.isPrimary);

    const columns = [
        {
            title: 'Nombre',
            dataIndex: 'name',
            key: 'name',
            width: '25%',
            render: (text: string, record: Currency) => (
                <Space>
                    {text}
                    {record.isPrimary && <StarFilled style={{ color: '#faad14' }} />}
                </Space>
            ),
        },
        {
            title: 'Código',
            dataIndex: 'code',
            key: 'code',
            width: '15%',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: 'Símbolo',
            dataIndex: 'symbol',
            key: 'symbol',
            width: '10%',
        },
        {
            title: 'Tipo',
            key: 'type',
            width: '15%',
            render: (_: any, record: Currency) => (
                record.isPrimary ? (
                    <Badge status="success" text="Principal" />
                ) : (
                    <Badge status="default" text="Secundaria" />
                )
            ),
        },
        {
            title: 'Tasa de Cambio',
            dataIndex: 'exchangeRate',
            key: 'exchangeRate',
            width: '15%',
            render: (rate: number | null, record: Currency) => {
                if (record.isPrimary) {
                    return <span style={{ color: '#999' }}>—</span>;
                }
                if (!rate) return '—';

                const primarySymbol = primaryCurrency?.symbol || '';
                return (
                    <span>
                        {rate.toFixed(4)} <strong>{primarySymbol}</strong>
                    </span>
                );
            },
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: '20%',
            render: (_: any, record: Currency) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        Editar
                    </Button>
                    <Popconfirm
                        title="¿Eliminar moneda?"
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
            title="Monedas"
            extra={
                <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }} align={isMobile ? 'end' : 'center'}>
                    <Input
                        placeholder="Buscar moneda..."
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: isMobile ? '100%' : 250 }}
                    />
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['currencies'] })} />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            {isMobile ? 'Nueva' : 'Nueva Moneda'}
                        </Button>
                    </Space>
                </Space>
            }
        >
            <Table
                columns={columns}
                dataSource={filteredData}
                rowKey="id"
                loading={isLoading}
                pagination={{ pageSize: 20 }}
                scroll={{ x: 'max-content' }}
            />

            <CurrencyFormModal
                open={isModalOpen}
                currency={editingCurrency}
                onClose={handleModalClose}
            />
        </Card>
    );
};
