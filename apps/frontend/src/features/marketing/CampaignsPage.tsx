import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Progress, Divider, Typography } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { RocketOutlined, PlusOutlined, WhatsAppOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

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

    const createMutation = useMutation({
        mutationFn: marketingApi.createCampaign,
        onSuccess: () => {
            message.success('Campaña creada. Lista de destinatarios generada.');
            queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
            setIsCreateModalVisible(false);
            form.resetFields();
        },
        onError: (err: any) => {
            message.error(err?.response?.data?.message || 'Error al crear la campaña');
        }
    });

    const markSentMutation = useMutation({
        mutationFn: marketingApi.markRecipientSent,
        onSuccess: () => {
            message.success('Destinatario marcado como enviado');
            queryClient.invalidateQueries({ queryKey: ['marketing-campaign-details', viewCampaignId] });
            queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
        }
    });

    // F9 Keyboard Shortcut
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

    const handleWhatsAppClick = (phone: string, text: string) => {
        // Same phone formatting as InvoiceModal (POS)
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
            title: 'Nombre de Campaña', 
            dataIndex: 'name', 
            key: 'name',
            render: (text: string) => <strong>{text}</strong>
        },
        { 
            title: 'Segmento', 
            dataIndex: 'targetSegment', 
            key: 'targetSegment',
            render: (seg: string) => <Tag color="blue">{seg}</Tag>
        },
        { 
            title: 'Plantilla', 
            key: 'template',
            render: (_: any, record: any) => record.template?.name || 'N/A'
        },
        {
            title: 'Progreso de Envío',
            key: 'progress',
            render: (_: any, record: any) => {
                const percent = record.totalRecipients > 0 ? Math.round((record.sentCount / record.totalRecipients) * 100) : 0;
                return (
                    <div style={{ width: 150 }}>
                        <Progress percent={percent} size="small" status={percent === 100 ? 'success' : 'active'} />
                        <div style={{ fontSize: '11px', textAlign: 'center' }}>
                            {record.sentCount} / {record.totalRecipients} enviados
                        </div>
                    </div>
                );
            }
        },
        { 
            title: 'Estado', 
            dataIndex: 'status', 
            key: 'status',
            render: (status: string) => (
                <Tag color={status === 'COMPLETED' ? 'success' : status === 'PENDING' ? 'processing' : 'default'}>
                    {status}
                </Tag>
            )
        },
        { 
            title: 'Fecha', 
            dataIndex: 'createdAt', 
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm')
        },
        {
            title: 'Acciones',
            key: 'actions',
            render: (_: any, record: any) => (
                <Button 
                    type="primary" 
                    ghost 
                    size="small"
                    onClick={() => setViewCampaignId(record.id)}
                >
                    Ver / Enviar
                </Button>
            )
        }
    ];

    const recipientColumns = [
        { title: 'Cliente', dataIndex: 'clientName', key: 'clientName' },
        { title: 'Teléfono', dataIndex: 'clientPhone', key: 'clientPhone' },
        { 
            title: 'Estado', 
            dataIndex: 'status', 
            key: 'status',
            render: (s: string) => s === 'SENT' ? <Tag color="green">Enviado</Tag> : <Tag color="orange">Pendiente</Tag>
        },
        {
            title: 'Acción de Envío',
            key: 'action',
            render: (_: any, record: any) => (
                <Space>
                    <Button 
                        type="primary" 
                        style={{ backgroundColor: '#25D366' }} 
                        icon={<WhatsAppOutlined />}
                        onClick={() => handleWhatsAppClick(record.clientPhone, record.message)}
                    >
                        Abrir WS Web
                    </Button>
                    <Button 
                        type={record.status === 'SENT' ? 'default' : 'primary'}
                        icon={<CheckCircleOutlined />}
                        disabled={record.status === 'SENT' || markSentMutation.isPending}
                        onClick={() => markSentMutation.mutate(record.id)}
                    >
                        {record.status === 'SENT' ? 'Enviado' : 'Marcar Listo'}
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2><RocketOutlined /> Campañas Masivas</h2>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setIsCreateModalVisible(true)}
                >
                    Nueva Campaña
                </Button>
            </div>

            <Card bordered={false}>
                <Table 
                    columns={columns} 
                    dataSource={campaigns} 
                    loading={loadingCampaigns}
                    rowKey="id"
                />
            </Card>

            {/* CREATE CAMPAIGN WIZARD/MODAL */}
            <Modal
                title="Lanzar Nueva Campaña"
                open={isCreateModalVisible}
                onOk={handleCreate}
                onCancel={() => setIsCreateModalVisible(false)}
                confirmLoading={createMutation.isPending}
                okText="Lanzar Campaña (F9)"
            >
                <Form form={form} layout="vertical">
                    <Form.Item 
                        name="name" 
                        label="Nombre Interno de la Campaña"
                        rules={[{ required: true }]}
                    >
                        <Input placeholder="Ej: Black Friday 2026 VIP" />
                    </Form.Item>

                    <Form.Item 
                        name="templateId" 
                        label="Plantilla de Mensaje a Utilizar"
                        rules={[{ required: true }]}
                    >
                        <Select placeholder="Seleccione una plantilla">
                            {templates?.map((t: any) => (
                                <Select.Option key={t.id} value={t.id}>{t.name}</Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item 
                        name="targetSegment" 
                        label="Segmento Destino"
                        rules={[{ required: true }]}
                        extra="El sistema automáticamente reemplazará las variables de la plantilla para estos clientes."
                    >
                        <Select>
                            <Select.Option value="ALL">Todos los clientes registrados</Select.Option>
                            <Select.Option value="VIP">Solo clientes VIP (Diamante)</Select.Option>
                            <Select.Option value="GOLD">Solo clientes Oro</Select.Option>
                            <Select.Option value="CHURN">Clientes en Riesgo (Inactivos/Churn)</Select.Option>
                            <Select.Option value="BIRTHDAY">Cumpleañeros del mes actual</Select.Option>
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            {/* CAMPAIGN DETAILS / EXECUTION MODAL */}
            <Modal
                title={`Ejecución de Campaña: ${campaignDetails?.name || ''}`}
                open={!!viewCampaignId}
                onCancel={() => setViewCampaignId(null)}
                footer={[
                    <Button key="close" onClick={() => setViewCampaignId(null)}>
                        Cerrar Monitor
                    </Button>
                ]}
                width={800}
            >
                {loadingDetails ? (
                    <Card loading />
                ) : campaignDetails ? (
                    <div>
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>Mensaje Original:</Text>
                            <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '4px', whiteSpace: 'pre-wrap', marginTop: 8 }}>
                                {campaignDetails.template?.content}
                            </div>
                        </div>
                        <Divider />
                        <Title level={5}>Lista de Destinatarios ({campaignDetails.totalRecipients})</Title>
                        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                            Instrucciones: Haz clic en "Abrir WS Web" para abrir el chat con el mensaje pre-cargado. Luego de enviar, haz clic en "Marcar Listo" para llevar el control.
                        </Text>
                        <Table 
                            columns={recipientColumns} 
                            dataSource={campaignDetails.recipients}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 10 }}
                        />
                    </div>
                ) : null}
            </Modal>
        </div>
    );
};

