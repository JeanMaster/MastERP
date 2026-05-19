import { useEffect } from 'react';
import { Modal, Form, InputNumber, Input, App, Alert, Descriptions } from 'antd';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const liquidateMutation = useMutation({
        mutationFn: banksApi.liquidatePos,
        onSuccess: () => {
            message.success(t('banks.messages.liquidation_success'));
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('banks.messages.liquidation_error'));
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
            title={t('banks.liquidate.title')}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={liquidateMutation.isPending}
            okText={t('banks.liquidate.process_btn')}
            cancelText={t('common.cancel')}
            width={500}
            forceRender
        >
            <div style={{ marginTop: 16 }}>
                <Alert
                    message={t('banks.liquidate.process_title')}
                    description={t('banks.liquidate.process_desc')}
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />

                <Descriptions bordered column={1} size="small" style={{ marginBottom: 20 }}>
                    <Descriptions.Item label={t('banks.liquidate.in_transit_amount')}>
                        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                            {bankAccount.currency.symbol} {formatVenezuelanPrice(pendingAmount)}
                        </span>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('banks.liquidate.dest_account')}>
                        {bankAccount.bankName} - {bankAccount.accountNumber}
                    </Descriptions.Item>
                </Descriptions>

                <Form form={form} layout="vertical" initialValues={{ commissionAmount: 0 }}>
                    <Form.Item
                        label={t('banks.liquidate.commission_label')}
                        name="commissionAmount"
                        rules={[{ required: true, message: t('banks.liquidate.commission_req') }]}
                        help={t('banks.liquidate.commission_help')}
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
                        label={t('common.notes')}
                        name="notes"
                    >
                        <Input.TextArea placeholder={t('banks.liquidate.notes_placeholder')} rows={2} />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
};
