import { useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unitsApi } from '../../services/unitsApi';
import type { Unit, CreateUnitDto, UpdateUnitDto } from '../../services/unitsApi';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // Create mutation
    const createMutation = useMutation({
        mutationFn: unitsApi.create,
        onSuccess: () => {
            message.success(t('units.success_create'));
            queryClient.invalidateQueries({ queryKey: ['units'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('common.error'));
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateUnitDto }) =>
            unitsApi.update(id, dto),
        onSuccess: () => {
            message.success(t('units.success_update'));
            queryClient.invalidateQueries({ queryKey: ['units'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('common.error'));
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
            title={unit ? t('units.edit') : t('units.new')}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={unit ? `${t('common.save')} (F9)` : `${t('common.add')} (F9)`}
            cancelText={t('common.cancel')}
            forceRender
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Form.Item
                    label={t('units.name')}
                    name="name"
                    rules={[{ required: true, message: t('units.name_required') }]}
                >
                    <Input placeholder={t('units.name_placeholder')} />
                </Form.Item>

                <Form.Item
                    label={t('units.abbreviation')}
                    name="abbreviation"
                    rules={[{ required: true, message: t('units.abbreviation_required') }]}
                >
                    <Input placeholder={t('units.abbreviation_placeholder')} maxLength={10} />
                </Form.Item>
            </Form>
        </Modal>
    );
};
