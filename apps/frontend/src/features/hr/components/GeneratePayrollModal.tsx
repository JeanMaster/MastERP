import React, { useEffect } from 'react';
import { Modal, Form, Input, DatePicker, message, Select } from 'antd';
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
            message.success('Payroll generated successfully');
            queryClient.invalidateQueries({ queryKey: ['payroll-periods'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error('Error generating payroll: ' + (error.response?.data?.message || 'Unknown error'));
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
            title="Generate New Payroll"
            open={visible}
            onOk={handleOk}
            onCancel={onClose}
            confirmLoading={generateMutation.isPending}
            okText="Generate Payroll (F9)"
        >
            <Form form={form} layout="vertical">
                <Form.Item
                    name="name"
                    label="Period Name / Title"
                    rules={[{ required: true, message: 'Example: 1st Fortnight - December' }]}
                    initialValue={`Fortnight`}
                >
                    <Input placeholder="Example: 1st Fortnight - December 2025" />
                </Form.Item>

                <Form.Item name="frequency" label="Payment Group (Optional)">
                    <Select placeholder="Generate for all active employees" allowClear>
                        <Select.Option value="WEEKLY">Weekly Only</Select.Option>
                        <Select.Option value="BIWEEKLY">Biweekly / Fortnightly Only</Select.Option>
                        <Select.Option value="MONTHLY">Monthly Only</Select.Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    name="dates"
                    label="Date Range"
                    rules={[{ required: true, message: 'Please select start and end dates' }]}
                >
                    <DatePicker.RangePicker style={{ width: '100%' }} format="MM/DD/YYYY" />
                </Form.Item>

                <div style={{ color: '#666', fontSize: '13px', background: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
                    <p style={{ margin: 0 }}>
                        ℹ️ This will automatically generate payslips for all active employees in the selected group. 
                        For Biweekly payrolls, it typically calculates 50% of the monthly base salary.
                    </p>
                </div>
            </Form>
        </Modal>
    );
};
