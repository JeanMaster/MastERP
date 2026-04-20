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

export const LiquidateBatchModal = ({ open, bankAccount, onClose }: LiquidateBatchModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const liquidateMutation = useMutation({
        mutationFn: banksApi.liquidatePos,
        onSuccess: () => {
            message.success('Liquidación procesada correctamente');
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al procesar liquidación');
        }
    });

    // F9 Keyboard Shortcut
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
            title="Confirmar Liquidación de Lote POS"
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={liquidateMutation.isPending}
            okText="Procesar Liquidación (F9)"
            cancelText="Cancelar"
            width={500}
        >
            <div style={{ marginTop: 16 }}>
                <Alert
                    message="Proceso de Liquidación"
                    description="Al confirmar, el saldo en tránsito se moverá al saldo real de la cuenta. Se registrará un gasto automático por la comisión bancaria."
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />

                <Descriptions bordered column={1} size="small" style={{ marginBottom: 20 }}>
                    <Descriptions.Item label="Monto en Tránsito">
                        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                            {bankAccount.currency.symbol} {formatVenezuelanPrice(pendingAmount)}
                        </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="Cuenta Destino">
                        {bankAccount.bankName} - {bankAccount.accountNumber}
                    </Descriptions.Item>
                </Descriptions>

                <Form form={form} layout="vertical" initialValues={{ commissionAmount: 0 }}>
                    <Form.Item
                        label="Comisión Bancaria (Deducir)"
                        name="commissionAmount"
                        rules={[{ required: true, message: 'Ingrese la comisión (puede ser 0)' }]}
                        help="Este monto se restará del total y se registrará como un Gasto."
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
                        label="Notas / Referencia"
                        name="notes"
                    >
                        <Input.TextArea placeholder="Ej: Lote #1234 - Liquidación Bangente" rows={2} />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
};
