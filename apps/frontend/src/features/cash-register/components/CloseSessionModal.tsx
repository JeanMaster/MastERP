import { Modal, Form, InputNumber, Input, message, Alert, Descriptions } from 'antd';
import { useState, useEffect } from 'react';
import { cashRegisterApi, type CloseSessionDto, type CashSession } from '../../../services/cashRegisterApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';

const { TextArea } = Input;

interface CloseSessionModalProps {
    open: boolean;
    session: CashSession | null;
    onCancel: () => void;
    onSuccess: () => void;
}

export const CloseSessionModal = ({ open, session, onCancel, onSuccess }: CloseSessionModalProps) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    if (!session) return null;

    // Calculate expected balance (In base currency VES)
    const calculateExpected = () => {
        let sales = 0;
        let expenses = 0;
        let deposits = 0;
        let withdrawals = 0;

        session.movements.forEach(movement => {
            // Robust parsing of amount and rate
            const rawAmount = Number(movement.amount || 0);
            const rawRate = Number(movement.exchangeRate);

            // If rate is valid (>0), use it. otherwise default to 1.
            const rate = (!isNaN(rawRate) && rawRate > 0) ? rawRate : 1;
            const amountInBs = rawAmount * rate;

            // Normalize type string just in case
            const type = String(movement.type).trim();

            switch (type) {
                case 'SALE':
                    sales += amountInBs;
                    break;
                case 'EXPENSE':
                    expenses += amountInBs;
                    break;
                case 'DEPOSIT':
                    deposits += amountInBs;
                    break;
                case 'WITHDRAWAL':
                    withdrawals += amountInBs;
                    break;
                case 'CHANGE':
                    sales -= amountInBs;
                    break;
                case 'ADJUSTMENT':
                    if (amountInBs > 0) withdrawals += amountInBs;
                    else deposits += Math.abs(amountInBs);
                    break;
                // OPENING is ignored
            }
        });

        const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
        return round(Number(session.openingBalance) + sales + withdrawals - expenses - deposits);
    };

    const expectedBalance = calculateExpected();

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

            const dto: CloseSessionDto = {
                actualBalance: values.actualBalance,
                closedBy: values.closedBy || 'Usuario',
                closingNotes: values.notes
            };

            await cashRegisterApi.closeSession(session.id, dto);
            message.success('Caja cerrada exitosamente');
            form.resetFields();
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al cerrar caja');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onCancel();
    };

    const actualBalance = form.getFieldValue('actualBalance');
    const round = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
    const variance = actualBalance !== undefined ? round(actualBalance - expectedBalance) : 0;

    return (
        <Modal
            title="Cerrar Caja"
            open={open}
            onCancel={handleCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText="Cerrar Caja (F9)"
            cancelText="Cancelar"
            width={600}
        >
            <Alert
                message="Resumen de la Sesión"
                description={
                    <Descriptions column={2} size="small" style={{ marginTop: 10 }}>
                        <Descriptions.Item label="Apertura">
                            {formatVenezuelanPrice(Number(session.openingBalance))}
                        </Descriptions.Item>
                        <Descriptions.Item label="Responsable">
                            {session.openedBy}
                        </Descriptions.Item>
                        <Descriptions.Item label="Balance Esperado" span={2}>
                            <strong style={{ fontSize: 16, color: '#1890ff' }}>
                                {formatVenezuelanPrice(expectedBalance)}
                            </strong>
                        </Descriptions.Item>
                    </Descriptions>
                }
                type="info"
                showIcon
                style={{ marginBottom: 20 }}
            />

            <Form
                form={form}
                layout="vertical"
            >
                <Form.Item
                    name="actualBalance"
                    label="Conteo Real"
                    rules={[
                        { required: true, message: 'Ingresa el conteo real' },
                        { type: 'number', min: 0, message: 'Debe ser mayor o igual a 0' }
                    ]}
                >
                    <InputNumber
                        style={{ width: '100%' }}
                        placeholder="0.00"
                        min={0}
                        precision={2}
                        prefix="Bs."
                        size="large"
                        onChange={() => form.validateFields()}
                    />
                </Form.Item>

                {actualBalance !== undefined && actualBalance !== null && (
                    <Alert
                        message={variance === 0 ? '¡Caja cuadrada!' : (variance > 0 ? 'Sobrante' : 'Faltante')}
                        description={
                            <div style={{ fontSize: 18, fontWeight: 'bold' }}>
                                {variance >= 0 ? '+' : ''}{formatVenezuelanPrice(variance)}
                            </div>
                        }
                        type={variance === 0 ? 'success' : (variance > 0 ? 'warning' : 'error')}
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form.Item
                    name="closedBy"
                    label="Cerrado por"
                    rules={[{ required: true, message: 'Ingresa el nombre' }]}
                    initialValue="Usuario"
                >
                    <Input placeholder="Nombre del responsable" />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label="Notas de Cierre (opcional)"
                >
                    <TextArea
                        rows={3}
                        placeholder="Observaciones, explicación de varianza, etc..."
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};
