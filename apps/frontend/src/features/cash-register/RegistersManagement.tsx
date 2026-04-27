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

/**
 * RegistersManagement Component
 * Admin view to manage (create, edit, deactivate) physical cash registers.
 */
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
            message.success('Cash register created successfully');
            queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
            handleCancel();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => cashRegisterApi.updateRegister(id, data),
        onSuccess: () => {
            message.success('Cash register updated successfully');
            queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
            handleCancel();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => cashRegisterApi.deleteRegister(id),
        onSuccess: () => {
            message.success('Cash register deleted successfully');
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
            title: 'Register Name',
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
            title: 'Location',
            dataIndex: 'location',
            key: 'location',
            render: (text: string) => (
                <Space>
                    <EnvironmentOutlined style={{ color: '#8c8c8c' }} />
                    <Text type="secondary">{text || 'Not specified'}</Text>
                </Space>
            )
        },
        {
            title: 'Status',
            dataIndex: 'isActive',
            key: 'isActive',
            render: (active: boolean) => (
                <Tag color={active ? 'green' : 'red'}>
                    {active ? 'ACTIVE' : 'INACTIVE'}
                </Tag>
            )
        },
        {
            title: 'Actions',
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
                        title="Delete this register?"
                        description="This action will mark the register as inactive."
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText="Yes"
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
                <Title level={2}>⚙️ Cash Registers Management</Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                    size="large"
                >
                    New Register
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
                title={editingRegister ? "Edit Register" : "New Register"}
                open={isModalVisible}
                onOk={handleSubmit}
                onCancel={handleCancel}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
                okText={editingRegister ? "Save" : "Create"}
                cancelText="Cancel"
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{ location: 'Store' }}
                >
                    <Form.Item
                        name="name"
                        label="Register Name"
                        rules={[{ required: true, message: 'Please enter the register name' }]}
                    >
                        <Input placeholder="e.g., Main Register, Back Counter..." />
                    </Form.Item>
                    <Form.Item
                        name="location"
                        label="Location"
                    >
                        <Input placeholder="e.g., Aisle 1, Main Entrance..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
