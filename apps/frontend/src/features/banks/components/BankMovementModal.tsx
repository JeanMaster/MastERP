import { useEffect } from 'react';

import { Modal, Form, Input, InputNumber, Select, message, Row, Col } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { banksApi, type BankAccount } from '../../../services/banksApi';

interface BankMovementModalProps {
    open: boolean;
    bankAccount: BankAccount | null;
    onClose: () => void;
}

export const BankMovementModal = ({ open, bankAccount, onClose }: BankMovementModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: banksApi.addMovement,
        onSuccess: () => {
            message.success('Movimiento registrado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['banks'] });
            queryClient.invalidateQueries({ queryKey: ['bank-history', bankAccount?.id] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al registrar movimiento');
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
            title={`Nuevo Movimiento: ${bankAccount?.bankName}`}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={mutation.isPending}
            okText="Registrar (F9)"
            cancelText="Cancelar"
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
                            label="Tipo"
                            name="type"
                            rules={[{ required: true }]}
                        >
                            <Select
                                options={[
                                    { value: 'IN', label: 'Ingreso (+)' },
                                    { value: 'OUT', label: 'Egreso (-)' },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label="Monto"
                            name="amount"
                            rules={[{ required: true, type: 'number', min: 0.01 }]}
                        >
                            <InputNumber style={{ width: '100%' }} precision={2} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    label="Categoría"
                    name="category"
                    rules={[{ required: true }]}
                >
                    <Select
                        options={[
                            { value: 'INJECTION', label: 'Inyección de Capital' },
                            { value: 'EXPENSE', label: 'Gasto' },
                            { value: 'ADJUSTMENT', label: 'Ajuste de Saldo' },
                            { value: 'TRANSFER', label: 'Transferencia entre Cuentas' },
                            { value: 'OTHER', label: 'Otro' },
                        ]}
                    />
                </Form.Item>

                <Form.Item
                    label="Descripción"
                    name="description"
                    rules={[{ required: true }]}
                >
                    <Input placeholder="Ej: Pago de alquiler, Venta extra..." />
                </Form.Item>

                <Form.Item
                    label="Referencia (Opcional)"
                    name="reference"
                >
                    <Input placeholder="Ref bancaria, factura #..." />
                </Form.Item>
            </Form>
        </Modal>
    );
};
