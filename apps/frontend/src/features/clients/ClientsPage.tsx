import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
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
            message.success(t('clients.success_delete'));
            queryClient.invalidateQueries({ queryKey: ['clients'] });
        },
        onError: () => {
            message.error(t('clients.error_delete'));
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

        const msg = encodeURIComponent(t('clients.whatsapp_msg', { name }));
        return `https://wa.me/${cleanPhone}/?text=${msg}`;
    };

    const columns: ColumnsType<Client> = [
        {
            title: t('clients.id'),
            dataIndex: 'id',
            key: 'id',
            width: 150,
        },
        {
            title: t('clients.name'),
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: t('clients.phone'),
            dataIndex: 'phone',
            key: 'phone',
            width: 150,
            render: (phone: string, record: Client) => (
                <Space>
                    {phone}
                    {record.hasWhatsapp && phone && (
                        <Tooltip title={t('clients.send_whatsapp')}>
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
            title: t('clients.email'),
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: t('clients.social_media'),
            key: 'social',
            width: 120,
            render: (_, record: Client) => (
                <Space>
                    {record.social1 && (
                        <Tooltip title={t('clients.instagram_tooltip', { handle: record.social1 })}>
                            <InstagramOutlined
                                style={{ color: '#E1306C', cursor: 'pointer' }}
                                onClick={() => window.open(`https://instagram.com/${record.social1}`, '_blank')}
                            />
                        </Tooltip>
                    )}
                    {record.social2 && (
                        <Tooltip title={t('clients.facebook_tooltip', { handle: record.social2 })}>
                            <FacebookOutlined
                                style={{ color: '#4267B2', cursor: 'pointer' }}
                                onClick={() => window.open(`https://facebook.com/${record.social2}`, '_blank')}
                            />
                        </Tooltip>
                    )}
                    {record.social3 && (
                        <Tooltip title={t('clients.twitter_tooltip', { handle: record.social3 })}>
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
            title: t('clients.actions'),
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
                        title={t('clients.delete_confirm')}
                        description={t('clients.delete_desc')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
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
                        <Typography.Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>👥 {t('clients.title')}</Typography.Title>
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
                                {isMobile ? t('common.add') : t('clients.new')}
                            </Button>
                        </Space>
                    </Col>
                </Row>

                <div style={{ marginBottom: 16 }}>
                    <Input
                        placeholder={t('clients.search_placeholder')}
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
                        showTotal: (total) => t('clients.total_count', { total }),
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
