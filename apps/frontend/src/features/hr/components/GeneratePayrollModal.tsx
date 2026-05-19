import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, message, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollApi } from '../services/payrollApi';

interface Props {
    visible: boolean;
    onClose: () => void;
}

/**
 * GeneratePayrollModal Component
 * Wizard for initializing a new payroll processing cycle.
 * It creates a time-bounded Period and automatically generates individual payment records for active employees based on the selected frequency.
 */
export const GeneratePayrollModal: React.FC<Props> = ({ visible, onClose }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    /**
     * Executes the payroll generation workflow:
     * 1. Creates the Payroll Period metadata.
     * 2. Triggers automatic calculation of payments for relevant employees.
     */
    const generateMutation = useMutation({
        mutationFn: async (values: any) => {
            // 1. Create Period
            const period = await payrollApi.createPeriod({
                name: values.name,
                startDate: values.dates[0].toISOString(),
                endDate: values.dates[1].toISOString(),
            });

            // 2. Generate Payments (Default for all active based on frequency)
            await payrollApi.generate({
                payrollPeriodId: period.id,
                frequency: values.frequency
            });

            return period;
        },
        onSuccess: () => {
            message.success(t('hr.payroll.success_generate'));
            queryClient.invalidateQueries({ queryKey: ['payroll-periods'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(t('hr.payroll.error_generate') + ': ' + (error.response?.data?.message || t('common.error')));
        }
    });

    // F9 Keyboard Shortcut for quick submission
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
            // Validation failed
        }
    };

    return (
        <Modal
            title={t('hr.payroll.generate_new')}
            open={visible}
            onOk={handleOk}
            onCancel={onClose}
            confirmLoading={generateMutation.isPending}
            okText={t('hr.payroll.generate_button_f9')}
            width={600}
            forceRender
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    name="name"
                    label={t('hr.payroll.period_name')}
                    rules={[{ required: true, message: t('hr.payroll.period_name_placeholder') }]}
                    initialValue={`Fortnight`}
                >
                    <Input placeholder={t('hr.payroll.period_name_placeholder')} />
                </Form.Item>

                <Form.Item name="frequency" label={t('hr.payroll.payment_group')}>
                    <Select placeholder={t('hr.payroll.all_active')} allowClear>
                        <Select.Option value="WEEKLY">{t('hr.payroll.weekly_only')}</Select.Option>
                        <Select.Option value="BIWEEKLY">{t('hr.payroll.biweekly_only')}</Select.Option>
                        <Select.Option value="MONTHLY">{t('hr.payroll.monthly_only')}</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="dates"
                    label={t('hr.payroll.date_range')}
                    rules={[{ required: true, message: t('hr.payroll.date_range_error') }]}
                >
                    <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>

                <div style={{ color: '#666', fontSize: '13px', background: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
                    <p style={{ margin: 0 }}>
                        ℹ️ {t('hr.payroll.info_desc')}
                    </p>
                </div>
            </Form>
        </Modal>
    );
};
