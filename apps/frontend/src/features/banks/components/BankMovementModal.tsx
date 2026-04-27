import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, message, Row, Col } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: banksApi.addMovement,
        onSuccess: () => {
            message.success('Movement registered successfully');
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            queryClient.invalidateQueries({ queryKey: ['bank-history', bankAccount?.id] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error registering movement');
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
            title={`New Movement: ${bankAccount?.bankName}`}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={mutation.isPending}
            okText="Register (F9)"
            cancelText="Cancel"
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
                            label="Type"
                            name="type"
                            rules={[{ required: true }]}
                        >
                            <Select
                                options={[
                                    { value: 'IN', label: 'Income (+)' },
                                    { value: 'OUT', label: 'Outcome (-)' },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Amount"
                            name="amount"
                            rules={[{ required: true, type: 'number', min: 0.01 }]}
                        >
                            <InputNumber style={{ width: '100%' }} precision={2} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    label="Category"
                    name="category"
                    rules={[{ required: true }]}
                >
                    <Select
                        options={[
                            { value: 'INJECTION', label: 'Capital Injection' },
                            { value: 'EXPENSE', label: 'Expense' },
                            { value: 'ADJUSTMENT', label: 'Balance Adjustment' },
                            { value: 'TRANSFER', label: 'Transfer between Accounts' },
                            { value: 'OTHER', label: 'Other' },
                        ]}
                    />
                </Form.Item>

                <Form.Item
                    label="Description"
                    name="description"
                    rules={[{ required: true }]}
                >
                    <Input placeholder="e.g., Rent payment, Extra sale..." />
                </Form.Item>

                <Form.Item
                    label="Reference (Optional)"
                    name="reference"
                >
                    <Input placeholder="Bank ref, invoice #..." />
                </Form.Item>
            </Form>
        </Modal>
    );
};
