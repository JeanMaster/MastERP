import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Progress, Divider, Typography, Spin } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { RocketOutlined, PlusOutlined, WhatsAppOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

/**
 * CampaignsPage Component
 * Management and execution center for mass marketing campaigns (Bulk WhatsApp messaging).
 * Allows creating segmented campaigns, tracking delivery progress, and providing manual execution shortcuts via WhatsApp Web.
 */
export const CampaignsPage = () => {
    const { t } = useTranslation();
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
            message.success(t('marketing.campaigns.success_create'));
            queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
            setIsCreateModalVisible(false);
            form.resetFields();
        },
        onError: (err: any) => {
            message.error(err?.response?.data?.message || t('marketing.campaigns.error_create'));
        }
    });

    /**
     * Updates the status of a specific recipient within a campaign.
     */
    const markSentMutation = useMutation({
        mutationFn: marketingApi.markRecipientSent,
        onSuccess: () => {
            message.success(t('marketing.campaigns.recipient_marked'));
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
            title: t('marketing.campaigns.campaign_name'), 
            dataIndex: 'name', 
            key: 'name',
            render: (text: string) => <strong>{text}</strong>
        },
        { 
            title: t('marketing.campaigns.target_segment'), 
            dataIndex: 'targetSegment', 
            key: 'targetSegment',
            render: (seg: string) => <Tag color="blue">{t(`marketing.campaigns.segments.${seg.toLowerCase()}`, { defaultValue: seg })}</Tag>
        },
        { 
            title: t('marketing.campaigns.message_template'), 
            key: 'template',
            render: (_: any, record: any) => record.template?.name || 'N/A'
        },
        {
            title: t('marketing.campaigns.delivery_progress'),
            key: 'progress',
            width: 200,
            render: (_: any, record: any) => {
                const percent = record.totalRecipients > 0 ? Math.round((record.sentCount / record.totalRecipients) * 100) : 0;
                return (
                    <div>
                        <Progress percent={percent} size="small" status={percent === 100 ? 'success' : 'active'} />
                        <div style={{ fontSize: '11px', textAlign: 'center', marginTop: 4 }}>
                            {t('marketing.campaigns.sent_count', { sent: record.sentCount, total: record.totalRecipients })}
                        </div>
                    </div>
                );
            }
        },
        { 
            title: t('common.status'), 
            dataIndex: 'status', 
            key: 'status',
            align: 'center' as const,
            render: (status: string) => (
                <Tag color={status === 'COMPLETED' ? 'success' : status === 'PENDING' ? 'processing' : 'default'}>
                    {t(`common.status_${status.toLowerCase()}`, { defaultValue: status })}
                </Tag>
            )
        },
        { 
            title: t('marketing.campaigns.date_created'), 
            dataIndex: 'createdAt', 
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY HH:mm')
        },
        {
            title: t('common.actions'),
            key: 'actions',
            render: (_: any, record: any) => (
                <Button 
                    type="primary" 
                    ghost 
                    size="small"
                    onClick={() => setViewCampaignId(record.id)}
                >
                    {t('marketing.campaigns.monitor_execute')}
                </Button>
            )
        }
    ];

    const recipientColumns = [
        { title: t('common.customer'), dataIndex: 'clientName', key: 'clientName' },
        { title: t('common.phone'), dataIndex: 'clientPhone', key: 'clientPhone' },
        { 
            title: t('marketing.campaigns.delivery_status', { defaultValue: 'Delivery Status' }), 
            dataIndex: 'status', 
            key: 'status',
            render: (s: string) => s === 'SENT' ? <Tag color="green">{t('marketing.campaigns.sent', { defaultValue: 'Sent' })}</Tag> : <Tag color="orange">{t('marketing.campaigns.pending', { defaultValue: 'Pending' })}</Tag>
        },
        {
            title: t('marketing.campaigns.execution_actions'),
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Button 
                        type="primary" 
                        style={{ backgroundColor: '#25D366', borderColor: '#25D366' }} 
                        icon={<WhatsAppOutlined />}
                        onClick={() => handleWhatsAppClick(record.clientPhone, record.message)}
                    >
                        {t('marketing.campaigns.open_whatsapp')}
                    </Button>
                    <Button 
                        type={record.status === 'SENT' ? 'default' : 'primary'}
                        icon={<CheckCircleOutlined />}
                        disabled={record.status === 'SENT' || markSentMutation.isPending}
                        onClick={() => markSentMutation.mutate(record.id)}
                    >
                        {record.status === 'SENT' ? t('marketing.campaigns.done') : t('marketing.campaigns.mark_as_sent')}
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <Title level={2} style={{ margin: 0 }}><RocketOutlined /> {t('marketing.campaigns.mass_campaigns')}</Title>
                    <Text type="secondary">{t('marketing.campaigns.campaigns_subtitle')}</Text>
                </div>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalVisible(true)}
                    size="large"
                >
                    {t('marketing.campaigns.launch_new')}
                </Button>
            </div>

            <Card bordered={false}>
                <Table 
                    columns={columns} 
                    dataSource={campaigns} 
                    loading={loadingCampaigns}
                    rowKey="id"
                    pagination={{
                        showTotal: (total) => t('common.pagination_total_campaigns', { defaultValue: `Total: ${total} campaigns`, total })
                    }}
                />
            </Card>

            <Modal
                title={t('marketing.campaigns.launch_new')}
                open={isCreateModalVisible}
                onOk={handleCreate}
                onCancel={() => setIsCreateModalVisible(false)}
                confirmLoading={createMutation.isPending}
                okText={t('marketing.campaigns.launch_button_shortcut', { defaultValue: 'Initialize Campaign (F9)' })}
            >
                <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                    <Form.Item 
                        name="name" 
                        label={t('marketing.campaigns.internal_name')}
                        rules={[{ required: true, message: t('common.required') }]}
                    >
                        <Input placeholder={t('marketing.campaigns.internal_name_placeholder')} />
                    </Form.Item>

                    <Form.Item 
                        name="templateId" 
                        label={t('marketing.campaigns.message_template')}
                        rules={[{ required: true, message: t('common.required') }]}
                    >
                        <Select placeholder={t('marketing.campaigns.template_placeholder')}>
                            {templates?.map((t: any) => (
                                <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item 
                        name="targetSegment" 
                        label={t('marketing.campaigns.target_segment')}
                        rules={[{ required: true, message: t('common.required') }]}
                        extra={t('marketing.campaigns.template_variable_hint')}
                    >
                        <Select placeholder={t('marketing.campaigns.choose_audience')}>
                            <Select.Option value="ALL">{t('marketing.campaigns.segments.all')}</Select.Option>
                            <Select.Option value="VIP">{t('marketing.campaigns.segments.vip')}</Select.Option>
                            <Select.Option value="GOLD">{t('marketing.campaigns.segments.gold')}</Select.Option>
                            <Select.Option value="CHURN">{t('marketing.campaigns.segments.churn')}</Select.Option>
                            <Select.Option value="BIRTHDAY">{t('marketing.campaigns.segments.birthday')}</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={t('marketing.campaigns.monitor_title', { name: campaignDetails?.name || '' })}
                open={!!viewCampaignId}
                onCancel={() => setViewCampaignId(null)}
                footer={[
                    <Button key="close" onClick={() => setViewCampaignId(null)}>
                        {t('marketing.campaigns.close_monitor')}
                    </Button>
                ]}
                width={900}
            >
                {loadingDetails ? (
                    <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
                ) : campaignDetails ? (
                    <div>
                        <div style={{ marginBottom: 24 }}>
                            <Text strong>{t('marketing.campaigns.original_template')}</Text>
                            <div style={{ padding: '12px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '8px', whiteSpace: 'pre-wrap', marginTop: 8 }}>
                                {campaignDetails.template?.content}
                            </div>
                        </div>
                        <Divider />
                        <Title level={5}>{t('marketing.campaigns.recipient_list', { count: campaignDetails.totalRecipients })}</Title>
                        <Alert 
                            message={t('marketing.campaigns.instructions_title')}
                            description={t('marketing.campaigns.instructions_desc')}
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
