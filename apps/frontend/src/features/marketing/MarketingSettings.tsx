import { useEffect } from 'react';
import { Card, Form, InputNumber, Button, message, Divider, Alert, Row, Col, Typography } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { SaveOutlined, TrophyOutlined, SettingOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * MarketingSettings Component
 * Configuration interface for customer segmentation logic and loyalty program mechanics.
 * Defines spending thresholds for VIP/Gold/Silver tiers and point-to-currency conversion rates.
 */
export const MarketingSettings = () => {
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
            message.success('Marketing and Loyalty configuration updated');
            queryClient.invalidateQueries({ queryKey: ['marketing-config'] });
            queryClient.invalidateQueries({ queryKey: ['marketing-stats'] });
        },
        onError: () => {
            message.error('Failed to update configuration');
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
                                label="VIP (Diamond) Threshold - USD" 
                                name="tierVipThreshold"
                                tooltip="Minimum lifetime spend to reach Diamond status"
                            >
                                <InputNumber style={{ width: '100%' }} prefix="$" min={0} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item 
                                label="Gold Tier Threshold - USD" 
                                name="tierGoldThreshold"
                            >
                                <InputNumber style={{ width: '100%' }} prefix="$" min={0} size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={24}>
                        <Col span={12}>
                            <Form.Item 
                                label="Silver Tier Threshold - USD" 
                                name="tierSilverThreshold"
                            >
                                <InputNumber style={{ width: '100%' }} prefix="$" min={0} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item 
                                label="Inactivity Period (Churn) - Days" 
                                name="churnDays"
                                tooltip="Days without a purchase before a customer is flagged as 'Inactive' or at risk of churn."
                            >
                                <InputNumber style={{ width: '100%' }} suffix="days" min={1} size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation={"left" as any}><TrophyOutlined style={{ color: '#faad14' }} /> Loyalty Rewards Program (Points)</Divider>
                    
                    <Row gutter={24}>
                        <Col span={8}>
                            <Form.Item 
                                label="Earning Rate (Points per $1)" 
                                name="pointsPerUSD"
                                tooltip="The amount of points a customer earns for every $1 spent (or local currency equivalent)."
                            >
                                <InputNumber style={{ width: '100%' }} min={0} step={0.1} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item 
                                label="Point Value (in USD)" 
                                name="valuePerPoint"
                                tooltip="The monetary value of a single point when redeemed at checkout."
                            >
                                <InputNumber style={{ width: '100%' }} min={0} step={0.001} precision={4} size="large" />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item 
                                label="Max Redemption Limit (%)" 
                                name="maxRedemptionPercentage"
                                tooltip="Maximum percentage of the transaction total that can be paid using points."
                            >
                                <InputNumber style={{ width: '100%' }} min={1} max={100} suffix="%" size="large" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={24} style={{ marginTop: 16 }}>
                        <Col span={24}>
                            <Alert
                                message="Loyalty Program Mechanics"
                                description="Points are calculated automatically during each checkout session. Cashiers can apply accumulated points as a payment method based on the conversion values defined above."
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
                            Save Marketing Options (F9)
                        </Button>
                    </div>
                </Form>
            </Card>
        </div>
    );
};
