import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm, Typography } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { PlusOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Grid, List } from 'antd';

const { useBreakpoint } = Grid;

const { TextArea } = Input;
const { Title, Text } = Typography;

/**
 * TemplatesManager Component
 * Registry and editor for marketing message templates.
 * Supports dynamic variables (name, tier, points) that are automatically replaced during campaign execution.
 */
export const TemplatesManager = () => {
    const { t } = useTranslation();
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
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
            message.success(t('marketing.templates.success_create'));
            queryClient.invalidateQueries({ queryKey: ['marketing-templates'] });
            setIsModalVisible(false);
            form.resetFields();
        },
        onError: () => {
            message.error(t('marketing.templates.error_create'));
        }
    });

    const deleteMutation = useMutation({
        mutationFn: marketingApi.deleteTemplate,
        onSuccess: () => {
            message.success(t('marketing.templates.success_delete'));
            queryClient.invalidateQueries({ queryKey: ['marketing-templates'] });
        },
        onError: () => {
            message.error(t('marketing.templates.error_delete'));
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
            title: t('marketing.templates.table.name'), 
            dataIndex: 'name', 
            key: 'name',
            render: (text: string) => <strong>{text}</strong>
        },
        { 
            title: t('marketing.templates.table.category'), 
            dataIndex: 'category', 
            key: 'category',
            render: (cat: string) => {
                const colorMap: Record<string, string> = {
                    PROMOTIONAL: 'blue',
                    INFO: 'cyan',
                    BIRTHDAY: 'magenta',
                    RETENTION: 'purple'
                };
                return (
                    <Tag color={colorMap[cat] || 'default'}>
                        {t(`marketing.templates.categories.${cat.toLowerCase()}`, { defaultValue: cat })}
                    </Tag>
                );
            }
        },
        { 
            title: t('marketing.templates.table.content'), 
            dataIndex: 'content', 
            key: 'content',
            ellipsis: true,
            render: (text: string) => <Text type="secondary">{text}</Text>
        },
        { 
            title: t('marketing.templates.table.date'), 
            dataIndex: 'createdAt', 
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY')
        },
        {
            title: t('common.actions'),
            key: 'actions',
            width: 100,
            render: (_: any, record: any) => (
                <Space>
                    <Popconfirm
                        title={t('marketing.templates.delete_confirm')}
                        description={t('marketing.templates.delete_confirm_desc')}
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                    >
                        <Button danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: isMobile ? '12px' : '24px' }}>
            <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between', 
                alignItems: isMobile ? 'flex-start' : 'center', 
                marginBottom: 24,
                gap: 16
            }}>
                <div>
                    <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}><FileTextOutlined /> {t('marketing.templates.title')}</Title>
                    <Text type="secondary">{t('marketing.templates.subtitle')}</Text>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalVisible(true)}
                    size="large"
                    block={isMobile}
                    style={{ borderRadius: '12px' }}
                >
                    {t('marketing.templates.create_button')}
                </Button>
            </div>

            <Card variant="borderless" styles={{ body: { padding: isMobile ? 0 : 24 } }} style={{ borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                {!isMobile ? (
                    <Table 
                        columns={columns} 
                        dataSource={templates} 
                        loading={isLoading}
                        rowKey="id"
                        pagination={{ pageSize: 10 }}
                        bordered
                    />
                ) : (
                    <List
                        loading={isLoading}
                        dataSource={templates}
                        renderItem={(item: any) => (
                            <Card 
                                size="small" 
                                style={{ margin: '12px', borderRadius: '12px', border: '1px solid #f0f0f0' }}
                                actions={[
                                    <Popconfirm
                                        key="delete"
                                        title={t('marketing.templates.delete_confirm')}
                                        onConfirm={() => deleteMutation.mutate(item.id)}
                                        okText={t('common.yes')}
                                        cancelText={t('common.no')}
                                    >
                                        <Button type="text" danger icon={<DeleteOutlined />}>{t('common.delete')}</Button>
                                    </Popconfirm>
                                ]}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                    <Text strong style={{ fontSize: '16px' }}>{item.name}</Text>
                                    <Tag color={{ PROMOTIONAL: 'blue', INFO: 'cyan', BIRTHDAY: 'magenta', RETENTION: 'purple' }[item.category as string] || 'default'}>
                                        {t(`marketing.templates.categories.${item.category.toLowerCase()}`)}
                                    </Tag>
                                </div>
                                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                                    {item.content}
                                </Typography.Paragraph>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {dayjs(item.createdAt).format('MM/DD/YYYY')}
                                </Text>
                            </Card>
                        )}
                        pagination={{ pageSize: 5, simple: true, style: { textAlign: 'center', marginBottom: 16 } }}
                    />
                )}
            </Card>

            <Modal
                title={t('marketing.templates.modal_title')}
                open={isModalVisible}
                onOk={handleCreate}
                onCancel={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                }}
                confirmLoading={createMutation.isPending}
                okText={t('marketing.templates.create_button_shortcut')}
                width={600}
                forceRender
            >
                <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                    <Form.Item 
                        name="name" 
                        label={t('marketing.templates.name_label')}
                        rules={[{ required: true, message: t('common.required') }]}
                    >
                        <Input placeholder={t('marketing.templates.name_placeholder')} />
                    </Form.Item>
                    
                    <Form.Item 
                        name="category" 
                        label={t('marketing.templates.category_label')}
                        initialValue="PROMOTIONAL"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value="PROMOTIONAL">{t('marketing.templates.categories.promotional')}</Select.Option>
                            <Select.Option value="INFO">{t('marketing.templates.categories.info')}</Select.Option>
                            <Select.Option value="BIRTHDAY">{t('marketing.templates.categories.birthday')}</Select.Option>
                            <Select.Option value="RETENTION">{t('marketing.templates.categories.retention')}</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item 
                        name="content" 
                        label={t('marketing.templates.content_label')}
                        rules={[{ required: true, message: t('common.required') }]}
                        tooltip={t('marketing.templates.content_tooltip')}
                    >
                        <TextArea 
                            rows={6} 
                            placeholder={t('marketing.templates.content_placeholder')}
                        />
                    </Form.Item>
                    
                    <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', fontSize: '13px', border: '1px solid #eee' }}>
                        <Text strong>{t('marketing.templates.variables_title')}</Text>
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', color: '#666' }}>
                            <li><code>{'{name}'}</code>: {t('marketing.templates.var_name_desc')}</li>
                            <li><code>{'{tier}'}</code>: {t('marketing.templates.var_tier_desc')}</li>
                            <li><code>{'{points}'}</code>: {t('marketing.templates.var_points_desc')}</li>
                        </ul>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};
