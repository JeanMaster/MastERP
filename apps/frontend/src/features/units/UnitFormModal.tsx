import { useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unitsApi } from '../../services/unitsApi';
import type { Unit, CreateUnitDto, UpdateUnitDto } from '../../services/unitsApi';

interface UnitFormModalProps {
    open: boolean;
    unit: Unit | null;
    onClose: () => void;
}

export const UnitFormModal = ({ open, unit, onClose }: UnitFormModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // Create mutation
    const createMutation = useMutation({
        mutationFn: unitsApi.create,
        onSuccess: () => {
            message.success('Unidad creada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['units'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al crear unidad');
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateUnitDto }) =>
            unitsApi.update(id, dto),
        onSuccess: () => {
            message.success('Unidad actualizada exitosamente');
            queryClient.invalidateQueries({ queryKey: ['units'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al actualizar unidad');
        },
    });

    // Load form data when editing
    useEffect(() => {
        if (unit) {
            form.setFieldsValue({
                name: unit.name,
                abbreviation: unit.abbreviation,
            });
        } else {
            form.resetFields();
        }
    }, [unit, form]);

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
            const dto: CreateUnitDto = {
                name: values.name,
                abbreviation: values.abbreviation,
            };

            if (unit) {
                updateMutation.mutate({ id: unit.id, dto });
            } else {
                createMutation.mutate(dto);
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title={unit ? 'Editar Unidad' : 'Nueva Unidad'}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={unit ? 'Actualizar (F9)' : 'Crear (F9)'}
            cancelText="Cancelar"
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Form.Item
                    label="Nombre"
                    name="name"
                    rules={[{ required: true, message: 'El nombre es requerido' }]}
                >
                    <Input placeholder="Ej: Caja, Rollo, Kilogramo" />
                </Form.Item>

                <Form.Item
                    label="Abreviación"
                    name="abbreviation"
                    rules={[{ required: true, message: 'La abreviación es requerida' }]}
                >
                    <Input placeholder="Ej: CJA, RLL, KG" maxLength={10} />
                </Form.Item>
            </Form>
        </Modal>
    );
};
