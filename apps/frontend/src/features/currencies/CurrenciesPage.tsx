import { useState } from 'react';
import { Card, Table, Button, Space, Input, message, Popconfirm, Tag, Badge, Grid, List } from 'antd';
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
            title={!isMobile ? t('currencies.title') : undefined}
            extra={!isMobile ? (
                <Space>
                    <Input
                        placeholder={t('currencies.search')}
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                        allowClear
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['currencies'] })} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        {t('currencies.new')}
                    </Button>
                </Space>
            ) : null}
        >
            {isMobile && (
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, marginBottom: 16 }}>💰 {t('currencies.title')}</h2>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Input
                            placeholder={t('currencies.search')}
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
                                {t('currencies.new')}
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['currencies'] })}
                                size="large"
                            />
                        </div>
                    </Space>
                </div>
            )}

            {!isMobile ? (
                <Table
                    columns={columns}
                    dataSource={filteredData}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{
                        pageSize: 20,
                        showSizeChanger: true,
                        responsive: true,
                        position: ['bottomRight']
                    }}
                />
            ) : (
                <List
                    loading={isLoading}
                    dataSource={filteredData}
                    renderItem={(item: Currency) => (
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 44,
                                        height: 44,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 12,
                                        backgroundColor: item.isPrimary ? '#fff7e6' : '#f0f7ff',
                                        color: item.isPrimary ? '#faad14' : '#1890ff',
                                        fontSize: 20,
                                        fontWeight: 700,
                                        border: `1px solid ${item.isPrimary ? '#ffe58f' : '#91d5ff'}`
                                    }}>
                                        {item.symbol}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>
                                            {item.name} {item.isPrimary && <StarFilled style={{ color: '#faad14', fontSize: 12 }} />}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Tag color="blue" style={{ margin: 0, fontSize: 11, borderRadius: 4 }}>{item.code}</Tag>
                                            <Badge 
                                                status={item.isPrimary ? "success" : "default"} 
                                                text={item.isPrimary ? t('currencies.primary') : t('currencies.secondary')}
                                                style={{ fontSize: 12 }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <EditOutlined style={{ color: '#9ca3af', fontSize: 16 }} />
                            </div>
                            
                            {!item.isPrimary && (
                                <div style={{ 
                                    background: '#f8fafc', 
                                    padding: '12px', 
                                    borderRadius: 12,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    border: '1px solid #f1f5f9'
                                }}>
                                    <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>{t('currencies.rate')}</span>
                                    <div style={{ textAlign: 'right' }}>
                                        <span style={{ fontWeight: 700, fontSize: 17, color: '#0f172a' }}>
                                            {item.exchangeRate?.toFixed(4)}
                                        </span>
                                        <span style={{ marginLeft: 4, fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                                            {primaryCurrency?.symbol}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </List.Item>
                    )}
                />
            )}

            <CurrencyFormModal
                open={isModalOpen}
                currency={editingCurrency}
                onClose={handleModalClose}
            />
        </Card>
    );
};
