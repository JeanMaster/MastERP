import { Card, Form, Input, Button, message, Space, Divider, Alert, Row, Col, Switch, Typography } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../../services/aiApi';
import { SaveOutlined, RobotOutlined, KeyOutlined, SettingOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

export const AISettingsPage = () => {
    const queryClient = useQueryClient();
    const [form] = Form.useForm();

    const { data: config, isLoading } = useQuery({
        queryKey: ['ai-config'],
        queryFn: aiApi.getConfig
    });

    const updateMutation = useMutation({
        mutationFn: aiApi.updateConfig,
        onSuccess: () => {
            message.success('Configuración de IA actualizada con éxito');
            queryClient.invalidateQueries({ queryKey: ['ai-config'] });
        },
        onError: (err: any) => {
            message.error(err?.response?.data?.message || 'Error al actualizar la configuración');
        }
    });

    const onFinish = (values: any) => {
        updateMutation.mutate(values);
    };

    if (isLoading) return <Card loading title="Cargando configuración de IA..." />;

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: 24 }}>
                <Title level={2}><RobotOutlined /> Inteligencia Artificial</Title>
                <Paragraph>
                    Configura los proveedores de IA que potenciarán el sistema. Estas llaves se utilizan para generar recomendaciones financieras,
                    copys de marketing y asistencia en tiempo real.
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
                            title={<Space><RobotOutlined /> {config?.provider.toUpperCase() || 'GEMINI'}</Space>}
                            bordered={false}
                            className="premium-card"
                            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: '12px' }}
                        >
                            <Row gutter={24}>
                                <Col xs={24} md={16}>
                                    <Alert
                                        message="Configuración de Gemini (Google)"
                                        description={
                                            <div style={{ marginTop: '8px' }}>
                                                Esta es la IA principal que actualmente impulsa el Social Hub y los Análisis de Negocio.
                                                <div style={{ marginTop: '8px' }}>
                                                    <Button size="small" type="link" href="https://aistudio.google.com/app/apikey" target="_blank" style={{ padding: 0 }}>
                                                        Obtener mi API Key gratuita en Google AI Studio
                                                    </Button>
                                                </div>
                                            </div>
                                        }
                                        type="info"
                                        showIcon
                                        style={{ marginBottom: '24px' }}
                                    />

                                    <Form.Item
                                        label="API Key"
                                        name="apiKey"
                                        tooltip="Tu llave privada de Google AI Studio. No la compartas con nadie."
                                        rules={[{ required: true, message: 'La API Key es obligatoria para activar la IA' }]}
                                    >
                                        <Input.Password 
                                            prefix={<KeyOutlined style={{ color: 'rgba(0,0,0,.25)' }} />} 
                                            placeholder="AIza..." 
                                            size="large"
                                        />
                                    </Form.Item>

                                    <Form.Item
                                        label="Modelo de IA"
                                        name="modelName"
                                        initialValue="gemini-1.5-flash"
                                        tooltip="Recomendamos gemini-1.5-flash por su balance entre velocidad y costo."
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
                                            <Text strong>Activar este proveedor para todo el sistema</Text>
                                        </Space>
                                    </Form.Item>
                                </Col>
                                
                                <Col xs={24} md={8}>
                                    <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', height: '100%' }}>
                                        <Title level={5}>Próximos Pasos</Title>
                                        <Paragraph style={{ fontSize: '13px' }}>
                                            Una vez configurado, podrás disfrutar de:
                                        </Paragraph>
                                        <ul style={{ fontSize: '13px', paddingLeft: '20px' }}>
                                            <li>Asistente de Marketing en tiempo real</li>
                                            <li>Reportes financieros inteligentes</li>
                                            <li>Chat interactivo con tus datos</li>
                                            <li>Recomendaciones de inventario</li>
                                        </ul>
                                        <Divider />
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            Próximamente soporte para OpenAI y Meta Llama.
                                        </Text>
                                    </div>
                                </Col>
                            </Row>
                        </Card>
                    </Col>
                </Row>

                <div style={{ marginTop: 24, textAlign: 'right' }}>
                    <Button 
                        type="primary" 
                        size="large" 
                        icon={<SaveOutlined />} 
                        loading={updateMutation.isPending}
                        htmlType="submit"
                        style={{ height: '48px', padding: '0 40px', borderRadius: '24px' }}
                    >
                        Guardar Configuración de IA
                    </Button>
                </div>
            </Form>
        </div>
    );
};
