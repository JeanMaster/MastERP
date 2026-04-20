import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, message, Select } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../services/payrollApi';


interface Props {
    visible: boolean;
    onClose: () => void;
}

export const GeneratePayrollModal: React.FC<Props> = ({ visible, onClose }) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    const generateMutation = useMutation({
        mutationFn: async (values: any) => {
            // 1. Create Period
            const period = await payrollApi.createPeriod({
                name: values.name,
                startDate: values.dates[0].toISOString(),
                endDate: values.dates[1].toISOString(),
            });

            // 2. Generate Payments (Default for all active)
            await payrollApi.generate({
                payrollPeriodId: period.id,
                frequency: values.frequency
            });

            return period;
        },
        onSuccess: () => {
            message.success('Nómina generada correctamente');
            queryClient.invalidateQueries({ queryKey: ['payroll-periods'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error('Error al generar nómina: ' + (error.response?.data?.message || 'Error desconocido'));
        }
    });

    // F9 Keyboard Shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!visible) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                handleOk();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [visible]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            generateMutation.mutate(values);
        } catch (error) {
            // validation error
        }
    };

    return (
        <Modal
            title="Generar Nueva Nómina"
            open={visible}
            onOk={handleOk}
            onCancel={onClose}
            confirmLoading={generateMutation.isPending}
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    name="name"
                    label="Nombre del Periodo"
                    rules={[{ required: true, message: 'Ej: Quincena 1 - Diciembre' }]}
                    initialValue={`Quincena`}
                >
                    <Input placeholder="Ej: Quincena 1 - Diciembre 2025" />
                </Form.Item>

                <Form.Item name="frequency" label="Grupo de Pago (Opcional)">
                    <Select placeholder="Generar para todos" allowClear>
                        <Select.Option value="WEEKLY">Semanal (Solo empleados semanales)</Select.Option>
                        <Select.Option value="BIWEEKLY">Quincenal (Solo empleados quincenales)</Select.Option>
                        <Select.Option value="MONTHLY">Mensual (Solo empleados mensuales)</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="dates"
                    label="Rango de Fechas"
                    rules={[{ required: true }]}
                >
                    <DatePicker.RangePicker style={{ width: '100%' }} />
                </Form.Item>

                <div style={{ color: '#666', fontSize: '13px' }}>
                    <p>ℹ️ Se generarán automáticamente los recibos para todos los empleados activos tomando el 50% de su sueldo base (Quincenal).</p>
                </div>
            </Form>
        </Modal>
    );
};
