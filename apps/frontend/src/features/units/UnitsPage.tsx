import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Table, Button, Space, Input, message, Popconfirm, Tag, Grid, List } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { unitsApi } from '../../services/unitsApi';
import type { Unit } from '../../services/unitsApi';
import { UnitFormModal } from './UnitFormModal';

const { useBreakpoint } = Grid;

/**
 * UnitsPage Component
 * Management interface for measurement units (e.g., Kg, Units, Meters).
 */
export const UnitsPage = () => {
    const { t } = useTranslation();
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    // Fetch measurement units
    const { data: units = [], isLoading } = useQuery({
        queryKey: ['units'],
        queryFn: unitsApi.getAll,
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: unitsApi.delete,
        onSuccess: () => {
            message.success(t('units.success_delete'));
            queryClient.invalidateQueries({ queryKey: ['units'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('units.error_delete'));
        },
    });

    const handleAdd = () => {
        setEditingUnit(null);
        setIsModalOpen(true);
    };

    const handleEdit = (unit: Unit) => {
        setEditingUnit(unit);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingUnit(null);
    };

    // Client-side filtering
    const filteredData = units.filter((unit) =>
        unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        unit.abbreviation.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const columns = [
        {
            title: t('units.name'),
            dataIndex: 'name',
            key: 'name',
            width: '40%',
        },
        {
            title: t('units.abbreviation'),
            dataIndex: 'abbreviation',
            key: 'abbreviation',
            width: '30%',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: t('units.actions'),
            key: 'actions',
            width: '30%',
            render: (_: any, record: Unit) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        {t('common.edit')}
                    </Button>
                    <Popconfirm
                        title={t('units.delete_confirm')}
                        description={t('units.delete_desc')}
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
            title={!isMobile ? t('units.title') : undefined}
            extra={!isMobile ? (
                <Space>
                    <Input
                        placeholder={t('units.search_placeholder')}
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                        allowClear
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['units'] })} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        {t('units.new')}
                    </Button>
                </Space>
            ) : null}
        >
            {isMobile && (
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, marginBottom: 16 }}>⚖️ {t('units.title')}</h2>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Input
                            placeholder={t('units.search_placeholder')}
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
                                {t('units.new')}
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['units'] })}
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
                    pagination={{
                        pageSize: 10,
                        size: 'small',
                        simple: true,
                    }}
                    renderItem={(item: Unit) => (
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
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 12,
                                    backgroundColor: '#f5f3ff',
                                    color: '#7c3aed',
                                    fontSize: 14,
                                    fontWeight: 700,
                                    border: '1px solid #ddd6fe'
                                }}>
                                    {item.abbreviation}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>
                                        {item.name}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                                        {t('units.abbreviation')}: {item.abbreviation}
                                    </div>
                                </div>
                            </div>
                            <div style={{ color: '#9ca3af' }}>
                                <EditOutlined style={{ fontSize: 16 }} />
                            </div>
                        </List.Item>
                    )}
                />
            )}

            <UnitFormModal
                open={isModalOpen}
                unit={editingUnit}
                onClose={handleModalClose}
            />
        </Card>
    );
};
