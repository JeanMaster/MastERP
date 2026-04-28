import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, App, Row, Col } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { banksApi, type BankAccount } from '../../../services/banksApi';

interface BankMovementModalProps {
    open: boolean;
    bankAccount: BankAccount | null;
    onClose: () => void;
}

/**
 * BankMovementModal Component
 * Modal to register a manual bank movement (income or outcome).
 */
export const BankMovementModal = ({ open, bankAccount, onClose }: BankMovementModalProps) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: banksApi.addMovement,
        onSuccess: () => {
            message.success(t('banks.movements.messages.success'));
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            queryClient.invalidateQueries({ queryKey: ['bank-history', bankAccount?.id] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('banks.movements.messages.error'));
        },
    });

    // F9 Keyboard Shortcut for quick registration
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
            mutation.mutate({
                ...values,
                bankAccountId: bankAccount!.id,
            });
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title={`${t('banks.movements.title')}: ${bankAccount?.bankName}`}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={mutation.isPending}
            okText={`${t('common.add')} (F9)`}
            cancelText={t('common.cancel')}
        >
            <Form
                form={form}
                layout="vertical"
                style={{ marginTop: 20 }}
                initialValues={{ type: 'IN' }}
            >
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={t('banks.movements.type')}
                            name="type"
                            rules={[{ required: true }]}
                        >
                            <Select
                                options={[
                                    { value: 'IN', label: t('banks.movements.income') },
                                    { value: 'OUT', label: t('banks.movements.outcome') },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={t('banks.movements.amount')}
                            name="amount"
                            rules={[{ required: true, type: 'number', min: 0.01 }]}
                        >
                            <InputNumber style={{ width: '100%' }} precision={2} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    label={t('banks.movements.category')}
                    name="category"
                    rules={[{ required: true }]}
                >
                    <Select
                        options={[
                            { value: 'INJECTION', label: t('banks.movements.categories.injection') },
                            { value: 'EXPENSE', label: t('banks.movements.categories.expense') },
                            { value: 'ADJUSTMENT', label: t('banks.movements.categories.adjustment') },
                            { value: 'TRANSFER', label: t('banks.movements.categories.transfer') },
                            { value: 'OTHER', label: t('banks.movements.categories.other') },
                        ]}
                    />
                </Form.Item>

                <Form.Item
                    label={t('banks.movements.description')}
                    name="description"
                    rules={[{ required: true }]}
                >
                    <Input placeholder={t('banks.placeholders.description')} />
                </Form.Item>

                <Form.Item
                    label={t('banks.movements.reference')}
                    name="reference"
                >
                    <Input placeholder={t('banks.placeholders.reference')} />
                </Form.Item>
            </Form>
        </Modal>
    );
};
