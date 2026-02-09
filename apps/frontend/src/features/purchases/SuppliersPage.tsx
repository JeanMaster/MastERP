import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Space, Card, Tag, Tooltip, Switch, App, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UserOutlined, ShopOutlined, ReloadOutlined } from '@ant-design/icons';
import { suppliersApi } from '../../services/suppliersApi';
import type { Supplier, CreateSupplierDto, UpdateSupplierDto } from '../../services/suppliersApi';
import { CreateSupplierModal } from './components/CreateSupplierModal';

export const SuppliersPage: React.FC = () => {
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
    }, [showInactive]); // Refetch when toggle inactive

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            // Logic for search + active filtering is partly in backend (search) or frontend (filtering) or both.
            // API supports `search` and `active`.
            // If we want to see inactive, we might need to modify API to `active=undefined` or handle query params.
            // Currently backend `findAll` takes `active` boolean.
            // If we want to show ALL (active and inactive), we'd need to adjust backend or call twice.
            // Let's assume for now the checkbox is "Show Inactive" meaning "Show ONLY Inactive" or "Show ALL"?
            // Usually "Show Inactive" means include them. The backend `findAll` defaults to active=true.
            // Let's keep it simple: "Ver Inactivos" -> active=false. "Ver Activos" -> active=true.
            // Or better: Toggle "Solo Activos" (default checked).

            const data = await suppliersApi.getAll(searchTerm, !showInactive);
            // If showInactive is false (default), active=true (only active).
            // If showInactive is true, active=false (only inactive? or all? Backend logic: `where: { active }`).
            // Backend: `const where: any = { active };` means exact match.
            // So detailed toggle: "Estado: Activo/Inactivo".

            setSuppliers(data);
        } catch (error) {
            message.error('Error al cargar proveedores');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (values: CreateSupplierDto) => {
        setModalLoading(true);
        try {
            await suppliersApi.create(values);
            message.success('Proveedor creado exitosamente');
            setModalVisible(false);
            fetchSuppliers();
        } catch (error: any) {
            // Backend returns 409 for duplicate RIF
            if (error.message?.includes('RIF')) {
                message.error('El RIF ya está registrado');
            } else {
                message.error('Error al crear proveedor');
            }
        } finally {
            setModalLoading(false);
        }
    };

    const handleUpdate = async (values: UpdateSupplierDto) => {
        if (!editingSupplier) return;
        setModalLoading(true);
        try {
            // Remove internal fields that shouldn't be sent to the API (like id, createdAt, updatedAt)
            // though they might not be in 'values', it's safer to destructure what we expect or exclude what we don't.
            const { ...updateData } = values as any;

            await suppliersApi.update(editingSupplier.id, updateData);
            message.success('Proveedor actualizado');
            setModalVisible(false);
            setEditingSupplier(null);
            fetchSuppliers();
        } catch (error) {
            message.error('Error al actualizar proveedor');
        } finally {
            setModalLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        modal.confirm({
            title: '¿Estás seguro?',
            content: 'El proveedor será marcado como inactivo.',
            okText: 'Sí, desactivar',
            cancelText: 'Cancelar',
            onOk: async () => {
                try {
                    await suppliersApi.remove(id);
                    message.success('Proveedor desactivado');
                    fetchSuppliers();
                } catch (error) {
                    message.error('Error al desactivar proveedor');
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
            title: 'Nombre Comercial / Razón Social',
            key: 'name',
            render: (_: any, record: Supplier) => (
                <Space direction="vertical" size={0}>
                    <span style={{ fontWeight: 500 }}>{record.comercialName}</span>
                    {record.legalName && <span style={{ fontSize: '12px', color: '#888' }}>{record.legalName}</span>}
                </Space>
            ),
        },
        {
            title: 'RIF',
            dataIndex: 'rif',
            key: 'rif',
            render: (text: string) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: 'Contacto',
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
            title: 'Dirección',
            dataIndex: 'address',
            key: 'address',
            ellipsis: true,
        },
        {
            title: 'Categoría',
            dataIndex: 'category',
            key: 'category',
            render: (text: string) => text ? <Tag>{text}</Tag> : '-',
        },
        {
            title: 'Estado',
            dataIndex: 'active',
            key: 'active',
            render: (active: boolean) => (
                <Tag color={active ? 'success' : 'error'}>
                    {active ? 'Activo' : 'Inactivo'}
                </Tag>
            )
        },
        {
            title: 'Acciones',
            key: 'actions',
            render: (_: any, record: Supplier) => (
                <Space>
                    <Tooltip title="Editar">
                        <Button
                            icon={<EditOutlined />}
                            onClick={() => openEditModal(record)}
                            type="text"
                        />
                    </Tooltip>
                    {record.active && (
                        <Tooltip title="Desactivar">
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
                            <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px' }}>Proveedores</h1>
                        </Space>
                        <Space.Compact style={{ width: isMobile ? '100%' : 'auto' }}>
                            <Input
                                placeholder="Buscar..."
                                prefix={<SearchOutlined />}
                                style={{ width: isMobile ? '100%' : 250 }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onPressEnter={fetchSuppliers}
                            />
                            <Button onClick={fetchSuppliers}>Buscar</Button>
                        </Space.Compact>
                    </Space>
                    <Space wrap align="center" style={{ width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                        <Switch
                            checked={!showInactive}
                            onChange={(checked) => setShowInactive(!checked)}
                            checkedChildren="Activos"
                            unCheckedChildren="Inactivos"
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
                                {isMobile ? 'Nuevo' : 'Nuevo Proveedor'}
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
                        showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} proveedores`
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
