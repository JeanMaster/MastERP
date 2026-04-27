import { useEffect } from 'react';
import { Card, Form, Button, Select, Skeleton, message, Alert, Switch, InputNumber, Typography } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companySettingsApi } from '../../services/companySettingsApi';
import { currenciesApi } from '../../services/currenciesApi';

const { Title, Text } = Typography;

/**
 * GeneralOptionsForm Sub-component
 * Manages core business logic toggles: secondary currency, tax rates (VAT/IGTF), price rounding, and fiscal status.
 */
const GeneralOptionsForm = ({ settings, onSubmit, isUpdating }: { settings: any, onSubmit: (values: any) => void, isUpdating: boolean }) => {
    const [form] = Form.useForm();

    const { data: currencies, isLoading: isLoadingCurrencies } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
    });

    useEffect(() => {
        if (settings) {
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
                message="Secondary Currency Display"
                description="Select the default secondary currency to be displayed in the Point of Sale (POS) for reference pricing."
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
            />

            <Form.Item
                label="Preferred Secondary Currency (POS)"
                name="preferredSecondaryCurrencyId"
                extra="This currency will be shown alongside the primary currency in the product grid and POS cart."
            >
                <Select
                    placeholder="Select a currency"
                    size="large"
                    loading={isLoadingCurrencies}
                    allowClear
                >
                    {secondaryCurrencies.map(currency => (
                        <Select.Option key={currency.id} value={currency.id}>
                            {currency.name} ({currency.symbol}) - Rate: {currency.exchangeRate}
                        </Select.Option>
                    ))}
                </Select>
            </Form.Item>

            <Alert
                message="Exchange Rate Automation"
                description="Enable this to automatically update exchange rates from external providers (e.g., Binance P2P for USDT)."
                type="warning"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label="Enable Automatic Rate Updates"
                name="autoUpdateRates"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
            >
                <Switch />
            </Form.Item>

            <Form.Item
                label="Update Frequency (Minutes)"
                name="updateFrequency"
                rules={[{ required: true, message: 'Frequency is required' }]}
            >
                <InputNumber min={5} max={1440} style={{ width: '100%' }} />
            </Form.Item>

            <Alert
                message="Tax Configuration (VAT / IVA)"
                description="Enable this to calculate value-added tax in the Point of Sale (POS) and Price Checker."
                type="success"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label="Enable Tax Calculation (VAT)"
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
                            label="Tax Rate (%)"
                            name="taxRate"
                            rules={[{ required: true, message: 'VAT rate is required' }]}
                        >
                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    ) : null
                }
            </Form.Item>

            <Alert
                message="Price Rounding Configuration"
                description="Determine if POS prices should be rounded and by what factor (e.g., round to the nearest ten or hundred)."
                type="info"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label="Enable Price Rounding"
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
                            label="Rounding Factor (Multiple of)"
                            name="roundingFactor"
                            rules={[{ required: true, message: 'Choose rounding factor' }]}
                            extra="Final prices will be rounded UP to the nearest multiple of this value."
                        >
                            <Select size="large">
                                <Select.Option value={1}>No Rounding (1)</Select.Option>
                                <Select.Option value={5}>Round to 5</Select.Option>
                                <Select.Option value={10}>Round to 10 (Tens)</Select.Option>
                                <Select.Option value={50}>Round to 50</Select.Option>
                                <Select.Option value={100}>Round to 100 (Hundreds)</Select.Option>
                                <Select.Option value={500}>Round to 500</Select.Option>
                                <Select.Option value={1000}>Round to 1000</Select.Option>
                            </Select>
                        </Form.Item>
                    ) : null
                }
            </Form.Item>

            <Alert
                message="IGTF (Foreign Currency Tax) - 3%"
                description="Enable this if your business is a Special Taxpayer and must collect the 3% tax for payments in foreign currencies (USD/EUR)."
                type="error"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label="Enable IGTF Calculation in POS"
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
                            label="IGTF Rate (%)"
                            name="igtfRate"
                            rules={[{ required: true, message: 'IGTF rate is required' }]}
                        >
                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    ) : null
                }
            </Form.Item>

            <Alert
                message="Fiscal Status (SENIAT)"
                description="Enable this if your company has been designated as a 'Special Taxpayer' by SENIAT. This enables VAT/Income Tax retention workflows for supplier purchases."
                type="warning"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label="Is Special Taxpayer?"
                name="isSpecialTaxpayer"
                valuePropName="checked"
                extra="When enabled, the system will allow generating tax retention certificates for your inbound invoices."
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
                    block
                    style={{ height: 50, borderRadius: 8 }}
                >
                    Save System Options
                </Button>
            </Form.Item>
        </Form>
    );
};

/**
 * GeneralOptionsPage Component
 * Main page for system-wide behavioral settings and fiscal compliance options.
 */
export const GeneralOptionsPage = () => {
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery({
        queryKey: ['company-settings'],
        queryFn: companySettingsApi.getSettings,
    });

    const updateMutation = useMutation({
        mutationFn: companySettingsApi.updateSettings,
        onSuccess: () => {
            message.success('General options updated successfully');
            queryClient.invalidateQueries({ queryKey: ['company-settings'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error updating general options');
        },
    });

    const handleSubmit = (values: any) => {
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
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>⚙️ System General Options</Title>
                <Text type="secondary">Fine-tune POS behavior, tax calculations, and exchange rate automation.</Text>
            </div>
            <Card bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                {isLoading ? (
                    <Skeleton active paragraph={{ rows: 10 }} />
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
