import { useEffect } from 'react';
import { Card, Form, InputNumber, Button, Divider, Alert, Row, Col, Typography, App } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { SaveOutlined, TrophyOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

/**
 * MarketingSettings Component
 * Configuration interface for customer segmentation logic and loyalty program mechanics.
 * Defines spending thresholds for VIP/Gold/Silver tiers and point-to-currency conversion rates.
 */
export const MarketingSettings = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data: config, isLoading } = useQuery({
        queryKey: ['marketing-config'],
        queryFn: marketingApi.getConfig,
    });

    /**
     * Updates the global marketing and loyalty parameters.
     */
    const mutation = useMutation({
        mutationFn: marketingApi.updateConfig,
        onSuccess: () => {
            message.success(t('marketing.success_update'));
            queryClient.invalidateQueries({ queryKey: ['marketing-config'] });
            queryClient.invalidateQueries({ queryKey: ['marketing-stats'] });
        },
        onError: () => {
            message.error(t('marketing.error_update'));
        }
    });

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            mutation.mutate(values);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    // F9 Keyboard Shortcut for quick save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isLoading) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isLoading, form]);

    if (isLoading) return <Card loading style={{ margin: 24 }} />;

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}><SettingOutlined /> Marketing & Loyalty Configuration</Title>
                <Text type="secondary">Define how the system segments your audience and rewards customer loyalty.</Text>
            </div>

            <Alert 
                message="Customer Segmentation Thresholds" 
                description="Set the minimum cumulative spend (in USD equivalent) required for each loyalty tier. These values dynamically update the Marketing Dashboard analytics."
                type="info"
                showIcon
                style={{ marginBottom: '24px', borderRadius: '8px' }}
            />
            
            <Card bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={config}
                    onFinish={handleSubmit}
                >
                    <Row gutter={24}>
                        <Col span={12}>
                            <Form.Item 
                                label={t('marketing.vip_threshold')} 
                                name="tierVipThreshold"
                                tooltip={t('marketing.vip_tooltip')}
                            >
                                <InputNumber style={{ width: '100%' }} prefix="$" min={0} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item 
                                label={t('marketing.gold_threshold')} 
                                name="tierGoldThreshold"
                            >
                                <InputNumber style={{ width: '100%' }} prefix="$" min={0} size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={24}>
                        <Col span={12}>
                            <Form.Item 
                                label={t('marketing.silver_threshold')} 
                                name="tierSilverThreshold"
                            >
                                <InputNumber style={{ width: '100%' }} prefix="$" min={0} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item 
                                label={t('marketing.churn_days')} 
                                name="churnDays"
                                tooltip={t('marketing.churn_tooltip')}
                            >
                                <InputNumber style={{ width: '100%' }} suffix={t('common.days', { defaultValue: 'days' })} min={1} size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation={"left" as any}><TrophyOutlined style={{ color: '#faad14' }} /> {t('marketing.loyalty_divider')}</Divider>
                    
                    <Row gutter={24}>
                        <Col span={8}>
                            <Form.Item 
                                label={t('marketing.earning_rate')} 
                                name="pointsPerUSD"
                                tooltip={t('marketing.earning_tooltip')}
                            >
                                <InputNumber style={{ width: '100%' }} min={0} step={0.1} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item 
                                label={t('marketing.point_value')} 
                                name="valuePerPoint"
                                tooltip={t('marketing.point_value_tooltip')}
                            >
                                <InputNumber style={{ width: '100%' }} min={0} step={0.001} precision={4} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item 
                                label={t('marketing.max_redemption')} 
                                name="maxRedemptionPercentage"
                                tooltip={t('marketing.max_redemption_tooltip')}
                            >
                                <InputNumber style={{ width: '100%' }} min={1} max={100} suffix="%" size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={24} style={{ marginTop: 16 }}>
                        <Col span={24}>
                            <Alert
                                message={t('marketing.mechanics_alert')}
                                description={t('marketing.mechanics_desc')}
                                type="success"
                                showIcon
                                style={{ borderRadius: '8px' }}
                            />
                        </Col>
                    </Row>

                    <Divider />
                    
                    <div style={{ textAlign: 'right' }}>
                        <Button 
                            type="primary" 
                            size="large"
                            icon={<SaveOutlined />} 
                            loading={mutation.isPending}
                            onClick={handleSubmit}
                            style={{ height: 50, padding: '0 40px', borderRadius: '8px' }}
                        >
                            {t('marketing.save_button')}
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
};
