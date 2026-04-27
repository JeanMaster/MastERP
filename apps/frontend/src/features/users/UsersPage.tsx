import { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, message, Grid, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
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
            message.success('User account deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
        onError: () => message.error('Failed to delete user')
    });

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: 'Delete user account?',
            content: 'This action is permanent and cannot be undone.',
            okText: 'Yes, Delete',
            cancelText: 'Cancel',
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
            title: 'Username',
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
            title: 'Full Name',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Security Role',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => {
                const colors: Record<string, string> = {
                    ADMIN: 'red',
                    SUPERVISOR: 'gold',
                    CASHIER: 'green',
                    USER: 'blue'
                };
                return <Tag color={colors[role] || 'blue'}>{role}</Tag>;
            }
        },
        {
            title: 'Account Status',
            dataIndex: 'isActive',
            key: 'isActive',
            align: 'center' as const,
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'default'}>
                    {isActive ? 'Active' : 'Inactive'}
                </Tag>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 120,
            render: (_: any, record: any) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        title="Edit User"
                    />
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record.id)}
                        disabled={record.username === 'admin'} // Protect system administrator
                        title={record.username === 'admin' ? "System Admin cannot be deleted" : "Delete User"}
                    />
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: isMobile ? 8 : 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}>👤 User Management</Title>
                    <Text type="secondary">Control system access levels and security permissions.</Text>
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} size="large">
                    {isMobile ? 'Add' : 'Register New User'}
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
                        showTotal: (total) => `Total: ${total} users`
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
