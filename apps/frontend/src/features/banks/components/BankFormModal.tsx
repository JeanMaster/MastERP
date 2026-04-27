import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, message, Row, Col, Switch, Space, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { banksApi } from '../../../services/banksApi';
import type { BankAccount, UpdateBankAccountDto } from '../../../services/banksApi';
import { currenciesApi } from '../../../services/currenciesApi';

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
            message.success('Bank account created successfully');
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error creating account');
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateBankAccountDto }) =>
            banksApi.update(id, dto),
        onSuccess: () => {
            message.success('Bank account updated successfully');
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error updating account');
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
            title={bankAccount ? 'Edit Bank Account' : 'New Bank Account'}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={bankAccount ? 'Update (F9)' : 'Create (F9)'}
            cancelText="Cancel"
            width={700}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Bank Name"
                            name="bankName"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <Input placeholder="e.g., Chase, Banesco" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Account Type"
                            name="accountType"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <Select
                                options={[
                                    { value: 'CHECKING', label: 'Checking Account' },
                                    { value: 'SAVINGS', label: 'Savings Account' },
                                    { value: 'CASH_VAULT', label: 'Vault / Cash Balance' },
                                    { value: 'MOBILE_PAYMENT', label: 'Mobile Payment / Wallet' },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={24}>
                        <Form.Item
                            label="Account Number"
                            name="accountNumber"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <Input placeholder="0134-...." />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Holder Name"
                            name="holderName"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <Input placeholder="Name of the account holder" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Holder ID (Tax ID/SSN)"
                            name="holderId"
                            rules={[{ required: true, message: 'Required' }]}
                        >
                            <Input placeholder="V-12345678" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label="Currency"
                            name="currencyId"
                            rules={[{ required: true, message: 'Required' }]}
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
                                label="Initial Balance"
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
                                        <Text strong>Receive POS Liquidations</Text>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            If enabled, card payments from the POS will be sent to this account as "In Transit Balance".
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
                                        <Text strong>Enable Mobile Payment</Text>
                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                            Enable to receive mobile payments (Pago Móvil) in the POS.
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
