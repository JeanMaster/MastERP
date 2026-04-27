import { Modal, Form, InputNumber, Input, Select, message } from 'antd';
import { useState, useEffect } from 'react';
import { cashRegisterApi, type CreateMovementDto } from '../../../services/cashRegisterApi';

const { TextArea } = Input;

interface AddMovementModalProps {
    open: boolean;
    sessionId: string;
    onCancel: () => void;
    onSuccess: () => void;
}

/**
 * AddMovementModal Component
 * Modal to register a manual cash movement (expense, deposit, or withdrawal).
 */
export const AddMovementModal = ({ open, sessionId, onCancel, onSuccess }: AddMovementModalProps) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

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
            setLoading(true);

            const dto: CreateMovementDto = {
                sessionId,
                type: values.type,
                amount: values.amount,
                currencyCode: values.currencyCode || 'VES',
                description: values.description,
                notes: values.notes,
                performedBy: values.performedBy || 'User'
            };

            await cashRegisterApi.createMovement(dto);
            message.success('Movement registered successfully');
            form.resetFields();
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error registering movement');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onCancel();
    };

    return (
        <Modal
            title="Register Cash Movement"
            open={open}
            onCancel={handleCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText="Register (F9)"
            cancelText="Cancel"
            width={500}
        >
            <Form
                form={form}
                layout="vertical"
                style={{ marginTop: 20 }}
            >
                <Form.Item
                    name="type"
                    label="Movement Type"
                    rules={[{ required: true, message: 'Please select a type' }]}
                >
                    <Select placeholder="Select type" size="large">
                        <Select.Option value="EXPENSE">💸 Expense (Pay something)</Select.Option>
                        <Select.Option value="WITHDRAWAL">💰 Cash In (Add money)</Select.Option>
                        <Select.Option value="DEPOSIT">🏦 Cash Out (Remove money)</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="amount"
                    label="Amount"
                    rules={[
                        { required: true, message: 'Please enter the amount' },
                        { type: 'number', min: 0.01, message: 'Must be greater than 0' }
                    ]}
                >
                    <InputNumber
                        style={{ width: '100%' }}
                        placeholder="0.00"
                        min={0.01}
                        precision={2}
                        prefix="Bs."
                        size="large"
                    />
                </Form.Item>

                <Form.Item
                    name="description"
                    label="Description"
                    rules={[{ required: true, message: 'Please enter a description' }]}
                >
                    <Input placeholder="e.g., Cleaning supplies purchase" />
                </Form.Item>

                <Form.Item
                    name="currencyCode"
                    label="Currency"
                    initialValue="VES"
                >
                    <Select>
                        <Select.Option value="VES">Bolívares (VES)</Select.Option>
                        <Select.Option value="USD">Dollars (USD)</Select.Option>
                        <Select.Option value="EUR">Euros (EUR)</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="performedBy"
                    label="Performed by"
                    initialValue="User"
                >
                    <Input placeholder="Responsible name" />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label="Notes (Optional)"
                >
                    <TextArea
                        rows={2}
                        placeholder="Additional details..."
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};
