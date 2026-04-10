import { useState } from 'react';
import { Card, Table, Button, Input, Space, message, Popconfirm, Tooltip, Grid, Row, Col, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, WhatsAppOutlined, InstagramOutlined, FacebookOutlined, TwitterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '../../services/clientsApi';
import type { Client } from '../../services/clientsApi';
import { ClientFormModal } from './ClientFormModal';
import { ClientPurchaseHistory } from '../../components/ClientPurchaseHistory';
import type { ColumnsType } from 'antd/es/table';

export const ClientsPage = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const queryClient = useQueryClient();

    // Fetch clients
    const { data: clients, isLoading } = useQuery({
        queryKey: ['clients', search],
        queryFn: () => clientsApi.getAll(search),
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: clientsApi.delete,
        onSuccess: () => {
            message.success('Cliente eliminado');
            queryClient.invalidateQueries({ queryKey: ['clients'] });
        },
        onError: () => {
            message.error('Error al eliminar cliente');
        },
    });

    const handleEdit = (client: Client) => {
        setEditingClient(client);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingClient(null);
    };

    const formatWhatsAppUrl = (phone: string, name: string) => {
        // Remove non-numeric characters
        let cleanPhone = phone.replace(/\D/g, '');

        // Handle common Venezuelan format: if starts with 04, replace with 584
        if (cleanPhone.startsWith('04')) {
            cleanPhone = '58' + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('58') && cleanPhone.length === 10) {
            // Assume missing 58 for local mobile 4xx
            cleanPhone = '58' + cleanPhone;
        }

        const message = encodeURIComponent(`Hola ${name}, te contactamos de MastERP...`);
        return `https://wa.me/${cleanPhone}/?text=${message}`;
    };

    const columns: ColumnsType<Client> = [
        {
            title: 'ID',
            dataIndex: 'id',
            key: 'id',
            width: 150,
        },
        {
            title: 'Nombre',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Teléfono',
            dataIndex: 'phone',
            key: 'phone',
            width: 150,
            render: (phone: string, record: Client) => (
                <Space>
                    {phone}
                    {record.hasWhatsapp && phone && (
                        <Tooltip title="Enviar WhatsApp">
                            <WhatsAppOutlined
                                style={{ color: '#25D366', cursor: 'pointer', fontSize: 16 }}
                                onClick={() => window.open(formatWhatsAppUrl(phone, record.name), '_blank')}
                            />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: 'Redes Sociales',
            key: 'social',
            width: 120,
            render: (_, record: Client) => (
                <Space>
                    {record.social1 && (
                        <Tooltip title={`Instagram: ${record.social1}`}>
                            <InstagramOutlined
                                style={{ color: '#E1306C', cursor: 'pointer' }}
                                onClick={() => window.open(`https://instagram.com/${record.social1}`, '_blank')}
                            />
                        </Tooltip>
                    )}
                    {record.social2 && (
                        <Tooltip title={`Facebook: ${record.social2}`}>
                            <FacebookOutlined
                                style={{ color: '#4267B2', cursor: 'pointer' }}
                                onClick={() => window.open(`https://facebook.com/${record.social2}`, '_blank')}
                            />
                        </Tooltip>
                    )}
                    {record.social3 && (
                        <Tooltip title={`Twitter/X: ${record.social3}`}>
                            <TwitterOutlined
                                style={{ color: '#1DA1F2', cursor: 'pointer' }}
                                onClick={() => window.open(`https://x.com/${record.social3}`, '_blank')}
                            />
                        </Tooltip>
                    )}
                </Space>
            ),
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 150,
            fixed: isMobile ? false : ('right' as const),
            render: (_, record) => (
                <Space>
                    <ClientPurchaseHistory clientId={record.id} clientName={record.name} />
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    />
                    <Popconfirm
                        title="¿Eliminar cliente?"
                        description="Esta acción marcará al cliente como inactivo"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Sí"
                        cancelText="No"
                    >
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                        />
                    </Popconfirm>
                </Space>
            ),
        }
    ];

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <Card>
                <Row justify="space-between" align="middle" gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    <Col xs={24} md={12}>
                        <Typography.Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>👥 Gestión de Clientes</Typography.Title>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'right' : 'right' }}>
                        <Space wrap={isMobile}>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
                            />
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setIsModalOpen(true)}
                                block={isMobile}
                            >
                                {isMobile ? 'Nuevo' : 'Nuevo Cliente'}
                            </Button>
                        </Space>
                    </Col>
                </Row>

                <div style={{ marginBottom: 16 }}>
                    <Input
                        placeholder="Buscar por nombre, ID o email"
                        prefix={<SearchOutlined />}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ maxWidth: isMobile ? '100%' : 400 }}
                        size={isMobile ? 'middle' : 'large'}
                    />
                </div>

                <Table
                    columns={columns}
                    dataSource={clients}
                    loading={isLoading}
                    rowKey="id"
                    scroll={{ x: 'max-content' }}
                    size={isMobile ? 'small' : 'middle'}
                    pagination={{
                        defaultPageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        size: isMobile ? 'small' : 'default',
                        showTotal: (total) => `Total: ${total} clientes`,
                    }}
                />
            </Card>

            <ClientFormModal
                open={isModalOpen}
                client={editingClient}
                onClose={handleModalClose}
            />
        </div>
    );
};
