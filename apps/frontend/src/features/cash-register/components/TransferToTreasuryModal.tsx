import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, message, Alert } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cashRegisterApi } from '../../../services/cashRegisterApi';
import { banksApi } from '../../../services/banksApi';

interface TransferToTreasuryModalProps {
    open: boolean;
    sessionId: string;
    onClose: () => void;
}

/**
 * TransferToTreasuryModal Component
 * Modal to transfer funds from a cash session to a treasury (bank) account.
 */
export const TransferToTreasuryModal = ({ open, sessionId, onClose }: TransferToTreasuryModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // Fetch available treasury accounts
    const { data: banks = [], isLoading: loadingBanks } = useQuery({
        queryKey: ['banks'],
        queryFn: () => banksApi.getAll(),
        enabled: open,
    });

    const mutation = useMutation({
        mutationFn: (values: any) => cashRegisterApi.transferToTreasury(sessionId, values),
        onSuccess: () => {
            message.success('Transfer completed successfully');
            queryClient.invalidateQueries({ queryKey: ['active-session'] });
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error performing transfer');
        },
    });

    // F9 Keyboard Shortcut for quick transfer confirmation
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
            mutation.mutate(values);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title="Transfer Funds to Treasury"
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={mutation.isPending}
            okText="Confirm Transfer (F9)"
            cancelText="Cancel"
            forceRender
        >
            <Alert
                message="Attention"
                description="This action will subtract the amount from your current cash balance and add it to the selected treasury account."
                type="info"
                showIcon
                style={{ marginBottom: 20 }}
            />

            <Form form={form} layout="vertical">
                <Form.Item
                    label="Destination Account / Vault"
                    name="bankAccountId"
                    rules={[{ required: true, message: 'Please select an account' }]}
                >
                    <Select
                        loading={loadingBanks}
                        placeholder="Select destination account"
                        options={banks.map(b => ({
                            value: b.id,
                            label: `${b.bankName} - ${b.accountNumber} (${b.currency.symbol})`
                        }))}
                    />
                </Form.Item>

                <Form.Item
                    label="Amount to Transfer"
                    name="amount"
                    rules={[{ required: true, type: 'number', min: 0.01 }]}
                >
                    <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        placeholder="0.00"
                    />
                </Form.Item>

                <Form.Item
                    label="Description / Reason"
                    name="description"
                    rules={[{ required: true, message: 'Description is required' }]}
                >
                    <Input placeholder="e.g., Partial daily sales withdrawal" />
                </Form.Item>
            </Form>
        </Modal>
    );
};
