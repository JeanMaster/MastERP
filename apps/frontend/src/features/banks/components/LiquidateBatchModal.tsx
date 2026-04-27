import { useEffect } from 'react';
import { Modal, Form, InputNumber, Input, message, Alert, Descriptions } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { banksApi } from '../../../services/banksApi';
import type { BankAccount } from '../../../services/banksApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';

interface LiquidateBatchModalProps {
    open: boolean;
    bankAccount: BankAccount;
    onClose: () => void;
}

/**
 * LiquidateBatchModal Component
 * Confirms the liquidation of a POS batch, moving funds from "in transit" to "real balance".
 */
export const LiquidateBatchModal = ({ open, bankAccount, onClose }: LiquidateBatchModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const liquidateMutation = useMutation({
        mutationFn: banksApi.liquidatePos,
        onSuccess: () => {
            message.success('Liquidation processed successfully');
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error processing liquidation');
        }
    });

    // F9 Keyboard Shortcut for quick processing
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
            liquidateMutation.mutate({
                bankAccountId: bankAccount.id,
                commissionAmount: values.commissionAmount,
                notes: values.notes
            });
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    const pendingAmount = Number(bankAccount.pendingLiquidation || 0);

    return (
        <Modal
            title="Confirm POS Batch Liquidation"
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={liquidateMutation.isPending}
            okText="Process Liquidation (F9)"
            cancelText="Cancel"
            width={500}
        >
            <div style={{ marginTop: 16 }}>
                <Alert
                    message="Liquidation Process"
                    description="Confirming this will move the in-transit balance to the real account balance. An automatic expense will be recorded for the bank commission."
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />

                <Descriptions bordered column={1} size="small" style={{ marginBottom: 20 }}>
                    <Descriptions.Item label="In-Transit Amount">
                        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                            {bankAccount.currency.symbol} {formatVenezuelanPrice(pendingAmount)}
                        </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Destination Account">
                        {bankAccount.bankName} - {bankAccount.accountNumber}
                    </Descriptions.Item>
                </Descriptions>

                <Form form={form} layout="vertical" initialValues={{ commissionAmount: 0 }}>
                    <Form.Item
                        label="Bank Commission (Deduction)"
                        name="commissionAmount"
                        rules={[{ required: true, message: 'Please enter the commission (can be 0)' }]}
                        help="This amount will be subtracted from the total and recorded as an Expense."
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            prefix={bankAccount.currency.symbol}
                            min={0}
                            max={pendingAmount}
                            precision={2}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Notes / Reference"
                        name="notes"
                    >
                        <Input.TextArea placeholder="e.g., Batch #1234 - POS Settlement" rows={2} />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
};
