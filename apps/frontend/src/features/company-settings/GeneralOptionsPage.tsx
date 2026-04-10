import { useEffect } from 'react';
import { Card, Form, Button, Select, Skeleton, message, Alert, Switch, InputNumber } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companySettingsApi } from '../../services/companySettingsApi';
import { currenciesApi } from '../../services/currenciesApi';

// Sub-componente del formulario
const GeneralOptionsForm = ({ settings, onSubmit, isUpdating }: { settings: any, onSubmit: (values: any) => void, isUpdating: boolean }) => {
    const [form] = Form.useForm();

    const { data: currencies, isLoading: isLoadingCurrencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
    });

    useEffect(() => {
        if (settings) {
            console.log('Settings loaded:', settings);
            form.setFieldsValue({
                preferredSecondaryCurrencyId: settings.preferredSecondaryCurrencyId,
                autoUpdateRates: settings.autoUpdateRates,
                updateFrequency: settings.updateFrequency || 60,
                taxEnabled: settings.taxEnabled,
                taxRate: Number(settings.taxRate) || 16,
                roundingEnabled: settings.roundingEnabled !== undefined ? settings.roundingEnabled : true,
                roundingFactor: settings.roundingFactor || 10,
                igtfEnabled: settings.igtfEnabled !== undefined ? settings.igtfEnabled : false,
                igtfRate: Number(settings.igtfRate) || 3,
                isSpecialTaxpayer: settings.isSpecialTaxpayer !== undefined ? settings.isSpecialTaxpayer : false,
            });
        }
    }, [settings, form]);

    const secondaryCurrencies = currencies?.filter(c => !c.isPrimary && c.active) || [];

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={onSubmit}
            style={{ maxWidth: 600 }}
        >
            <Alert
                message="Configuración de Moneda Secundaria"
                description="Seleccione la moneda secundaria que se utilizará por defecto en el Punto de Venta (POS) para mostrar precios referenciales."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
            />

            <Form.Item
                label="Moneda Secundaria Preferida (POS)"
                name="preferredSecondaryCurrencyId"
                extra="Esta moneda se mostrará junto a la moneda principal en el grid de productos y carrito del POS."
            >
                <Select
                    placeholder="Seleccione una moneda"
                    size="large"
                    loading={isLoadingCurrencies}
                    allowClear
                >
                    {secondaryCurrencies.map(currency => (
                        <Select.Option key={currency.id} value={currency.id}>
                            {currency.name} ({currency.symbol}) - Tasa: {currency.exchangeRate}
                        </Select.Option>
                    ))}
                </Select>
            </Form.Item>

            <Alert
                message="Automatización de Tasas"
                description="Active esta opción para actualizar automáticamente las tasas de cambio de las monedas configuradas (ej. USDT desde Binance P2P)."
                type="warning"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label="Activar Actualización Automática"
                name="autoUpdateRates"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
            >
                <Switch />
            </Form.Item>

            <Form.Item
                label="Frecuencia de Actualización (Minutos)"
                name="updateFrequency"
                rules={[{ required: true, message: 'Ingrese la frecuencia' }]}
            >
                <InputNumber min={5} max={1440} style={{ width: '100%' }} />
            </Form.Item>

            <Alert
                message="Configuración de Impuestos (IVA)"
                description="Active esta opción para habilitar el cálculo de IVA en el Punto de Venta (POS) y Visor de Precios."
                type="success"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label="Activar Cobro de IVA"
                name="taxEnabled"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
            >
                <Switch />
            </Form.Item>

            <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.taxEnabled !== currentValues.taxEnabled}
            >
                {({ getFieldValue }) =>
                    getFieldValue('taxEnabled') ? (
                        <Form.Item
                            label="Tasa de IVA (%)"
                            name="taxRate"
                            rules={[{ required: true, message: 'Ingrese la tasa de IVA' }]}
                        >
                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    ) : null
                }
            </Form.Item>

            <Alert
                message="Configuración de Redondeo de Precios"
                description="Determine si los precios en el POS deben redondearse y por qué factor (ej. redondear a la decena o centena más cercana)."
                type="info"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label="Activar Redondeo de Precios"
                name="roundingEnabled"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
            >
                <Switch />
            </Form.Item>

            <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.roundingEnabled !== currentValues.roundingEnabled}
            >
                {({ getFieldValue }) =>
                    getFieldValue('roundingEnabled') ? (
                        <Form.Item
                            label="Factor de Redondeo (Múltiplo de)"
                            name="roundingFactor"
                            rules={[{ required: true, message: 'Elija el factor de redondeo' }]}
                            extra="El precio final con IVA se redondeará al múltiplo más cercano de este valor (hacia arriba)."
                        >
                            <Select size="large">
                                <Select.Option value={1}>Sin Redondeo (1)</Select.Option>
                                <Select.Option value={5}>Redondeo al 5</Select.Option>
                                <Select.Option value={10}>Redondeo al 10 (Decena)</Select.Option>
                                <Select.Option value={50}>Redondeo al 50</Select.Option>
                                <Select.Option value={100}>Redondeo al 100 (Centena)</Select.Option>
                                <Select.Option value={500}>Redondeo al 500</Select.Option>
                                <Select.Option value={1000}>Redondeo al 1000</Select.Option>
                            </Select>
                        </Form.Item>
                    ) : null
                }
            </Form.Item>

            <Alert
                message="Configuración de IGTF (3%)"
                description="Active esta opción si su empresa es Contribuyente Especial y debe cobrar el 3% por pagos recibidos en divisas (USD/EUR)."
                type="error"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label="Habilitar Cobro de IGTF en POS"
                name="igtfEnabled"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
            >
                <Switch />
            </Form.Item>

            <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.igtfEnabled !== currentValues.igtfEnabled}
            >
                {({ getFieldValue }) =>
                    getFieldValue('igtfEnabled') ? (
                        <Form.Item
                            label="Tasa de IGTF (%)"
                            name="igtfRate"
                            rules={[{ required: true, message: 'Ingrese la tasa de IGTF' }]}
                        >
                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    ) : null
                }
            </Form.Item>

            <Alert
                message="Estatus Fiscal (SENIAT)"
                description="Active esta opción si su empresa ha sido designada como Contribuyente Especial por el SENIAT. Esto habilitará la emisión de comprobantes de retención de IVA/ISLR a proveedores."
                type="warning"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label="¿Es Contribuyente Especial?"
                name="isSpecialTaxpayer"
                valuePropName="checked"
                extra="Al activar esta opción, el sistema permitirá generar comprobantes de retención para sus compras."
            >
                <Switch />
            </Form.Item>

            <Form.Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    icon={<SaveOutlined />}
                    loading={isUpdating}
                >
                    Guardar Configuración
                </Button>
            </Form.Item>
        </Form>
    );
};

export const GeneralOptionsPage = () => {
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
            message.success('Opciones generales actualizadas exitosamente');
            queryClient.invalidateQueries({ queryKey: ['company-settings'] });
            // También invalidar POS store si es necesario (se hará via fetch al montar POS)
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al actualizar opciones');
        },
    });

    const handleSubmit = (values: any) => {
        // Mantenemos los valores existentes y solo actualizamos lo nuevo
        if (!settings) return;

        updateMutation.mutate({
            name: settings.name,
            rif: settings.rif,
            logoUrl: settings.logoUrl,
            ...values,
        });
    };

    return (
        <div style={{ padding: 24 }}>
            <Card title="Opciones Generales del Sistema">
                {isLoading ? (
                    <Skeleton active paragraph={{ rows: 6 }} />
                ) : (
                    <GeneralOptionsForm
                        settings={settings}
                        onSubmit={handleSubmit}
                        isUpdating={updateMutation.isPending}
                    />
                )}
            </Card>
        </div>
    );
};
