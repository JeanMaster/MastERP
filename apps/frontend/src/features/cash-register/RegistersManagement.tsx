import { useState } from 'react';
import {
    Card,
    Table,
    Button,
    Space,
    Typography,
    Modal,
    Form,
    Input,
    message,
    Popconfirm,
    Tag
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ShopOutlined,
    EnvironmentOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashRegisterApi, type CashRegister } from '../../services/cashRegisterApi';

const { Title, Text } = Typography;

export const RegistersManagement = () => {
    const queryClient = useQueryClient();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingRegister, setEditingRegister] = useState<CashRegister | null>(null);
    const [form] = Form.useForm();

    // Fetch registers
    const { data: registers = [], isLoading } = useQuery({
        queryKey: ['cashRegisters'],
        queryFn: () => cashRegisterApi.listRegisters()
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: { name: string, location?: string }) => cashRegisterApi.createRegister(data),
        onSuccess: () => {
            message.success('Caja creada correctamente');
            queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
            handleCancel();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => cashRegisterApi.updateRegister(id, data),
        onSuccess: () => {
            message.success('Caja actualizada correctamente');
            queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
            handleCancel();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => cashRegisterApi.deleteRegister(id),
        onSuccess: () => {
            message.success('Caja eliminada correctamente');
            queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
        }
    });

    const handleAdd = () => {
        setEditingRegister(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (record: CashRegister) => {
        setEditingRegister(record);
        form.setFieldsValue(record);
        setIsModalVisible(true);
    };

    const handleCancel = () => {
        setIsModalVisible(false);
        setEditingRegister(null);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (editingRegister) {
                updateMutation.mutate({ id: editingRegister.id, data: values });
            } else {
                createMutation.mutate(values);
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const columns = [
        {
            title: 'Nombre de la Caja',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => (
                <Space>
                    <ShopOutlined style={{ color: '#1890ff' }} />
                    <Text strong>{text}</Text>
                </Space>
            )
        },
        {
            title: 'Ubicación',
            dataIndex: 'location',
            key: 'location',
            render: (text: string) => (
                <Space>
                    <EnvironmentOutlined style={{ color: '#8c8c8c' }} />
                    <Text type="secondary">{text || 'No especificada'}</Text>
                </Space>
            )
        },
        {
            title: 'Estado',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (active: boolean) => (
                <Tag color={active ? 'green' : 'red'}>
                    {active ? 'ACTIVA' : 'INACTIVA'}
                </Tag>
            )
        },
        {
            title: 'Acciones',
            key: 'actions',
            align: 'right' as const,
            render: (_: any, record: CashRegister) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        type="text"
                    />
                    <Popconfirm
                        title="¿Eliminar esta caja?"
                        description="Esta acción marcará la caja como inactiva."
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText="Sí"
                        cancelText="No"
                    >
                        <Button
                            icon={<DeleteOutlined />}
                            danger
                            type="text"
                        />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}>⚙️ Gestión de Cajas Registradoras</Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                    size="large"
                >
                    Nueva Caja
                </Button>
            </div>

            <Card>
                <Table
                    dataSource={registers}
                    columns={columns}
                    rowKey="id"
                    loading={isLoading}
                    pagination={false}
                />
            </Card>

            <Modal
                title={editingRegister ? "Editar Caja" : "Nueva Caja"}
                open={isModalVisible}
                onOk={handleSubmit}
                onCancel={handleCancel}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
                okText={editingRegister ? "Guardar" : "Crear"}
                cancelText="Cancelar"
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{ location: 'Tienda' }}
                >
                    <Form.Item
                        name="name"
                        label="Nombre de la Caja"
                        rules={[{ required: true, message: 'Por favor ingresa el nombre de la caja' }]}
                    >
                        <Input placeholder="Ej: Caja Principal, Caja Pasillo..." />
                    </Form.Item>
                    <Form.Item
                        name="location"
                        label="Ubicación"
                    >
                        <Input placeholder="Ej: Pasillo 1, Mostrador Principal..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
