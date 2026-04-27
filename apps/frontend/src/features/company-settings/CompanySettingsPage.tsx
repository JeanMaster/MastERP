import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Upload, message, Space, Skeleton, Switch, Divider, Alert, Typography } from 'antd';
import { UploadOutlined, BankOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { companySettingsApi } from '../../services/companySettingsApi';

const { Title, Text } = Typography;

/**
 * CompanySettingsForm Sub-component
 * Contains the legal and branding information for the business entity.
 * Handles logo uploads and accounting rigour configurations.
 */
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
                message.success('Logo loaded. Save changes to apply.');
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
                label="Company Name"
                name="name"
                rules={[{ required: true, message: 'Company name is required' }]}
            >
                <Input placeholder="e.g., MastERP Solutions" size="large" />
            </Form.Item>

            <Form.Item
                label="Tax Identification / RIF"
                name="rif"
                rules={[{ required: true, message: 'Tax ID (RIF) is required' }]}
            >
                <Input placeholder="J-12345678-9" size="large" />
            </Form.Item>

            <Form.Item label="Company Brand / Logo">
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
                            {logoUrl ? 'Change Logo' : 'Upload Logo'}
                        </Button>
                    </Upload>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Recommendation: Use a square image (aspect ratio 1:1) for optimal circular display on receipts and reports.
                    </Text>
                </Space>
            </Form.Item>

            <Divider orientation={"left" as any}>Accounting Control</Divider>

            <Form.Item
                label="Enforce Bank Account Selection"
                name="requireBankAccountForPayments"
                valuePropName="checked"
                style={{ marginBottom: 12 }}
            >
                <Switch
                    checkedChildren="Strict"
                    unCheckedChildren="Optional"
                />
            </Form.Item>
            
            <Alert 
                type="info" 
                showIcon 
                icon={<BankOutlined />}
                style={{ marginBottom: 24 }}
                message="Mandatory Bank Source" 
                description="When enabled, staff will be forced to select an specific bank account or cash drawer when recording Expenses or paying Suppliers." 
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
                    Save Changes (F9)
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
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery({
        queryKey: ['company-settings'],
        queryFn: companySettingsApi.getSettings,
    });

    const updateMutation = useMutation({
        mutationFn: companySettingsApi.updateSettings,
        onSuccess: () => {
            message.success('Company settings updated successfully');
            queryClient.invalidateQueries({ queryKey: ['company-settings'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error updating settings');
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
                <Title level={2} style={{ margin: 0 }}>🏢 Business Profile</Title>
                <Text type="secondary">Manage your company branding, legal identification, and accounting rigour.</Text>
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
