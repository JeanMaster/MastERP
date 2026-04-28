import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Switch, message, Divider } from 'antd';
import { employeesApi } from '../services/employeesApi';
import type { Employee } from '../services/employeesApi';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

interface Props {
    visible: boolean;
    onClose: () => void;
    employee?: Employee | null;
}

/**
 * EmployeeFormModal Component
 * Form modal for creating and updating employee profiles.
 * Tracks personal information, labor details, and payment configurations.
 */
export const EmployeeFormModal: React.FC<Props> = ({ visible, onClose, employee }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const isEditing = !!employee;

    useEffect(() => {
        if (visible) {
            if (employee) {
                form.setFieldsValue(employee);
            } else {
                form.resetFields();
                form.setFieldsValue({ isActive: true, currency: 'VES', paymentFrequency: 'BIWEEKLY' });
            }
        }
    }, [visible, employee, form]);

    const mutation = useMutation({
        mutationFn: (values: any) => {
            if (isEditing && employee) {
                return employeesApi.update(employee.id, values);
            }
            return employeesApi.create(values);
        },
        onSuccess: () => {
            message.success(t('hr.success_save'));
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            onClose();
        },
        onError: () => {
            message.error(t('hr.error_save'));
        }
    });

    // F9 Keyboard Shortcut for quick save
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
            mutation.mutate(values);
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title={isEditing ? t('hr.edit') : t('hr.new')}
            open={visible}
            onOk={handleOk}
            onCancel={onClose}
            confirmLoading={mutation.isPending}
            okText={`${t('common.save')} (F9)`}
            width={700}
        >
            <Form form={form} layout="vertical">
                <Divider orientation={"left" as any}>{t('hr.personal_info')}</Divider>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="firstName" label={t('common.first_name')} rules={[{ required: true, message: t('common.error') }]}>
                        <Input placeholder={t('hr.first_name_placeholder')} />
                    </Form.Item>
                    <Form.Item name="lastName" label={t('common.last_name')} rules={[{ required: true, message: t('common.error') }]}>
                        <Input placeholder={t('hr.last_name_placeholder')} />
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="identification" label={t('common.identification')} rules={[{ required: true, message: t('common.error') }]}>
                        <Input placeholder={t('hr.id_placeholder')} />
                    </Form.Item>
                    <Form.Item name="email" label={t('common.email')}>
                        <Input type="email" placeholder={t('hr.email_placeholder')} />
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="phone" label={t('common.phone')}>
                        <Input placeholder={t('hr.phone_placeholder')} />
                    </Form.Item>
                    <Form.Item name="address" label={t('common.address')}>
                        <Input placeholder={t('hr.address_placeholder')} />
                    </Form.Item>
                </div>

                <Divider orientation={"left" as any}>{t('hr.employment_details')}</Divider>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="position" label={t('common.position')} rules={[{ required: true, message: t('common.error') }]}>
                        <Input placeholder={t('hr.position_placeholder')} />
                    </Form.Item>
                    <Form.Item name="department" label={t('common.department')}>
                        <Input placeholder={t('hr.dept_placeholder')} />
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="paymentFrequency" label={t('hr.frequency')} rules={[{ required: true }]}>
                        <Select>
                            <Select.Option value="WEEKLY">{t('hr.weekly')}</Select.Option>
                            <Select.Option value="BIWEEKLY">{t('hr.biweekly')}</Select.Option>
                            <Select.Option value="MONTHLY">{t('hr.monthly')}</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="isActive" label={t('hr.status')} valuePropName="checked">
                        <Switch checkedChildren={t('hr.active')} unCheckedChildren={t('hr.inactive')} />
                    </Form.Item>
                </div>

                <Divider orientation={"left" as any}>{t('hr.compensation')}</Divider>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    <Form.Item name="baseSalary" label={t('common.salary')} rules={[{ required: true, message: t('common.error') }]}>
                        <InputNumber
                            style={{ width: '100%' }}
                            precision={2}
                            placeholder={t('hr.salary_placeholder')}
                            addonBefore={
                                <Form.Item name="currency" noStyle>
                                    <Select style={{ width: 100 }}>
                                        <Select.Option value="VES">Bs. (VES)</Select.Option>
                                        <Select.Option value="USD">$ (USD)</Select.Option>
                                    </Select>
                                </Form.Item>
                            }
                        />
                    </Form.Item>
                </div>
            </Form>
        </Modal>
    );
};
