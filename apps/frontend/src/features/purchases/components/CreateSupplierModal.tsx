import React, { useEffect } from 'react';
import { Modal, Form, Input, Checkbox, Row, Col } from 'antd';
import type { CreateSupplierDto, Supplier } from '../../../services/suppliersApi';

interface CreateSupplierModalProps {
    visible: boolean;
    onCancel: () => void;
    onSubmit: (values: CreateSupplierDto) => Promise<void>;
    initialValues?: Supplier | null;
    loading?: boolean;
}

/**
 * CreateSupplierModal Component
 * Modal form to create or edit a supplier profile.
 */
export const CreateSupplierModal: React.FC<CreateSupplierModalProps> = ({
    visible,
    onCancel,
    onSubmit,
    initialValues,
    loading,
}) => {
    const [form] = Form.useForm();
    const isEditing = !!initialValues;

    // Load initial values or reset form
    useEffect(() => {
        if (visible) {
            if (initialValues) {
                form.setFieldsValue(initialValues);
            } else {
                form.resetFields();
                form.setFieldsValue({ active: true });
            }
        }
    }, [visible, initialValues, form]);

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
    }, [visible, form]);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            await onSubmit(values);
            form.resetFields();
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title={isEditing ? 'Edit Supplier' : 'New Supplier'}
            open={visible}
            onOk={handleOk}
            onCancel={onCancel}
            confirmLoading={loading}
            okText={isEditing ? 'Update (F9)' : 'Create (F9)'}
            cancelText="Cancel"
            width={700}
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{ active: true }}
            >
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="rif"
                            label="RIF (Tax ID)"
                            rules={[
                                { required: true, message: 'RIF is required' },
                                { min: 6, message: 'Minimum 6 characters' },
                            ]}
                        >
                            <Input placeholder="J-12345678-9" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="comercialName"
                            label="Commercial Name"
                            rules={[{ required: true, message: 'Name is required' }]}
                        >
                            <Input placeholder="Distribution Co." />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="legalName"
                    label="Legal Entity Name"
                >
                    <Input placeholder="Full legal name" />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="contactName"
                            label="Contact Person"
                        >
                            <Input placeholder="John Doe" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="phone"
                            label="Phone"
                        >
                            <Input placeholder="+58 412..." />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="email"
                            label="Email"
                            rules={[{ type: 'email', message: 'Invalid email' }]}
                        >
                            <Input placeholder="contact@supplier.com" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="category"
                            label="Category"
                        >
                            <Input placeholder="Food, Cleaning, etc." />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="address"
                    label="Address"
                >
                    <Input.TextArea rows={2} placeholder="Legal or delivery address" />
                </Form.Item>

                {isEditing && (
                    <Form.Item
                        name="active"
                        valuePropName="checked"
                    >
                        <Checkbox>Supplier Active</Checkbox>
                    </Form.Item>
                )}
            </Form>
        </Modal>
    );
};
