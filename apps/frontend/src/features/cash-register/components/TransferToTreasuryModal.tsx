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
            message.success('Traslado realizado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['active-session'] });
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al realizar traslado');
        },
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
            mutation.mutate(values);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title="Trasladar Fondos a Tesorería"
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={mutation.isPending}
            okText="Confirmar Traslado (F9)"
            cancelText="Cancelar"
            destroyOnClose
        >
            <Alert
                message="Atención"
                description="Esta acción restará el monto del balance actual de tu caja y lo sumará a la cuenta de tesorería seleccionada."
                type="info"
                showIcon
                style={{ marginBottom: 20 }}
            />

            <Form form={form} layout="vertical">
                <Form.Item
                    label="Cuenta / Bóveda de Destino"
                    name="bankAccountId"
                    rules={[{ required: true, message: 'Selecciona una cuenta' }]}
                >
                    <Select
                        loading={loadingBanks}
                        placeholder="Selecciona cuenta de destino"
                        options={banks.map(b => ({
                            value: b.id,
                            label: `${b.bankName} - ${b.accountNumber} (${b.currency.symbol})`
                        }))}
                    />
                </Form.Item>

                <Form.Item
                    label="Monto a Trasladar"
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
                    label="Descripción / Motivo"
                    name="description"
                    rules={[{ required: true, message: 'Requerido' }]}
                >
                    <Input placeholder="Ej: Retiro parcial de ventas del día" />
                </Form.Item>
            </Form>
        </Modal>
    );
};
