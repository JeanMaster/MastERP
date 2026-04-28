import { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, Grid, Typography, App } from 'antd';
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

            <Card bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Table
                    columns={columns}
                    dataSource={users}
                    rowKey="id"
                    loading={isLoading}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                        showTotal: (total) => t('users.total_count', { total })
                    }}
                />
            </Card>

            <UserFormModal
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                user={editingUser}
            />
        </div>
    );
};
