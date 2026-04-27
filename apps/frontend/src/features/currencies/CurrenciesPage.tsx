import { useState } from 'react';
import { Card, Table, Button, Space, Input, message, Popconfirm, Tag, Badge, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, StarFilled, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { currenciesApi } from '../../services/currenciesApi';
import type { Currency } from '../../services/currenciesApi';
import { CurrencyFormModal } from './CurrencyFormModal';
import { useTranslation } from 'react-i18next';

const { useBreakpoint } = Grid;

/**
 * CurrenciesPage Component
 * Management interface for system currencies and their exchange rates.
 * Supports internationalization (i18n).
 */
export const CurrenciesPage = () => {
    const { t } = useTranslation();
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
            message.success(t('currencies.delete_success'));
            queryClient.invalidateQueries({ queryKey: ['currencies'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('common.error'));
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
            title: t('currencies.name'),
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
            title: t('currencies.code'),
            dataIndex: 'code',
            key: 'code',
            width: '15%',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: t('currencies.symbol'),
            dataIndex: 'symbol',
            key: 'symbol',
            width: '10%',
        },
        {
            title: t('currencies.type'),
            key: 'type',
            width: '15%',
            render: (_: any, record: Currency) => (
                record.isPrimary ? (
                    <Badge status="success" text={t('currencies.primary')} />
                ) : (
                    <Badge status="default" text={t('currencies.secondary')} />
                )
            ),
        },
        {
            title: t('currencies.rate'),
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
            title: t('common.actions'),
            key: 'actions',
            width: '20%',
            render: (_: any, record: Currency) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        {t('currencies.edit')}
                    </Button>
                    <Popconfirm
                        title={t('currencies.delete_confirm')}
                        description={t('currencies.delete_desc')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('currencies.delete')}
                        cancelText={t('common.cancel')}
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            {t('currencies.delete')}
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={t('currencies.title')}
            extra={
                <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }} align={isMobile ? 'end' : 'center'}>
                    <Input
                        placeholder={t('currencies.search')}
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: isMobile ? '100%' : 250 }}
                    />
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['currencies'] })} />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            {isMobile ? t('common.edit') : t('currencies.new')}
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
