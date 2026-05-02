import { useEffect } from 'react';
import { Card, Form, Button, message, Divider, Row, Col, Typography, InputNumber, Alert, Tooltip, Spin } from 'antd';
import { 
    SettingOutlined, 
    SaveOutlined, 
    InfoCircleOutlined,
    TeamOutlined,
    GiftOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

/**
 * MarketingSettings Component
 * Global configuration for customer loyalty and segmentation.
 * Defines thresholds for VIP tiers, points earning rates, and inactivity (churn) periods.
 */
export const MarketingSettings = () => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data: config, isLoading } = useQuery({
        queryKey: ['marketing-config'],
        queryFn: marketingApi.getConfig,
    });

    // Populate form with existing configuration
    useEffect(() => {
        if (config) {
            form.setFieldsValue(config);
        }
    }, [config, form]);

    /**
     * Persists updated configuration to the backend.
     */
    const updateMutation = useMutation({
        mutationFn: marketingApi.updateConfig,
        onSuccess: () => {
            message.success(t('marketing.success_update'));
            queryClient.invalidateQueries({ queryKey: ['marketing-config'] });
        },
        onError: () => {
            message.error(t('marketing.error_update'));
        }
    });

    const onFinish = (values: any) => {
        updateMutation.mutate(values);
    };

    if (isLoading) return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
                <Title level={2}><SettingOutlined /> {t('marketing.title')}</Title>
                <Text type="secondary">{t('marketing.subtitle')}</Text>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                disabled={updateMutation.isPending}
            >
                <Card bordered={false} style={{ marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <Title level={4}><TeamOutlined /> {t('marketing.segmentation_alert')}</Title>
                    <Paragraph type="secondary">
                        {t('marketing.segmentation_desc')}
                    </Paragraph>
                    <Divider />
                    
                    <Row gutter={24}>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                name="tierVipThreshold" 
                                label={<span>{t('marketing.vip_threshold')} <Tooltip title={t('marketing.vip_tooltip')}><InfoCircleOutlined /></Tooltip></span>}
                            >
                                <InputNumber style={{ width: '100%' }} min={0} prefix="$" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="tierGoldThreshold" label={t('marketing.gold_threshold')}>
                                <InputNumber style={{ width: '100%' }} min={0} prefix="$" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item name="tierSilverThreshold" label={t('marketing.silver_threshold')}>
                                <InputNumber style={{ width: '100%' }} min={0} prefix="$" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                name="churnDays" 
                                label={<span>{t('marketing.churn_days')} <Tooltip title={t('marketing.churn_tooltip')}><InfoCircleOutlined /></Tooltip></span>}
                            >
                                <InputNumber style={{ width: '100%' }} min={1} />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Card bordered={false} style={{ marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <Title level={4}><GiftOutlined /> {t('marketing.loyalty_divider')}</Title>
                    <Row gutter={24}>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                name="pointsPerUSD" 
                                label={<span>{t('marketing.earning_rate')} <Tooltip title={t('marketing.earning_tooltip')}><InfoCircleOutlined /></Tooltip></span>}
                            >
                                <InputNumber style={{ width: '100%' }} min={0} />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                name="valuePerPoint" 
                                label={<span>{t('marketing.point_value')} <Tooltip title={t('marketing.point_value_tooltip')}><InfoCircleOutlined /></Tooltip></span>}
                            >
                                <InputNumber style={{ width: '100%' }} min={0} step={0.01} prefix="$" />
                            </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                            <Form.Item 
                                name="maxRedemptionPercentage" 
                                label={<span>{t('marketing.max_redemption')} <Tooltip title={t('marketing.max_redemption_tooltip')}><InfoCircleOutlined /></Tooltip></span>}
                            >
                                <InputNumber style={{ width: '100%' }} min={0} max={100} suffix="%" />
                            </Form.Item>
                        </Col>
                    </Row>
                    
                    <Alert
                        message={t('marketing.mechanics_alert')}
                        description={t('marketing.mechanics_desc')}
                        type="info"
                        showIcon
                        style={{ marginTop: 16 }}
                    />
                </Card>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 40 }}>
                    <Button 
                        type="primary" 
                        size="large" 
                        icon={<SaveOutlined />} 
                        htmlType="submit"
                        loading={updateMutation.isPending}
                    >
                        {t('marketing.save_button')}
                    </Button>
                </div>
            </Form>
        </div>
    );
};
