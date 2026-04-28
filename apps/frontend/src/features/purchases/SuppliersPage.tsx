import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Card, Tag, Tooltip, Switch, App, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UserOutlined, ShopOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { suppliersApi } from '../../services/suppliersApi';
import type { Supplier, CreateSupplierDto, UpdateSupplierDto } from '../../services/suppliersApi';
import { CreateSupplierModal } from './components/CreateSupplierModal';

/**
 * SuppliersPage Component
 * Management interface for supply chain partners.
 * Handles listing, searching, and status management for suppliers.
 */
export const SuppliersPage: React.FC = () => {
    const { t } = useTranslation();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const { message, modal } = App.useApp();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);

    useEffect(() => {
        fetchSuppliers();
    }, [showInactive]); // Refetch when toggling status visibility

    /**
     * Fetches suppliers from the API with current search and status filters.
     */
    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            // Fetch only active or inactive based on the toggle state
            const data = await suppliersApi.getAll(searchTerm, !showInactive);
            setSuppliers(data);
        } catch (error) {
            message.error(t('common.error_loading_suppliers', { defaultValue: 'Error loading suppliers' }));
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (values: CreateSupplierDto) => {
        setModalLoading(true);
        try {
            await suppliersApi.create(values);
            message.success(t('common.success_create_supplier', { defaultValue: 'Supplier created successfully' }));
            setModalVisible(false);
            fetchSuppliers();
        } catch (error: any) {
            if (error.message?.includes('RIF')) {
                message.error(t('common.error_rif_registered', { defaultValue: 'The RIF is already registered' }));
            } else {
                message.error(t('common.error_create_supplier', { defaultValue: 'Error creating supplier' }));
            }
        } finally {
            setModalLoading(false);
        }
    };

    const handleUpdate = async (values: UpdateSupplierDto) => {
        if (!editingSupplier) return;
        setModalLoading(true);
        try {
            await suppliersApi.update(editingSupplier.id, values);
            message.success(t('common.success_update_supplier', { defaultValue: 'Supplier updated successfully' }));
            setModalVisible(false);
            setEditingSupplier(null);
            fetchSuppliers();
        } catch (error) {
            message.error(t('common.error_update_supplier', { defaultValue: 'Error updating supplier' }));
        } finally {
            setModalLoading(false);
        }
    };

    /**
     * Handles supplier deactivation confirmation.
     * @param id The supplier ID.
     */
    const handleDelete = (id: string) => {
        modal.confirm({
            title: t('common.are_you_sure'),
            content: t('common.deactivate_supplier_desc', { defaultValue: 'The supplier will be marked as inactive.' }),
            okText: t('common.yes_deactivate', { defaultValue: 'Yes, Deactivate' }),
            cancelText: t('common.cancel'),
            onOk: async () => {
                try {
                    await suppliersApi.remove(id);
                    message.success(t('common.success_deactivate_supplier', { defaultValue: 'Supplier deactivated' }));
                    fetchSuppliers();
                } catch (error) {
                    message.error(t('common.error_deactivate_supplier', { defaultValue: 'Error deactivating supplier' }));
                }
            },
        });
    };

    const openEditModal = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setModalVisible(true);
    };

    const columns = [
        {
            title: t('common.commercial_name', { defaultValue: 'Commercial Name / Legal Entity' }),
            key: 'name',
            render: (_: any, record: Supplier) => (
                <Space direction="vertical" size={0}>
                    <span style={{ fontWeight: 500 }}>{record.comercialName}</span>
                    {record.legalName && <span style={{ fontSize: '12px', color: '#888' }}>{record.legalName}</span>}
                </Space>
            ),
        },
        {
            title: t('common.rif', { defaultValue: 'RIF (Tax ID)' }),
            dataIndex: 'rif',
            key: 'rif',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: t('common.contact', { defaultValue: 'Contact' }),
            key: 'contact',
            render: (_: any, record: Supplier) => (
                <Space direction="vertical" size={0}>
                    {record.contactName && <span><UserOutlined /> {record.contactName}</span>}
                    {record.phone && <span>{record.phone}</span>}
                    {record.email && <span style={{ fontSize: '12px', color: '#1890ff' }}>{record.email}</span>}
                </Space>
            ),
        },
        {
            title: t('common.address'),
            dataIndex: 'address',
            key: 'address',
            ellipsis: true,
        },
        {
            title: t('common.category'),
            dataIndex: 'category',
            key: 'category',
            render: (text: string) => text ? <Tag>{text}</Tag> : '-',
        },
        {
            title: t('common.status'),
            dataIndex: 'active',
            key: 'active',
            render: (active: boolean) => (
                <Tag color={active ? 'success' : 'error'}>
                    {active ? t('common.active', { defaultValue: 'Active' }) : t('common.inactive', { defaultValue: 'Inactive' })}
                </Tag>
            )
        },
        {
            title: t('common.actions'),
            key: 'actions',
            render: (_: any, record: Supplier) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button
                            icon={<EditOutlined />}
                            onClick={() => openEditModal(record)}
                            type="text"
                        />
                    </Tooltip>
                    {record.active && (
                        <Tooltip title={t('common.deactivate', { defaultValue: 'Deactivate' })}>
                            <Button
                                icon={<DeleteOutlined />}
                                danger
                                type="text"
                                onClick={() => handleDelete(record.id)}
                            />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <Card>
                <div style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    marginBottom: 16,
                    gap: 16
                }}>
                    <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
                        <Space>
                            <ShopOutlined style={{ fontSize: isMobile ? '20px' : '24px', color: '#1890ff' }} />
                            <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px' }}>{t('menu.purchases.suppliers')}</h1>
                        </Space>
                        <Space.Compact style={{ width: isMobile ? '100%' : 'auto' }}>
                            <Input
                                placeholder={t('common.search_suppliers', { defaultValue: 'Search suppliers...' })}
                                prefix={<SearchOutlined />}
                                style={{ width: isMobile ? '100%' : 250 }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onPressEnter={fetchSuppliers}
                            />
                            <Button onClick={fetchSuppliers}>{t('common.search')}</Button>
                        </Space.Compact>
                    </Space>
                    <Space wrap align="center" style={{ width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                        <Switch
                            checked={!showInactive}
                            onChange={(checked) => setShowInactive(!checked)}
                            checkedChildren={t('common.active')}
                            unCheckedChildren={t('common.inactive')}
                            size={isMobile ? 'small' : 'default'}
                        />
                        <Space>
                            <Button icon={<ReloadOutlined />} onClick={fetchSuppliers} />
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => {
                                    setEditingSupplier(null);
                                    setModalVisible(true);
                                }}
                            >
                                {isMobile ? t('common.new') : t('common.new_supplier', { defaultValue: 'New Supplier' })}
                            </Button>
                        </Space>
                    </Space>
                </div>

                <Table
                    columns={columns}
                    dataSource={suppliers}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        defaultPageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showTotal: (total, range) => t('common.pagination_total', { rangeStart: range[0], rangeEnd: range[1], total, defaultValue: `${range[0]}-${range[1]} of ${total}` })
                    }}
                    scroll={{ x: 'max-content' }}
                />
            </Card>

            <CreateSupplierModal
                visible={modalVisible}
                onCancel={() => setModalVisible(false)}
                onSubmit={editingSupplier ? handleUpdate : handleCreate}
                initialValues={editingSupplier}
                loading={modalLoading}
            />
        </div>
    );
};
