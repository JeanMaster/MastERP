import { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Grid, Typography, App, List } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../services/usersApi';
import { UserFormModal } from './components/UserFormModal';

const { useBreakpoint } = Grid;
const { Title, Text } = Typography;

/**
 * UsersPage Component
 * Administrative dashboard for managing system access.
 * Allows creating, editing, and deleting user accounts while protecting critical system accounts like 'admin'.
 */
export const UsersPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: () => usersApi.getAll()
    });

    /**
     * Permanent deletion of a user record.
     */
    const deleteMutation = useMutation({
        mutationFn: (id: string) => usersApi.remove(id),
        onSuccess: () => {
            message.success(t('users.success_delete'));
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: () => message.error(t('users.error_delete'))
    });

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: t('users.delete_title'),
            content: t('users.delete_content'),
            okText: t('users.delete_ok'),
            cancelText: t('common.cancel'),
            okButtonProps: { danger: true },
            onOk: () => deleteMutation.mutate(id)
        });
    };

    const handleEdit = (user: any) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const columns = [
        {
            title: t('users.username'),
            dataIndex: 'username',
            key: 'username',
            render: (text: string) => (
                <Space>
                    <UserOutlined style={{ color: '#1890ff' }} />
                    <Text strong>{text}</Text>
                </Space>
            ),
        },
        {
            title: t('users.name'),
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: t('users.role'),
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => {
                const colors: Record<string, string> = {
                    ADMIN: 'red',
                    SUPERVISOR: 'gold',
                    CASHIER: 'green',
                    USER: 'blue'
                };
                return <Tag color={colors[role] || 'blue'}>{t(`users.roles.${role.toLowerCase()}`)}</Tag>;
            }
        },
        {
            title: t('users.status'),
            dataIndex: 'isActive',
            key: 'isActive',
            align: 'center' as const,
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'default'}>
                    {isActive ? t('users.active') : t('users.inactive')}
                </Tag>
            )
        },
        {
            title: t('users.actions'),
            key: 'actions',
            width: 120,
            render: (_: any, record: any) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        title={t('users.edit')}
                    />
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record.id)}
                        disabled={record.username === 'admin'} // Protect system administrator
                        title={record.username === 'admin' ? t('users.admin_delete_error') : t('users.delete_title')}
                    />
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: isMobile ? 8 : 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>👤 {t('users.title')}</Title>
                    <Text type="secondary">{t('users.subtitle')}</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} size="large">
                    {isMobile ? t('common.add') : t('users.new')}
                </Button>
            </div>

            <Card styles={{ body: { padding: isMobile ? 8 : 24 } }} style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', overflow: 'hidden' }}>
                {!isMobile ? (
                    <Table
                        columns={columns}
                        dataSource={users}
                        rowKey="id"
                        loading={isLoading}
                        scroll={{ x: 'max-content' }}
                        pagination={{
                            showTotal: (total) => t('users.total_count', { total })
                        }}
                        className="premium-table"
                    />
                ) : (
                    <List
                        dataSource={users}
                        loading={isLoading}
                        pagination={{ pageSize: 10, size: 'small', simple: true }}
                        renderItem={(item: any) => {
                            const colors: Record<string, string> = {
                                ADMIN: 'red',
                                SUPERVISOR: 'gold',
                                CASHIER: 'green',
                                USER: 'blue'
                            };
                            return (
                                <List.Item style={{ padding: '8px 0', border: 'none' }}>
                                    <Card
                                        style={{ 
                                            width: '100%', 
                                            borderRadius: '16px', 
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                            border: '1px solid #f0f0f0'
                                        }}
                                        styles={{ body: { padding: '16px' } }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                                <div style={{ 
                                                    width: '40px', 
                                                    height: '40px', 
                                                    borderRadius: '20px', 
                                                    background: '#f0f7ff', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center' 
                                                }}>
                                                    <UserOutlined style={{ color: '#1890ff', fontSize: '20px' }} />
                                                </div>
                                                <div>
                                                    <Typography.Text strong style={{ fontSize: '16px', display: 'block' }}>
                                                        {item.username}
                                                    </Typography.Text>
                                                    <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
                                                        {item.name}
                                                    </Typography.Text>
                                                </div>
                                            </div>
                                            <Tag color={item.isActive ? 'success' : 'default'} style={{ borderRadius: '12px', margin: 0 }}>
                                                {item.isActive ? t('users.active') : t('users.inactive')}
                                            </Tag>
                                        </div>

                                        <div style={{ background: '#fafafa', borderRadius: '12px', padding: '12px', marginBottom: 16 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Typography.Text type="secondary" style={{ fontSize: '13px' }}>{t('users.role')}</Typography.Text>
                                                <Tag color={colors[item.role] || 'blue'} style={{ borderRadius: '8px', margin: 0, fontWeight: 600 }}>
                                                    {t(`users.roles.${item.role.toLowerCase()}`)}
                                                </Tag>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                                            <Button 
                                                icon={<EditOutlined />} 
                                                onClick={() => handleEdit(item)}
                                                style={{ borderRadius: '8px' }}
                                            >
                                                {t('common.edit')}
                                            </Button>
                                            <Button 
                                                danger 
                                                type="text"
                                                icon={<DeleteOutlined />} 
                                                onClick={() => handleDelete(item.id)}
                                                disabled={item.username === 'admin'}
                                                style={{ borderRadius: '8px' }}
                                            />
                                        </div>
                                    </Card>
                                </List.Item>
                            );
                        }}
                    />
                )}
            </Card>

            <UserFormModal
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                user={editingUser}
            />
        </div>
    );
};
