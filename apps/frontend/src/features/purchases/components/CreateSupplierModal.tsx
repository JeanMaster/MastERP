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

export const CreateSupplierModal: React.FC<CreateSupplierModalProps> = ({
    visible,
    onCancel,
    onSubmit,
    initialValues,
    loading,
}) => {
    const [form] = Form.useForm();
    const isEditing = !!initialValues;

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
    }, [visible]);

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
            title={isEditing ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            open={visible}
            onOk={handleOk}
            onCancel={onCancel}
            confirmLoading={loading}
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
                            label="RIF"
                            rules={[
                                { required: true, message: 'El RIF es requerido' },
                                { min: 6, message: 'Mínimo 6 caracteres' },
                            ]}
                        >
                            <Input placeholder="J-12345678-9" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="comercialName"
                            label="Nombre Comercial"
                            rules={[{ required: true, message: 'El nombre es requerido' }]}
                        >
                            <Input placeholder="Distribuidora C.A." />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="legalName"
                    label="Razón Social"
                >
                    <Input placeholder="Razón Social Completa" />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="contactName"
                            label="Persona de Contacto"
                        >
                            <Input placeholder="Juan Pérez" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="phone"
                            label="Teléfono"
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
                            rules={[{ type: 'email', message: 'Email inválido' }]}
                        >
                            <Input placeholder="contacto@proveedor.com" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="category"
                            label="Categoría"
                        >
                            <Input placeholder="Alimentos, Limpieza, etc." />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="address"
                    label="Dirección"
                >
                    <Input.TextArea rows={2} placeholder="Dirección fiscal o de entrega" />
                </Form.Item>

                {isEditing && (
                    <Form.Item
                        name="active"
                        valuePropName="checked"
                    >
                        <Checkbox>Proveedor Activo</Checkbox>
                    </Form.Item>
                )}
            </Form>
        </Modal>
    );
};
