import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, App, Space, Skeleton, Switch, Divider, Alert, Typography } from 'antd';
import { UploadOutlined, BankOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companySettingsApi } from '../../services/companySettingsApi';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

/**
 * CompanySettingsForm Sub-component
 * Contains the legal and branding information for the business entity.
 * Handles logo uploads and accounting rigour configurations.
 */
const CompanySettingsForm = ({ settings, onSubmit, isUpdating }: { settings: any, onSubmit: (values: any, logoUrl: string) => void, isUpdating: boolean }) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
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

    // F9 Keyboard Shortcut for quick save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                form.submit();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [form]);

    /**
     * Converts the uploaded image to Base64 for storage/preview.
     */
    const handleLogoChange = (info: any) => {
        const file = info.file.originFileObj || info.file;
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                setLogoUrl(result);
                message.success(t('settings.company.messages.logo_loaded'));
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
                label={t('settings.company.name')}
                name="name"
                rules={[{ required: true, message: t('settings.company.name_required') }]}
            >
                <Input placeholder="e.g., MastERP Solutions" size="large" />
            </Form.Item>

            <Form.Item
                label={t('settings.company.tax_id')}
                name="rif"
                rules={[{ required: true, message: t('settings.company.tax_id_required') }]}
            >
                <Input placeholder="J-12345678-9" size="large" />
            </Form.Item>

            <Form.Item label={t('settings.company.logo')}>
                <Space direction="vertical" style={{ width: '100%' }}>
                    {logoUrl && (
                        <div style={{
                            border: '1px solid #d9d9d9',
                            borderRadius: 12,
                            padding: 16,
                            textAlign: 'center',
                            background: '#fafafa',
                        }}>
                            <img
                                src={logoUrl}
                                alt="Company Logo"
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
                        <Button icon={<UploadOutlined />} size="large" block>
                            {logoUrl ? t('settings.company.change_logo') : t('settings.company.upload_logo')}
                        </Button>
                    </Upload>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {t('settings.company.logo_recommendation')}
                    </Text>
                </Space>
            </Form.Item>

            <Divider orientation={"left" as any}>{t('settings.company.accounting_control')}</Divider>

            <Form.Item
                label={t('settings.company.enforce_bank')}
                name="requireBankAccountForPayments"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
            >
                <Switch
                    checkedChildren={t('settings.company.strict')}
                    unCheckedChildren={t('settings.company.optional')}
                />
            </Form.Item>
            
            <Alert 
                type="info" 
                showIcon 
                icon={<BankOutlined />}
                style={{ marginBottom: 24 }}
                message={t('settings.company.mandatory_bank_desc')} 
                description={t('settings.company.mandatory_bank_help')} 
            />

            <Form.Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    block
                    loading={isUpdating}
                    style={{ height: 50, borderRadius: 8 }}
                >
                    {t('settings.company.save_changes')}
                </Button>
            </Form.Item>
        </Form>
    );
};

/**
 * CompanySettingsPage Component
 * Main wrapper for the business profile and configuration settings.
 */
export const CompanySettingsPage = () => {
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
            message.success(t('settings.company.messages.success_update'));
            queryClient.invalidateQueries({ queryKey: ['company-settings'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('settings.company.messages.error_update'));
        },
    });

    const handleSubmit = (values: any, logoUrl: string) => {
        updateMutation.mutate({
            ...values,
            logoUrl: logoUrl || undefined,
        });
    };

    return (
        <Card bordered={false} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: 0 }}>{t('settings.company.page_title')}</Title>
                <Text type="secondary">{t('settings.company.page_subtitle')}</Text>
            </div>
            {isLoading ? (
                <Skeleton active paragraph={{ rows: 8 }} />
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
