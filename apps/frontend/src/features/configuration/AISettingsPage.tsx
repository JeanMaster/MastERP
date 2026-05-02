import { Card, Form, Input, Button, message, Space, Divider, Alert, Row, Col, Switch, Typography } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { aiApi } from '../../services/aiApi';
import { SaveOutlined, RobotOutlined, KeyOutlined, SettingOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

/**
 * AISettingsPage Component
 * Configuration portal for Artificial Intelligence providers (e.g., Google Gemini).
 * These settings empower the system's intelligent features like the Social Hub assistant, financial forecasting, and smart inventory analysis.
 */
export const AISettingsPage = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [form] = Form.useForm();

    const { data: config, isLoading } = useQuery({
        queryKey: ['ai-config'],
        queryFn: aiApi.getConfig
    });

    /**
     * Updates the global AI configuration.
     */
    const updateMutation = useMutation({
        mutationFn: aiApi.updateConfig,
        onSuccess: () => {
            message.success(t('config.ai.success_update'));
            queryClient.invalidateQueries({ queryKey: ['ai-config'] });
        },
        onError: (err: any) => {
            message.error(err?.response?.data?.message || t('config.ai.error_update'));
        }
    });

    const onFinish = (values: any) => {
        updateMutation.mutate(values);
    };

    if (isLoading) return <Card loading title={t('config.ai.loading')} style={{ margin: 24 }} />;

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
                <Title level={2} style={{ margin: 0 }}><RobotOutlined /> {t('config.ai.title')}</Title>
                <Paragraph type="secondary">
                    {t('config.ai.subtitle')}
                </Paragraph>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                initialValues={config}
            >
                <Row gutter={24}>
                    <Col span={24}>
                        <Card 
                            title={<Space><RobotOutlined style={{ color: '#722ed1' }} /> {config?.provider?.toUpperCase() || 'GEMINI'}</Space>}
                            bordered={false}
                            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: '12px' }}
                        >
                            <Row gutter={24}>
                                <Col xs={24} md={16}>
                                    <Alert
                                        message={t('config.ai.gemini_config')}
                                        description={
                                            <div style={{ marginTop: '8px' }}>
                                                {t('config.ai.gemini_desc')}
                                                <div style={{ marginTop: '12px' }}>
                                                    <Button size="small" type="primary" href="https://aistudio.google.com/app/apikey" target="_blank">
                                                        {t('config.ai.get_api_key')}
                                                    </Button>
                                                </div>
                                            </div>
                                        }
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: '24px', borderRadius: '8px' }}
                                    />

                                    <Form.Item
                                        label={t('config.ai.api_key_label')}
                                        name="apiKey"
                                        tooltip={t('config.ai.api_key_tooltip')}
                                        rules={[{ required: true, message: t('config.ai.api_key_required') }]}
                                    >
                                        <Input.Password 
                                            prefix={<KeyOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} 
                                            placeholder="AIza..." 
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        label={t('config.ai.model_label')}
                                        name="modelName"
                                        initialValue="gemini-1.5-flash"
                                        tooltip={t('config.ai.model_tooltip')}
                                    >
                                        <Input 
                                            prefix={<SettingOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} 
                                            placeholder="gemini-1.5-flash" 
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Form.Item name="isActive" valuePropName="checked">
                                        <Space size={12}>
                                            <Switch defaultChecked />
                                            <Text strong>{t('config.ai.enable_provider')}</Text>
                                        </Space>
                                    </Form.Item>
                                </Col>
                                
                                <Col xs={24} md={8}>
                                    <div style={{ background: '#f8f9fa', padding: '24px', borderRadius: '12px', height: '100%', border: '1px solid #eee' }}>
                                        <Title level={5}>{t('config.ai.powered_features')}</Title>
                                        <Paragraph style={{ fontSize: '13px' }}>
                                            {t('config.ai.unlock_msg')}
                                        </Paragraph>
                                        <ul style={{ fontSize: '13px', paddingLeft: '20px', color: '#555' }}>
                                            <li>{t('config.ai.feature_marketing')}</li>
                                            <li>{t('config.ai.feature_finance')}</li>
                                            <li>{t('config.ai.feature_chat')}</li>
                                            <li>{t('config.ai.feature_inventory')}</li>
                                        </ul>
                                        <Divider />
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            {t('config.ai.future_support')}
                                        </Text>
                                    </div>
                                </Col>
                            </Row>
                        </Card>
                    </Col>
                </Row>

                <div style={{ marginTop: 32, textAlign: 'right' }}>
                    <Button 
                        type="primary" 
                        size="large" 
                        icon={<SaveOutlined />} 
                        loading={updateMutation.isPending}
                        htmlType="submit"
                        style={{ height: '50px', padding: '0 40px', borderRadius: '25px', fontWeight: 'bold' }}
                    >
                        {t('config.ai.save_button')}
                    </Button>
                </div>
            </Form>
        </div>
    );
};
