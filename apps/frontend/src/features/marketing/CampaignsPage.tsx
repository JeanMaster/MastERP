import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Progress, Divider, Typography, Spin } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { RocketOutlined, PlusOutlined, WhatsAppOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

/**
 * CampaignsPage Component
 * Management and execution center for mass marketing campaigns (Bulk WhatsApp messaging).
 * Allows creating segmented campaigns, tracking delivery progress, and providing manual execution shortcuts via WhatsApp Web.
 */
export const CampaignsPage = () => {
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [viewCampaignId, setViewCampaignId] = useState<string | null>(null);
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data: campaigns, isLoading: loadingCampaigns } = useQuery({
        queryKey: ['marketing-campaigns'],
        queryFn: marketingApi.getCampaigns,
    });

    const { data: templates } = useQuery({
        queryKey: ['marketing-templates'],
        queryFn: marketingApi.getTemplates,
    });

    const { data: campaignDetails, isLoading: loadingDetails } = useQuery({
        queryKey: ['marketing-campaign-details', viewCampaignId],
        queryFn: () => marketingApi.getCampaignDetails(viewCampaignId!),
        enabled: !!viewCampaignId,
    });

    /**
     * Initializes a new campaign and generates the target recipient list based on segments.
     */
    const createMutation = useMutation({
        mutationFn: marketingApi.createCampaign,
        onSuccess: () => {
            message.success('Campaign created. Recipient list generated.');
            queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
            setIsCreateModalVisible(false);
            form.resetFields();
        },
        onError: (err: any) => {
            message.error(err?.response?.data?.message || 'Error creating campaign');
        }
    });

    /**
     * Updates the status of a specific recipient within a campaign.
     */
    const markSentMutation = useMutation({
        mutationFn: marketingApi.markRecipientSent,
        onSuccess: () => {
            message.success('Recipient marked as sent');
            queryClient.invalidateQueries({ queryKey: ['marketing-campaign-details', viewCampaignId] });
            queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
        }
    });

    // F9 Keyboard Shortcut for quick campaign launch
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isCreateModalVisible) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                handleCreate();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isCreateModalVisible, form]);

    const handleCreate = async () => {
        try {
            const values = await form.validateFields();
            createMutation.mutate(values);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    /**
     * Formats phone number and opens WhatsApp Web with the pre-filled campaign message.
     */
    const handleWhatsAppClick = (phone: string, text: string) => {
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('04')) {
            cleanPhone = '58' + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('58') && cleanPhone.length === 10) {
            cleanPhone = '58' + cleanPhone;
        }
        const encodedText = encodeURIComponent(text);
        const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
        window.open(url, '_blank');
    };

    const columns = [
        { 
            title: 'Campaign Name', 
            dataIndex: 'name', 
            key: 'name',
            render: (text: string) => <strong>{text}</strong>
        },
        { 
            title: 'Target Segment', 
            dataIndex: 'targetSegment', 
            key: 'targetSegment',
            render: (seg: string) => <Tag color="blue">{seg}</Tag>
        },
        { 
            title: 'Template', 
            key: 'template',
            render: (_: any, record: any) => record.template?.name || 'N/A'
        },
        {
            title: 'Delivery Progress',
            key: 'progress',
            width: 200,
            render: (_: any, record: any) => {
                const percent = record.totalRecipients > 0 ? Math.round((record.sentCount / record.totalRecipients) * 100) : 0;
                return (
                    <div>
                        <Progress percent={percent} size="small" status={percent === 100 ? 'success' : 'active'} />
                        <div style={{ fontSize: '11px', textAlign: 'center', marginTop: 4 }}>
                            {record.sentCount} / {record.totalRecipients} sent
                        </div>
                    </div>
                );
            }
        },
        { 
            title: 'Status', 
            dataIndex: 'status', 
            key: 'status',
            align: 'center' as const,
            render: (status: string) => (
                <Tag color={status === 'COMPLETED' ? 'success' : status === 'PENDING' ? 'processing' : 'default'}>
                    {status}
                </Tag>
            )
        },
        { 
            title: 'Date Created', 
            dataIndex: 'createdAt', 
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY HH:mm')
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: any) => (
                <Button 
                    type="primary" 
                    ghost 
                    size="small"
                    onClick={() => setViewCampaignId(record.id)}
                >
                    Monitor / Execute
                </Button>
            )
        }
    ];

    const recipientColumns = [
        { title: 'Customer', dataIndex: 'clientName', key: 'clientName' },
        { title: 'Phone', dataIndex: 'clientPhone', key: 'clientPhone' },
        { 
            title: 'Delivery Status', 
            dataIndex: 'status', 
            key: 'status',
            render: (s: string) => s === 'SENT' ? <Tag color="green">Sent</Tag> : <Tag color="orange">Pending</Tag>
        },
        {
            title: 'Execution Actions',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Button 
                        type="primary" 
                        style={{ backgroundColor: '#25D366', borderColor: '#25D366' }} 
                        icon={<WhatsAppOutlined />}
                        onClick={() => handleWhatsAppClick(record.clientPhone, record.message)}
                    >
                        Open WhatsApp
                    </Button>
                    <Button 
                        type={record.status === 'SENT' ? 'default' : 'primary'}
                        icon={<CheckCircleOutlined />}
                        disabled={record.status === 'SENT' || markSentMutation.isPending}
                        onClick={() => markSentMutation.mutate(record.id)}
                    >
                        {record.status === 'SENT' ? 'Done' : 'Mark as Sent'}
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}><RocketOutlined /> Mass Marketing Campaigns</Title>
                    <Text type="secondary">Reach your customers directly through personalized messaging.</Text>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalVisible(true)}
                    size="large"
                >
                    Launch New Campaign
                </Button>
            </div>

            <Card bordered={false}>
                <Table 
                    columns={columns} 
                    dataSource={campaigns} 
                    loading={loadingCampaigns}
                    rowKey="id"
                    pagination={{
                        showTotal: (total) => `Total: ${total} campaigns`
                    }}
                />
            </Card>

            <Modal
                title="Launch New Campaign"
                open={isCreateModalVisible}
                onOk={handleCreate}
                onCancel={() => setIsCreateModalVisible(false)}
                confirmLoading={createMutation.isPending}
                okText="Initialize Campaign (F9)"
            >
                <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                    <Form.Item 
                        name="name" 
                        label="Internal Campaign Name"
                        rules={[{ required: true, message: 'Please enter a name' }]}
                    >
                        <Input placeholder="e.g., Black Friday 2025 VIP Preview" />
                    </Form.Item>

                    <Form.Item 
                        name="templateId" 
                        label="Message Template"
                        rules={[{ required: true, message: 'Please select a template' }]}
                    >
                        <Select placeholder="Select a pre-defined template">
                            {templates?.map((t: any) => (
                                <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item 
                        name="targetSegment" 
                        label="Target Segment"
                        rules={[{ required: true, message: 'Please select a segment' }]}
                        extra="The system will automatically replace template variables (e.g., {{name}}) for each customer in this segment."
                    >
                        <Select placeholder="Choose target audience">
                            <Select.Option value="ALL">All Registered Customers</Select.Option>
                            <Select.Option value="VIP">VIP (Diamond) Customers Only</Select.Option>
                            <Select.Option value="GOLD">Gold Tier Customers Only</Select.Option>
                            <Select.Option value="CHURN">Risk of Churn (Inactive Customers)</Select.Option>
                            <Select.Option value="BIRTHDAY">Current Month Birthdays</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={`Campaign Monitor: ${campaignDetails?.name || ''}`}
                open={!!viewCampaignId}
                onCancel={() => setViewCampaignId(null)}
                footer={[
                    <Button key="close" onClick={() => setViewCampaignId(null)}>
                        Close Monitor
                    </Button>
                ]}
                width={900}
            >
                {loadingDetails ? (
                    <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
                ) : campaignDetails ? (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <Text strong>Original Message Template:</Text>
                            <div style={{ padding: '12px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px', whiteSpace: 'pre-wrap', marginTop: 8 }}>
                                {campaignDetails.template?.content}
                            </div>
                        </div>
                        <Divider />
                        <Title level={5}>Recipient List ({campaignDetails.totalRecipients})</Title>
                        <Alert 
                            message="Campaign Execution Instructions"
                            description='Click "Open WhatsApp" to launch the chat with the personalized message. After sending, click "Mark as Sent" to update the progress tracker.'
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                        />
                        <Table 
                            columns={recipientColumns} 
                            dataSource={campaignDetails.recipients}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 10 }}
                            bordered
                        />
                    </div>
                ) : null}
            </Modal>
        </div>
    );
};

const Alert = ({ message, description, type, showIcon, style }: any) => (
    <div style={{ 
        padding: '12px 16px', 
        background: type === 'info' ? '#e6f7ff' : '#fff', 
        border: `1px solid ${type === 'info' ? '#91d5ff' : '#eee'}`,
        borderRadius: '8px',
        display: 'flex',
        gap: '12px',
        ...style 
    }}>
        {showIcon && <CheckCircleOutlined style={{ color: '#1890ff', marginTop: 4 }} />}
        <div>
            <div style={{ fontWeight: 'bold', color: 'rgba(0,0,0,0.85)' }}>{message}</div>
            <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.65)' }}>{description}</div>
        </div>
    </div>
);
