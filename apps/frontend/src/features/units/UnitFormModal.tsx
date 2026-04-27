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

/**
 * UnitFormModal Component
 * Modal form for creating or editing measurement units.
 */
export const UnitFormModal = ({ open, unit, onClose }: UnitFormModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // Create mutation
    const createMutation = useMutation({
        mutationFn: unitsApi.create,
        onSuccess: () => {
            message.success('Unit created successfully');
            queryClient.invalidateQueries({ queryKey: ['units'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error creating unit');
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateUnitDto }) =>
            unitsApi.update(id, dto),
        onSuccess: () => {
            message.success('Unit updated successfully');
            queryClient.invalidateQueries({ queryKey: ['units'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error updating unit');
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
    }, [unit, form, open]);

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
    }, [open, form]);

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
            title={unit ? 'Edit Unit' : 'New Unit'}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={unit ? 'Update (F9)' : 'Create (F9)'}
            cancelText="Cancel"
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Form.Item
                    label="Name"
                    name="name"
                    rules={[{ required: true, message: 'Name is required' }]}
                >
                    <Input placeholder="e.g., Box, Roll, Kilogram" />
                </Form.Item>

                <Form.Item
                    label="Abbreviation"
                    name="abbreviation"
                    rules={[{ required: true, message: 'Abbreviation is required' }]}
                >
                    <Input placeholder="e.g., BOX, RLL, KG" maxLength={10} />
                </Form.Item>
            </Form>
        </Modal>
    );
};
