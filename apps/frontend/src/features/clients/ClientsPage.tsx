import { useState } from 'react';
import { Card, Table, Button, Input, Space, message, Popconfirm, Tooltip, Grid, Row, Col, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, WhatsAppOutlined, InstagramOutlined, FacebookOutlined, TwitterOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '../../services/clientsApi';
import type { Client } from '../../services/clientsApi';
import { ClientFormModal } from './ClientFormModal';
import { ClientPurchaseHistory } from '../../components/ClientPurchaseHistory';
import type { ColumnsType } from 'antd/es/table';

/**
 * ClientsPage Component
 * Management interface for CRM (Customer Relationship Management).
 * Allows listing, searching, editing, and contacting clients via social media/WhatsApp.
 */
export const ClientsPage = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const queryClient = useQueryClient();

    // Fetch clients with optional search filter
    const { data: clients, isLoading } = useQuery({
        queryKey: ['clients', search],
        queryFn: () => clientsApi.getAll(search),
    });

    // Delete (Deactivate) mutation
    const deleteMutation = useMutation({
        mutationFn: clientsApi.delete,
        onSuccess: () => {
            message.success('Client deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['clients'] });
        },
        onError: () => {
            message.error('Error deleting client');
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

    /**
     * Formats a phone number for WhatsApp Web API.
     * Handles Venezuelan local formats automatically.
     */
    const formatWhatsAppUrl = (phone: string, name: string) => {
        let cleanPhone = phone.replace(/\D/g, '');

        // Handle Venezuelan mobile format (04xx -> 584xx)
        if (cleanPhone.startsWith('04')) {
            cleanPhone = '58' + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('58') && cleanPhone.length === 10) {
            cleanPhone = '58' + cleanPhone;
        }

        const msg = encodeURIComponent(`Hello ${name}, we are contacting you from MastERP...`);
        return `https://wa.me/${cleanPhone}/?text=${msg}`;
    };

    const columns: ColumnsType<Client> = [
        {
            title: 'ID/RIF',
            dataIndex: 'id',
            key: 'id',
            width: 150,
        },
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Phone',
            dataIndex: 'phone',
            key: 'phone',
            width: 150,
            render: (phone: string, record: Client) => (
                <Space>
                    {phone}
                    {record.hasWhatsapp && phone && (
                        <Tooltip title="Send WhatsApp">
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
            title: 'Social Media',
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
            title: 'Actions',
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
                        title="Delete client?"
                        description="This action will mark the client as inactive."
                        onConfirm={() => handleDelete(record.id)}
                        okText="Yes"
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
                        <Typography.Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>👥 Clients Management</Typography.Title>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: 'right' }}>
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
                                {isMobile ? 'New' : 'New Client'}
                            </Button>
                        </Space>
                    </Col>
                </Row>

                <div style={{ marginBottom: 16 }}>
                    <Input
                        placeholder="Search by name, ID/RIF or email"
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
                        showTotal: (total) => `Total: ${total} clients`,
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
