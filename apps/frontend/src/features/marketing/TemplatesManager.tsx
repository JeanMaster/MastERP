import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Typography } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { PlusOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Title, Text } = Typography;

/**
 * TemplatesManager Component
 * Registry and editor for marketing message templates.
 * Supports dynamic variables (name, tier, points) that are automatically replaced during campaign execution.
 */
export const TemplatesManager = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data: templates, isLoading } = useQuery({
        queryKey: ['marketing-templates'],
        queryFn: marketingApi.getTemplates,
    });

    const createMutation = useMutation({
        mutationFn: marketingApi.createTemplate,
        onSuccess: () => {
            message.success('Message template created successfully');
            queryClient.invalidateQueries({ queryKey: ['marketing-templates'] });
            setIsModalVisible(false);
            form.resetFields();
        },
        onError: () => {
            message.error('Failed to create template');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: marketingApi.deleteTemplate,
        onSuccess: () => {
            message.success('Template deleted');
            queryClient.invalidateQueries({ queryKey: ['marketing-templates'] });
        },
        onError: () => {
            message.error('Error deleting template');
        }
    });

    // F9 Keyboard Shortcut for quick template creation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isModalVisible) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                handleCreate();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isModalVisible, form]);

    const handleCreate = async () => {
        try {
            const values = await form.validateFields();
            createMutation.mutate(values);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const columns = [
        { 
            title: 'Template Name', 
            dataIndex: 'name', 
            key: 'name',
            render: (text: string) => <strong>{text}</strong>
        },
        { 
            title: 'Category', 
            dataIndex: 'category', 
            key: 'category',
            render: (cat: string) => {
                const colorMap: Record<string, string> = {
                    PROMOTIONAL: 'blue',
                    INFO: 'cyan',
                    BIRTHDAY: 'magenta',
                    RETENTION: 'purple'
                };
                return <Tag color={colorMap[cat] || 'default'}>{cat}</Tag>;
            }
        },
        { 
            title: 'Message Content', 
            dataIndex: 'content', 
            key: 'content',
            ellipsis: true,
            render: (text: string) => <Text type="secondary">{text}</Text>
        },
        { 
            title: 'Date Created', 
            dataIndex: 'createdAt', 
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY')
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 100,
            render: (_: any, record: any) => (
                <Space>
                    <Popconfirm
                        title="Delete this template?"
                        description="This action cannot be undone. Past campaigns will not be affected."
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText="Yes, delete"
                        cancelText="Cancel"
                    >
                        <Button danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}><FileTextOutlined /> Message Templates</Title>
                    <Text type="secondary">Create reusable message structures for your marketing campaigns.</Text>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalVisible(true)}
                    size="large"
                >
                    Create Template
                </Button>
            </div>

            <Card bordered={false}>
                <Table 
                    columns={columns} 
                    dataSource={templates} 
                    loading={isLoading}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    bordered
                />
            </Card>

            <Modal
                title="Create New Message Template"
                open={isModalVisible}
                onOk={handleCreate}
                onCancel={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                }}
                confirmLoading={createMutation.isPending}
                okText="Create Template (F9)"
                width={600}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                    <Form.Item 
                        name="name" 
                        label="Template Title"
                        rules={[{ required: true, message: 'Please enter a descriptive name' }]}
                    >
                        <Input placeholder="e.g., VIP Flash Sale Invite" />
                    </Form.Item>
                    
                    <Form.Item 
                        name="category" 
                        label="Purpose / Category"
                        initialValue="PROMOTIONAL"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value="PROMOTIONAL">Promotional</Select.Option>
                            <Select.Option value="INFO">Informational</Select.Option>
                            <Select.Option value="BIRTHDAY">Birthday Wishes</Select.Option>
                            <Select.Option value="RETENTION">Retention / Re-engagement</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item 
                        name="content" 
                        label="WhatsApp Message Body"
                        rules={[{ required: true, message: 'Message content cannot be empty' }]}
                        tooltip="Use curly braces for dynamic variables: {name}, {tier}, and {points}"
                    >
                        <TextArea 
                            rows={6} 
                            placeholder="Hi {name}! Since you are a {tier} customer, we have a special gift for you..."
                        />
                    </Form.Item>
                    
                    <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', fontSize: '13px', border: '1px solid #eee' }}>
                        <Text strong>Available Dynamic Variables:</Text>
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#666' }}>
                            <li><code>{'{name}'}</code>: Customer's first name</li>
                            <li><code>{'{tier}'}</code>: Loyalty level (VIP, Gold, Silver, Bronze)</li>
                            <li><code>{'{points}'}</code>: Total accumulated loyalty points</li>
                        </ul>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};
