import { Card, Form, Input, Button, message, Space, Divider, Alert, Row, Col, Switch, Typography } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../../services/aiApi';
import { SaveOutlined, RobotOutlined, KeyOutlined, SettingOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

/**
 * AISettingsPage Component
 * Configuration portal for Artificial Intelligence providers (e.g., Google Gemini).
 * These settings empower the system's intelligent features like the Social Hub assistant, financial forecasting, and smart inventory analysis.
 */
export const AISettingsPage = () => {
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
            message.success('AI Configuration updated successfully');
            queryClient.invalidateQueries({ queryKey: ['ai-config'] });
        },
        onError: (err: any) => {
            message.error(err?.response?.data?.message || 'Error updating AI settings');
        }
    });

    const onFinish = (values: any) => {
        updateMutation.mutate(values);
    };

    if (isLoading) return <Card loading title="Loading AI settings..." style={{ margin: 24 }} />;

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
                <Title level={2} style={{ margin: 0 }}><RobotOutlined /> Artificial Intelligence Hub</Title>
                <Paragraph type="secondary">
                    Configure the AI providers that power MastERP's intelligent features. These credentials are used for financial forecasting, 
                    marketing copy generation, and real-time business insights.
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
                                        message="Google Gemini Configuration"
                                        description={
                                            <div style={{ marginTop: '8px' }}>
                                                Gemini is the primary engine driving the Social Hub and Business Intelligence modules.
                                                <div style={{ marginTop: '12px' }}>
                                                    <Button size="small" type="primary" href="https://aistudio.google.com/app/apikey" target="_blank">
                                                        Get Free API Key at Google AI Studio
                                                    </Button>
                                                </div>
                                            </div>
                                        }
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: '24px', borderRadius: '8px' }}
                                    />

                                    <Form.Item
                                        label="API Key"
                                        name="apiKey"
                                        tooltip="Your private Google AI Studio key. Keep this secure."
                                        rules={[{ required: true, message: 'API Key is required to enable AI features' }]}
                                    >
                                        <Input.Password 
                                            prefix={<KeyOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} 
                                            placeholder="AIza..." 
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        label="AI Model"
                                        name="modelName"
                                        initialValue="gemini-1.5-flash"
                                        tooltip="We recommend gemini-1.5-flash for its optimal balance of speed, performance, and low cost."
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
                                            <Text strong>Enable this provider across the system</Text>
                                        </Space>
                                    </Form.Item>
                                </Col>
                                
                                <Col xs={24} md={8}>
                                    <div style={{ background: '#f8f9fa', padding: '24px', borderRadius: '12px', height: '100%', border: '1px solid #eee' }}>
                                        <Title level={5}>Powered Features</Title>
                                        <Paragraph style={{ fontSize: '13px' }}>
                                            Once configured, you will unlock:
                                        </Paragraph>
                                        <ul style={{ fontSize: '13px', paddingLeft: '20px', color: '#555' }}>
                                            <li>Real-time Marketing Social Assistant</li>
                                            <li>Smart Financial Trend Reports</li>
                                            <li>Interactive Data Exploration Chat</li>
                                            <li>Automated Inventory Recommendations</li>
                                        </ul>
                                        <Divider />
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            Future support for OpenAI (GPT-4o) and Meta Llama 3 is coming soon.
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
                        Save AI Configuration
                    </Button>
                </div>
            </Form>
        </div>
    );
};
