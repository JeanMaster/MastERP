import React, { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, Switch, message, Divider } from 'antd';
import { employeesApi } from '../services/employeesApi';
import type { Employee } from '../services/employeesApi';
import { useQueryClient, useMutation } from '@tanstack/react-query';

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
            message.success(`Employee ${isEditing ? 'updated' : 'created'} successfully`);
            queryClient.invalidateQueries({ queryKey: ['employees'] });
            onClose();
        },
        onError: () => {
            message.error('Error saving employee profile');
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
            title={isEditing ? 'Edit Employee Profile' : 'Register New Employee'}
            open={visible}
            onOk={handleOk}
            onCancel={onClose}
            confirmLoading={mutation.isPending}
            okText="Save Profile (F9)"
            width={700}
        >
            <Form form={form} layout="vertical">
                <Divider orientation="left">Personal Information</Divider>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="firstName" label="First Names" rules={[{ required: true, message: 'Please enter first names' }]}>
                        <Input placeholder="John" />
                    </Form.Item>
                    <Form.Item name="lastName" label="Last Names" rules={[{ required: true, message: 'Please enter last names' }]}>
                        <Input placeholder="Doe" />
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="identification" label="Tax ID / Identification (RIF/CI)" rules={[{ required: true, message: 'ID is required' }]}>
                        <Input placeholder="V-12345678" />
                    </Form.Item>
                    <Form.Item name="email" label="Email Address">
                        <Input type="email" placeholder="john.doe@example.com" />
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="phone" label="Phone Number">
                        <Input placeholder="+58 412..." />
                    </Form.Item>
                    <Form.Item name="address" label="Home Address">
                        <Input placeholder="Full address..." />
                    </Form.Item>
                </div>

                <Divider orientation="left">Employment Details</Divider>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="position" label="Position / Job Title" rules={[{ required: true, message: 'Position is required' }]}>
                        <Input placeholder="Sales Representative" />
                    </Form.Item>
                    <Form.Item name="department" label="Department">
                        <Input placeholder="Sales / Operations" />
                    </Form.Item>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Form.Item name="paymentFrequency" label="Payment Frequency" rules={[{ required: true }]}>
                        <Select>
                            <Select.Option value="WEEKLY">Weekly</Select.Option>
                            <Select.Option value="BIWEEKLY">Biweekly (Fortnightly)</Select.Option>
                            <Select.Option value="MONTHLY">Monthly</Select.Option>
                        </Select>
                    </Form.Item>
                    <Form.Item name="isActive" label="Employment Status" valuePropName="checked">
                        <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                    </Form.Item>
                </div>

                <Divider orientation="left">Compensation</Divider>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                    <Form.Item name="baseSalary" label="Monthly Base Salary" rules={[{ required: true, message: 'Please enter base salary' }]}>
                        <InputNumber
                            style={{ width: '100%' }}
                            precision={2}
                            placeholder="0.00"
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
