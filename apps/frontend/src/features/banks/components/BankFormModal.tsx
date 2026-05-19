import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, App, Row, Col, Switch, Space, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { banksApi } from '../../../services/banksApi';
import type { BankAccount, UpdateBankAccountDto } from '../../../services/banksApi';
import { currenciesApi } from '../../../services/currenciesApi';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface BankFormModalProps {
    open: boolean;
    bankAccount: BankAccount | null;
    onClose: () => void;
}

/**
 * BankFormModal Component
 * Modal to create or edit a bank account or cash vault.
 */
export const BankFormModal = ({ open, bankAccount, onClose }: BankFormModalProps) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // Fetch currencies for selection
    const { data: currencies = [] } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
        enabled: open,
    });

    const createMutation = useMutation({
        mutationFn: banksApi.create,
        onSuccess: () => {
            message.success(t('banks.success_create'));
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('common.error'));
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateBankAccountDto }) =>
            banksApi.update(id, dto),
        onSuccess: () => {
            message.success(t('banks.success_update'));
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('common.error'));
        },
    });

    useEffect(() => {
        if (bankAccount) {
            form.setFieldsValue({
                bankName: bankAccount.bankName,
                accountNumber: bankAccount.accountNumber,
                accountType: bankAccount.accountType,
                holderName: bankAccount.holderName,
                holderId: bankAccount.holderId,
                currencyId: bankAccount.currencyId,
                receivesPosLiquidation: bankAccount.receivesPosLiquidation,
                receivesMobilePayment: bankAccount.receivesMobilePayment,
            });
        } else {
            form.resetFields();
            if (currencies.length > 0) {
                const primary = currencies.find(c => c.isPrimary);
                if (primary) form.setFieldValue('currencyId', primary.id);
            }
        }
    }, [bankAccount, form, currencies]);

    // F9 Keyboard Shortcut for quick submission
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [open]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            if (bankAccount) {
                updateMutation.mutate({ id: bankAccount.id, dto: values });
            } else {
                createMutation.mutate(values);
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title={bankAccount ? t('banks.edit') : t('banks.new')}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={bankAccount ? `${t('common.save')} (F9)` : `${t('common.add')} (F9)`}
            cancelText={t('common.cancel')}
            width={700}
            forceRender
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={t('common.bank')}
                            name="bankName"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Input placeholder={t('banks.placeholders.bank_name')} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={t('common.account_type')}
                            name="accountType"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Select
                                options={[
                                    { value: 'CHECKING', label: t('banks.account_types.checking') },
                                    { value: 'SAVINGS', label: t('banks.account_types.savings') },
                                    { value: 'CASH_VAULT', label: t('banks.account_types.vault') },
                                    { value: 'MOBILE_PAYMENT', label: t('banks.account_types.mobile') },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={24}>
                        <Form.Item
                            label={t('banks.account_number')}
                            name="accountNumber"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Input placeholder={t('banks.placeholders.account_number')} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={t('banks.holder_name')}
                            name="holderName"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Input placeholder={t('banks.holder_name')} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={t('banks.holder_id')}
                            name="holderId"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Input placeholder={t('banks.placeholders.holder_id')} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={t('common.currency')}
                            name="currencyId"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Select
                                options={currencies.map(c => ({
                                    value: c.id,
                                    label: `${c.name} (${c.symbol})`
                                }))}
                            />
                        </Form.Item>
                    </Col>
                    {!bankAccount && (
                        <Col span={12}>
                            <Form.Item
                                label={t('banks.initial_balance')}
                                name="initialBalance"
                                rules={[{ type: 'number', min: 0 }]}
                            >
                                <InputNumber style={{ width: '100%' }} precision={2} />
                            </Form.Item>
                        </Col>
                    )}
                </Row>

                <Row gutter={16} style={{ marginTop: 16 }}>
                    <Col span={24}>
                        <div style={{ backgroundColor: '#f0faff', padding: '16px', borderRadius: '8px', border: '1px solid #91d5ff' }}>
                            <Row gutter={16} align="middle">
                                <Col flex="none">
                                    <Form.Item name="receivesPosLiquidation" valuePropName="checked" noStyle>
                                        <Switch />
                                    </Form.Item>
                                </Col>
                                <Col flex="auto">
                                    <Space direction="vertical" size={0}>
                                        <Text strong>{t('banks.pos_settings.liquidation_title')}</Text>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            {t('banks.pos_settings.liquidation_desc')}
                                        </Text>
                                    </Space>
                                </Col>
                            </Row>
                        </div>
                    </Col>

                    <Col span={24} style={{ marginTop: 16 }}>
                        <div style={{ backgroundColor: '#f9f0ff', padding: '16px', borderRadius: '8px', border: '1px solid #d3adf7' }}>
                            <Row gutter={16} align="middle">
                                <Col flex="none">
                                    <Form.Item name="receivesMobilePayment" valuePropName="checked" noStyle>
                                        <Switch />
                                    </Form.Item>
                                </Col>
                                <Col flex="auto">
                                    <Space direction="vertical" size={0}>
                                        <Text strong>{t('banks.pos_settings.mobile_title')}</Text>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            {t('banks.pos_settings.mobile_desc')}
                                        </Text>
                                    </Space>
                                </Col>
                            </Row>
                        </div>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
};
