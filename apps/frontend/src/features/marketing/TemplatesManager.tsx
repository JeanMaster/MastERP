import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Space, message, Popconfirm } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { PlusOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { TextArea } = Input;

export const TemplatesManager = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const { data: templates, isLoading } = useQuery({
        queryKey: ['marketing-templates'],
        queryFn: marketingApi.getTemplates,
    });

    const createMutation = useMutation({
        mutationFn: marketingApi.createTemplate,
        onSuccess: () => {
            message.success('Plantilla creada con éxito');
            queryClient.invalidateQueries({ queryKey: ['marketing-templates'] });
            setIsModalVisible(false);
            form.resetFields();
        },
        onError: () => {
            message.error('Error al crear plantilla');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: marketingApi.deleteTemplate,
        onSuccess: () => {
            message.success('Plantilla eliminada');
            queryClient.invalidateQueries({ queryKey: ['marketing-templates'] });
        },
        onError: () => {
            message.error('Error al eliminar plantilla');
        }
    });

    // F9 Keyboard Shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isModalVisible) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                handleCreate();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isModalVisible, form]);

    const handleCreate = async () => {
        try {
            const values = await form.validateFields();
            createMutation.mutate(values);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const columns = [
        { 
            title: 'Nombre', 
            dataIndex: 'name', 
            key: 'name',
            render: (text: string) => <strong>{text}</strong>
        },
        { 
            title: 'Categoría', 
            dataIndex: 'category', 
            key: 'category',
            render: (cat: string) => <Tag color="blue">{cat}</Tag>
        },
        { 
            title: 'Contenido', 
            dataIndex: 'content', 
            key: 'content',
            ellipsis: true,
            render: (text: string) => <span style={{ color: '#666' }}>{text}</span>
        },
        { 
            title: 'Fecha Creación', 
            dataIndex: 'createdAt', 
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY')
        },
        {
            title: 'Acciones',
            key: 'actions',
            render: (_: any, record: any) => (
                <Space>
                    <Popconfirm
                        title="¿Eliminar esta plantilla?"
                        description="Esta acción no se puede deshacer. Las campañas pasadas no se verán afectadas."
                        onConfirm={() => deleteMutation.mutate(record.id)}
                        okText="Sí, eliminar"
                        cancelText="Cancelar"
                    >
                        <Button danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2><FileTextOutlined /> Plantillas de Mensajes</h2>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalVisible(true)}
                >
                    Nueva Plantilla
                </Button>
            </div>

            <Card bordered={false}>
                <Table 
                    columns={columns} 
                    dataSource={templates} 
                    loading={isLoading}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title="Crear Nueva Plantilla"
                open={isModalVisible}
                onOk={handleCreate}
                onCancel={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                }}
                confirmLoading={createMutation.isPending}
                okText="Crear (F9)"
                width={600}
            >
                <Form form={form} layout="vertical">
                    <Form.Item 
                        name="name" 
                        label="Nombre de la Plantilla"
                        rules={[{ required: true, message: 'Ingrese un nombre descriptivo' }]}
                    >
                        <Input placeholder="Ej: Invitación Oferta VIP" />
                    </Form.Item>
                    
                    <Form.Item 
                        name="category" 
                        label="Categoría"
                        initialValue="PROMOTIONAL"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value="PROMOTIONAL">Promocional</Select.Option>
                            <Select.Option value="INFO">Informativa</Select.Option>
                            <Select.Option value="BIRTHDAY">Cumpleaños</Select.Option>
                            <Select.Option value="RETENTION">Retención / Reactivación</Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item 
                        name="content" 
                        label="Mensaje (WhatsApp)"
                        rules={[{ required: true, message: 'El mensaje no puede estar vacío' }]}
                        tooltip="Puedes usar las variables {nombre}, {tier} y {puntos}"
                    >
                        <TextArea 
                            rows={5} 
                            placeholder="¡Hola {nombre}! Como eres cliente {tier}, te regalamos..."
                        />
                    </Form.Item>
                    
                    <div style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px', fontSize: '12px' }}>
                        <strong>Variables disponibles:</strong>
                        <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }}>
                            <li><code>{'{nombre}'}</code>: Nombre del cliente</li>
                            <li><code>{'{tier}'}</code>: Nivel de cliente (VIP, Oro, Plata, Bronce)</li>
                            <li><code>{'{puntos}'}</code>: Puntos de fidelidad acumulados</li>
                        </ul>
                    </div>
                </Form>
            </Modal>
        </div>
    );
};
