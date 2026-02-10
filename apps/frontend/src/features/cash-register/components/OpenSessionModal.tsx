import { Modal, Form, InputNumber, Input, Select, message } from 'antd';
import { useState, useEffect } from 'react';
import { cashRegisterApi, type OpenSessionDto } from '../../../services/cashRegisterApi';
import { api } from '../../../services/apiConfig';

const { TextArea } = Input;
const { Option } = Select;

interface OpenSessionModalProps {
    open: boolean;
    registerId: string;
    onCancel: () => void;
    onSuccess: () => void;
}

export const OpenSessionModal = ({ open, registerId, onCancel, onSuccess }: OpenSessionModalProps) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            fetchUsers();
        }
    }, [open]);

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/users');
            setUsers(data);
        } catch (error) {
            console.error('Error fetching users:', error);
            message.error('Error al cargar lista de usuarios');
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const dto: OpenSessionDto = {
                registerId,
                openingBalance: values.openingBalance,
                cashierId: values.cashierId,
                openingNotes: values.notes
            };

            await cashRegisterApi.openSession(dto);
            message.success('Caja abierta exitosamente');
            form.resetFields();
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error al abrir caja');
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
            title="Abrir Caja"
            open={open}
            onCancel={handleCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText="Abrir Caja"
            cancelText="Cancelar"
            width={500}
        >
            <Form
                form={form}
                layout="vertical"
                style={{ marginTop: 20 }}
            >
                <Form.Item
                    name="openingBalance"
                    label="Saldo Inicial"
                    rules={[
                        { required: true, message: 'Ingresa el saldo inicial' },
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
                    />
                </Form.Item>

                <Form.Item
                    name="cashierId"
                    label="Cajero Asignado"
                    rules={[{ required: true, message: 'Selecciona el cajero' }]}
                >
                    <Select placeholder="Seleccionar cajero">
                        {users.map(user => (
                            <Option key={user.id} value={user.username}>
                                {user.name} ({user.username})
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="notes"
                    label="Notas (opcional)"
                >
                    <TextArea
                        rows={3}
                        placeholder="Observaciones sobre la apertura..."
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};
