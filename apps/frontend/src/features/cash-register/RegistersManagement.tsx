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
    Tag,
    App,
    Popconfirm,
    Grid,
    List
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ShopOutlined,
    EnvironmentOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cashRegisterApi, type CashRegister } from '../../services/cashRegisterApi';

const { Title, Text } = Typography;

/**
 * RegistersManagement Component
 * Admin view to manage (create, edit, deactivate) physical cash registers.
 */
export const RegistersManagement = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const queryClient = useQueryClient();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingRegister, setEditingRegister] = useState<CashRegister | null>(null);
    const [form] = Form.useForm();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;

    // Fetch registers
    const { data: registers = [], isLoading } = useQuery({
        queryKey: ['cashRegisters'],
        queryFn: () => cashRegisterApi.listRegisters()
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: { name: string, location?: string }) => cashRegisterApi.createRegister(data),
        onSuccess: () => {
            message.success(t('cash_register.success_create'));
            queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
            handleCancel();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => cashRegisterApi.updateRegister(id, data),
        onSuccess: () => {
            message.success(t('cash_register.success_update'));
            queryClient.invalidateQueries({ queryKey: ['cashRegisters'] });
            handleCancel();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => cashRegisterApi.deleteRegister(id),
        onSuccess: () => {
            message.success(t('cash_register.success_delete'));
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
            title: t('cash_register.register_name'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => (
                <Space>
                    <ShopOutlined style={{ color: '#1890ff' }} />
                    <Typography.Text strong>{text}</Typography.Text>
                </Space>
            )
        },
        {
            title: t('expenses.location', { defaultValue: 'Location' }),
            dataIndex: 'location',
            key: 'location',
            render: (text: string) => (
                <Space>
                    <EnvironmentOutlined style={{ color: '#8c8c8c' }} />
                    <Typography.Text type="secondary">{text || t('common.not_specified', { defaultValue: 'Not specified' })}</Typography.Text>
                </Space>
            )
        },
        {
            title: t('cash_register.status'),
            dataIndex: 'isActive',
            key: 'isActive',
            render: (active: boolean) => (
                <Tag color={active ? 'green' : 'red'}>
                    {active ? t('users.active') : t('users.inactive')}
                </Tag>
            )
        },
        {
            title: t('cash_register.actions'),
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
                        title={t('cash_register.delete_confirm')}
                        description={t('products.delete_desc', { defaultValue: 'This action cannot be undone' })}
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText={t('common.yes', { defaultValue: 'Yes' })}
                        cancelText={t('common.no', { defaultValue: 'No' })}
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

    const renderRegisterList = () => (
        !isMobile ? (
            <Table
                dataSource={registers}
                columns={columns}
                rowKey="id"
                loading={isLoading}
                pagination={false}
            />
        ) : (
            <List
                dataSource={registers}
                loading={isLoading}
                renderItem={(item: CashRegister) => (
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
                                <div>
                                    <Space>
                                        <ShopOutlined style={{ color: '#1890ff', fontSize: '18px' }} />
                                        <Typography.Text strong style={{ fontSize: '16px' }}>{item.name}</Typography.Text>
                                    </Space>
                                    <div style={{ marginTop: 4 }}>
                                        <Space>
                                            <EnvironmentOutlined style={{ color: '#8c8c8c' }} />
                                            <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
                                                {item.location || t('common.not_specified', { defaultValue: 'Not specified' })}
                                            </Typography.Text>
                                        </Space>
                                    </div>
                                </div>
                                <Tag color={item.isActive ? 'green' : 'red'} style={{ borderRadius: '12px', margin: 0 }}>
                                    {item.isActive ? t('users.active') : t('users.inactive')}
                                </Tag>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                                <Button 
                                    icon={<EditOutlined />} 
                                    onClick={() => handleEdit(item)}
                                    style={{ borderRadius: '8px' }}
                                >
                                    {t('common.edit')}
                                </Button>
                                <Popconfirm
                                    title={t('cash_register.delete_confirm')}
                                    description={t('products.delete_desc', { defaultValue: 'This action cannot be undone' })}
                                    onConfirm={() => deleteMutation.mutate(item.id)}
                                    okText={t('common.yes', { defaultValue: 'Yes' })}
                                    cancelText={t('common.no', { defaultValue: 'No' })}
                                >
                                    <Button 
                                        danger 
                                        icon={<DeleteOutlined />} 
                                        style={{ borderRadius: '8px' }}
                                    />
                                </Popconfirm>
                            </div>
                        </Card>
                    </List.Item>
                )}
            />
        )
    );

    return (
        <div style={{ padding: '24px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                    <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
                        <SettingOutlined style={{ marginRight: 12, color: '#6366f1' }} />
                        {t('cash_register.title')}
                    </Title>
                    <Text type="secondary">{t('cash_register.dashboard_title')}</Text>
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                    size="large"
                    style={{ 
                        borderRadius: '12px', 
                        height: '48px', 
                        padding: '0 24px',
                        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                    }}
                >
                    {t('cash_register.new')}
                </Button>
            </div>

            <Card style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', padding: isMobile ? '0' : 'default' }}>
                {renderRegisterList()}
            </Card>

            <Modal
                title={editingRegister ? t('cash_register.edit') : t('cash_register.new')}
                open={isModalVisible}
                onOk={handleSubmit}
                onCancel={handleCancel}
                confirmLoading={createMutation.isPending || updateMutation.isPending}
                okText={editingRegister ? t('common.save', { defaultValue: 'Save' }) : t('common.create', { defaultValue: 'Create' })}
                cancelText={t('common.cancel')}
                forceRender
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{ location: 'Store' }}
                >
                    <Form.Item
                        name="name"
                        label={t('cash_register.register_name')}
                        rules={[{ required: true, message: t('common.required') }]}
                    >
                        <Input placeholder="e.g., Main Register, Back Counter..." />
                    </Form.Item>
                    <Form.Item
                        name="location"
                        label={t('expenses.location', { defaultValue: 'Location' })}
                    >
                        <Input placeholder="e.g., Aisle 1, Main Entrance..." />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};
