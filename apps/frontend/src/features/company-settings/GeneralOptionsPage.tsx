import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Form, Button, Select, Skeleton, App, Alert, Switch, InputNumber, Typography } from 'antd';
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
    const { t } = useTranslation();
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
                message={t('settings.general.secondary_display_title')}
                description={t('settings.general.secondary_display_desc')}
                type="info"
                showIcon
                style={{ marginBottom: 24 }}
            />

            <Form.Item
                label={t('settings.general.preferred_secondary_label')}
                name="preferredSecondaryCurrencyId"
                extra={t('settings.general.preferred_secondary_extra')}
            >
                <Select
                    placeholder={t('settings.general.select_currency')}
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
                message={t('settings.general.rate_automation_title')}
                description={t('settings.general.rate_automation_desc')}
                type="warning"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label={t('settings.general.enable_auto_rates_label')}
                name="autoUpdateRates"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
            >
                <Switch />
            </Form.Item>

            <Form.Item
                label={t('settings.general.update_frequency_label')}
                name="updateFrequency"
                rules={[{ required: true, message: t('settings.general.frequency_required') }]}
            >
                <InputNumber min={5} max={1440} style={{ width: '100%' }} />
            </Form.Item>

            <Alert
                message={t('settings.general.tax_config_title')}
                description={t('settings.general.tax_config_desc')}
                type="success"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label={t('settings.general.enable_tax_label')}
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
                            label={t('settings.general.tax_rate_label')}
                            name="taxRate"
                            rules={[{ required: true, message: t('settings.general.tax_rate_required') }]}
                        >
                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    ) : null
                }
            </Form.Item>

            <Alert
                message={t('settings.general.rounding_config_title')}
                description={t('settings.general.rounding_config_desc')}
                type="info"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label={t('settings.general.enable_rounding_label')}
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
                            label={t('settings.general.rounding_factor_label')}
                            name="roundingFactor"
                            rules={[{ required: true, message: t('settings.general.rounding_factor_required') }]}
                            extra={t('settings.general.rounding_factor_extra')}
                        >
                            <Select size="large">
                                <Select.Option value={1}>{t('settings.general.rounding_none')}</Select.Option>
                                <Select.Option value={5}>{t('settings.general.rounding_5')}</Select.Option>
                                <Select.Option value={10}>{t('settings.general.rounding_10')}</Select.Option>
                                <Select.Option value={50}>{t('settings.general.rounding_50')}</Select.Option>
                                <Select.Option value={100}>{t('settings.general.rounding_100')}</Select.Option>
                                <Select.Option value={500}>{t('settings.general.rounding_500')}</Select.Option>
                                <Select.Option value={1000}>{t('settings.general.rounding_1000')}</Select.Option>
                            </Select>
                        </Form.Item>
                    ) : null
                }
            </Form.Item>

            <Alert
                message={t('settings.general.igtf_config_title')}
                description={t('settings.general.igtf_config_desc')}
                type="error"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label={t('settings.general.enable_igtf_label')}
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
                            label={t('settings.general.igtf_rate_label')}
                            name="igtfRate"
                            rules={[{ required: true, message: t('settings.general.igtf_rate_required') }]}
                        >
                            <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    ) : null
                }
            </Form.Item>

            <Alert
                message={t('settings.general.fiscal_status_title')}
                description={t('settings.general.fiscal_status_desc')}
                type="warning"
                showIcon
                style={{ marginBottom: 24, marginTop: 24 }}
            />

            <Form.Item
                label={t('settings.general.special_taxpayer_label')}
                name="isSpecialTaxpayer"
                valuePropName="checked"
                extra={t('settings.general.special_taxpayer_extra')}
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
                    {t('settings.general.save_button')}
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
    const { t } = useTranslation();
    const { message } = App.useApp();
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery({
        queryKey: ['company-settings'],
        queryFn: companySettingsApi.getSettings,
    });

    const updateMutation = useMutation({
        mutationFn: companySettingsApi.updateSettings,
        onSuccess: () => {
            message.success(t('settings.general.success_update'));
            queryClient.invalidateQueries({ queryKey: ['company-settings'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('settings.general.error_update'));
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
                <Title level={2} style={{ margin: 0 }}>{t('settings.general.page_title')}</Title>
                <Text type="secondary">{t('settings.general.page_subtitle')}</Text>
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
