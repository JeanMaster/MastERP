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

export const AddMovementModal = ({ open, sessionId, onCancel, onSuccess }: AddMovementModalProps) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

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
            setLoading(true);

            const dto: CreateMovementDto = {
                sessionId,
                type: values.type,
                amount: values.amount,
                currencyCode: values.currencyCode || 'VES',
                description: values.description,
                notes: values.notes,
                performedBy: values.performedBy || 'Usuario'
            };

            await cashRegisterApi.createMovement(dto);
            message.success('Movimiento registrado exitosamente');
            form.resetFields();
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al registrar movimiento');
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
            title="Registrar Movimiento de Caja"
            open={open}
            onCancel={handleCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText="Registrar (F9)"
            cancelText="Cancelar"
            width={500}
        >
            <Form
                form={form}
                layout="vertical"
                style={{ marginTop: 20 }}
            >
                <Form.Item
                    name="type"
                    label="Tipo de Movimiento"
                    rules={[{ required: true, message: 'Selecciona el tipo' }]}
                >
                    <Select placeholder="Selecciona el tipo" size="large">
                        <Select.Option value="EXPENSE">💸 Gasto (pagar algo)</Select.Option>
                        <Select.Option value="WITHDRAWAL">💰 Ingreso a Caja (agregar dinero)</Select.Option>
                        <Select.Option value="DEPOSIT">🏦 Retiro de Caja (sacar dinero)</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="amount"
                    label="Monto"
                    rules={[
                        { required: true, message: 'Ingresa el monto' },
                        { type: 'number', min: 0.01, message: 'Debe ser mayor a 0' }
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
                    label="Descripción"
                    rules={[{ required: true, message: 'Ingresa una descripción' }]}
                >
                    <Input placeholder="Ej: Comprar materiales de limpieza" />
                </Form.Item>

                <Form.Item
                    name="currencyCode"
                    label="Moneda"
                    initialValue="VES"
                >
                    <Select>
                        <Select.Option value="VES">Bolívares (VES)</Select.Option>
                        <Select.Option value="USD">Dólares (USD)</Select.Option>
                        <Select.Option value="EUR">Euros (EUR)</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="performedBy"
                    label="Realizado por"
                    initialValue="Usuario"
                >
                    <Input placeholder="Nombre del responsable" />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label="Notas (opcional)"
                >
                    <TextArea
                        rows={2}
                        placeholder="Detalles adicionales..."
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};
