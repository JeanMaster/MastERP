import { useState } from 'react';
import { Card, Table, Button, Tag, Space, Modal, message, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { BASE_URL } from '../../services/apiConfig';
import { UserFormModal } from './components/UserFormModal';

const { useBreakpoint } = Grid;
const API_URL = BASE_URL;

export const UsersPage = () => {
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const queryClient = useQueryClient();

    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await axios.get(`${API_URL}/users`);
            return res.data;
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => axios.delete(`${API_URL}/users/${id}`),
        onSuccess: () => {
            message.success('Usuario eliminado');
            queryClient.invalidateQueries({ queryKey: ['users'] });
        }
    });

    const handleDelete = (id: string) => {
        Modal.confirm({
            title: '¿Eliminar usuario?',
            content: 'Esta acción no se puede deshacer.',
            okText: 'Sí, eliminar',
            cancelText: 'Cancelar',
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
            title: 'Usuario',
            dataIndex: 'username',
            key: 'username',
            render: (text: string) => <Space><UserOutlined />{text}</Space>,
        },
        {
            title: 'Nombre',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Rol',
            dataIndex: 'role',
            key: 'role',
            render: (role: string) => {
                let color = 'blue';
                if (role === 'ADMIN') color = 'red';
                if (role === 'SUPERVISOR') color = 'gold';
                return <Tag color={color}>{role}</Tag>;
            }
        },
        {
            title: 'Estado',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (isActive: boolean) => (
                <Tag color={isActive ? 'success' : 'default'}>
                    {isActive ? 'Activo' : 'Inactivo'}
                </Tag>
            )
        },
        {
            title: 'Acciones',
            key: 'actions',
            render: (_: any, record: any) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    />
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record.id)}
                        disabled={record.username === 'admin'} // Protect admin
                    />
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: isMobile ? 8 : 24 }}>
            <Card
                title="Gestión de Usuarios"
                extra={
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                        {isMobile ? 'Nuevo' : 'Nuevo Usuario'}
                    </Button>
                }
            >
                <Table
                    columns={columns}
                    dataSource={users}
                    rowKey="id"
                    loading={isLoading}
                    scroll={{ x: 'max-content' }}
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
