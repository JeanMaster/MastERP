import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, message, Space, Skeleton, Switch, Divider, Alert } from 'antd';
import { UploadOutlined, BankOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companySettingsApi } from '../../services/companySettingsApi';

// Sub-componente que contiene el formulario y useForm
// Se renderiza SOLO cuando los settings ya están cargados para evitar el warning de useForm
const CompanySettingsForm = ({ settings, onSubmit, isUpdating }: { settings: any, onSubmit: (values: any, logoUrl: string) => void, isUpdating: boolean }) => {
    const [form] = Form.useForm();
    const [logoUrl, setLogoUrl] = useState<string>('');

    useEffect(() => {
        if (settings) {
            form.setFieldsValue({
                name: settings.name,
                rif: settings.rif,
                requireBankAccountForPayments: settings.requireBankAccountForPayments ?? true,
            });
            if (settings.logoUrl) {
                setLogoUrl(settings.logoUrl);
            }
        }
    }, [settings, form]);

    const handleLogoChange = (info: any) => {
        const file = info.file.originFileObj || info.file;
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                setLogoUrl(result);
                message.success('Logo cargado. Guarda los cambios para aplicar.');
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={(values) => onSubmit(values, logoUrl)}
            style={{ maxWidth: 600 }}
        >
            <Form.Item
                label="Nombre de la Empresa"
                name="name"
                rules={[{ required: true, message: 'El nombre es requerido' }]}
            >
                <Input placeholder="MastERP" size="large" />
            </Form.Item>

            <Form.Item
                label="RIF / ID"
                name="rif"
                rules={[{ required: true, message: 'El RIF es requerido' }]}
            >
                <Input placeholder="J-12345678-9" size="large" />
            </Form.Item>

            <Form.Item label="Logo de la Empresa">
                <Space direction="vertical" style={{ width: '100%' }}>
                    {logoUrl && (
                        <div style={{
                            border: '1px solid #d9d9d9',
                            borderRadius: 8,
                            padding: 16,
                            textAlign: 'center',
                            background: '#fafafa',
                        }}>
                            <img
                                src={logoUrl}
                                alt="Logo"
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    objectFit: 'contain',
                                    borderRadius: '50%',
                                    border: '3px solid #1890ff',
                                }}
                            />
                        </div>
                    )}
                    <Upload
                        accept="image/*"
                        maxCount={1}
                        beforeUpload={() => false}
                        onChange={handleLogoChange}
                        showUploadList={false}
                    >
                        <Button icon={<UploadOutlined />} size="large">
                            {logoUrl ? 'Cambiar Logo' : 'Subir Logo'}
                        </Button>
                    </Upload>
                    <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                        Recomendado: Imagen cuadrada para mejor visualización circular
                    </span>
                </Space>
            </Form.Item>

            <Divider>Rigurosidad Contable</Divider>

            <Form.Item
                name="requireBankAccountForPayments"
                valuePropName="checked"
                style={{ marginBottom: 24 }}
            >
                <Switch
                    checkedChildren="Estricto"
                    unCheckedChildren="Opcional"
                />
            </Form.Item>
            
            <Alert 
                type="info" 
                showIcon 
                icon={<BankOutlined />}
                style={{ marginBottom: 24 }}
                message="Cuenta Bancaria Obligatoria" 
                description="Si activas esto, obligarás al personal a seleccionar de qué banco o caja sale el dinero al registrar Gastos o pagarle a Proveedores." 
            />

            <Form.Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={isUpdating}
                >
                    Guardar Cambios
                </Button>
            </Form.Item>
        </Form>
    );
};

export const CompanySettingsPage = () => {
    const queryClient = useQueryClient();

    // Fetch settings
    const { data: settings, isLoading } = useQuery({
        queryKey: ['company-settings'],
        queryFn: companySettingsApi.getSettings,
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: companySettingsApi.updateSettings,
        onSuccess: () => {
            message.success('Configuración actualizada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['company-settings'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al actualizar configuración');
        },
    });

    const handleSubmit = (values: any, logoUrl: string) => {
        updateMutation.mutate({
            ...values,
            logoUrl: logoUrl || undefined,
        });
    };

    return (
        <Card title="Datos de Empresa">
            {isLoading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
            ) : (
                <CompanySettingsForm
                    settings={settings}
                    onSubmit={handleSubmit}
                    isUpdating={updateMutation.isPending}
                />
            )}
        </Card>
    );
};
