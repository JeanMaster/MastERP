import { useEffect } from 'react';
import { Card, Form, InputNumber, Button, message, Space, Divider, Alert, Row, Col } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { SaveOutlined, TrophyOutlined } from '@ant-design/icons';

export const MarketingSettings = () => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data: config, isLoading } = useQuery({
        queryKey: ['marketing-config'],
        queryFn: marketingApi.getConfig,
    });

    const mutation = useMutation({
        mutationFn: marketingApi.updateConfig,
        onSuccess: () => {
            message.success('Configuración de Marketing actualizada');
            queryClient.invalidateQueries({ queryKey: ['marketing-config'] });
            queryClient.invalidateQueries({ queryKey: ['marketing-stats'] });
        },
        onError: () => {
            message.error('Error al actualizar la configuración');
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

    // F9 Keyboard Shortcut
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

    if (isLoading) return <Card loading />;

    return (
        <div style={{ padding: '24px' }}>
            <h2>Configuración de MarketingP</h2>
            <Alert 
                message="Umbrales de Segmentación" 
                description="Define el gasto total acumulado (en USD) requerido para que un cliente pertenezca a cada nivel. Esto afecta automáticamente los gráficos del Panel de Control."
                type="info"
                showIcon
                style={{ marginBottom: '20px' }}
            />
            
            <Card bordered={false}>
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={config}
                    onFinish={handleSubmit}
                >
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item 
                                label="Umbral VIP (Diamante) - USD" 
                                name="tierVipThreshold"
                                tooltip="Gasto mínimo acumulado para ser VIP"
                            >
                                <InputNumber style={{ width: '100%' }} prefix="$" min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item 
                                label="Umbral Gold (Oro) - USD" 
                                name="tierGoldThreshold"
                            >
                                <InputNumber style={{ width: '100%' }} prefix="$" min={0} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item 
                                label="Umbral Silver (Plata) - USD" 
                                name="tierSilverThreshold"
                            >
                                <InputNumber style={{ width: '100%' }} prefix="$" min={0} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item 
                                label="Días para Inactividad (Churn)" 
                                name="churnDays"
                                tooltip="Días transcurridos desde la última compra para considerar al cliente 'Inactivo'"
                            >
                                <InputNumber style={{ width: '100%' }} suffix="días" min={1} />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider><TrophyOutlined /> Programa de Fidelidad (Puntos)</Divider>
                    

                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item 
                                label="Puntos por cada $1 gastado" 
                                name="pointsPerUSD"
                                tooltip="Ganas puntos al comprar. Ej: 1 = Ganas 1 punto por cada $1 gastado"
                            >
                                <InputNumber style={{ width: '100%' }} min={0} step={0.5} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item 
                                label="Valor de punto (en USD)" 
                                name="valuePerPoint"
                                tooltip="Cuánto vale cada punto al canjear"
                            >
                                <InputNumber style={{ width: '100%' }} min={0} step={0.001} precision={4} />
                            </Form.Item>
                        </Col>
                        <Col span={8}>
                            <Form.Item 
                                label="Máx. Canje por Venta (%)" 
                                name="maxRedemptionPercentage"
                                tooltip="Porcentaje máximo del total de la venta que se puede pagar con puntos"
                            >
                                <InputNumber style={{ width: '100%' }} min={1} max={100} suffix="%" />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Row gutter={16} style={{ marginTop: 8 }}>
                        <Col span={24}>
                            <Alert
                                message="Dinámica del Programa"
                                description="Los puntos se acumulan automáticamente en cada venta. Al cobrar, el cajero puede canjearlos usando el valor configurado aquí."
                                type="success"
                                showIcon
                            />
                        </Col>
                    </Row>

                    <Divider />
                    
                    <Space>
                        <Button 
                            type="primary" 
                            icon={<SaveOutlined />} 
                            loading={mutation.isPending}
                            onClick={handleSubmit}
                        >
                            Guardar Cambios (F9)
                        </Button>
                    </Space>
                </Form>
            </Card>
        </div>
    );
};
