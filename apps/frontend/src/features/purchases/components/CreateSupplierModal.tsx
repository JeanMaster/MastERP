import React, { useEffect } from 'react';
import { Modal, Form, Input, Checkbox, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
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
            title={isEditing ? t('purchases.suppliers.edit') : t('purchases.suppliers.new')}
            open={visible}
            onOk={handleOk}
            onCancel={onCancel}
            confirmLoading={loading}
            okText={isEditing ? `${t('common.save')} (F9)` : `${t('common.add')} (F9)`}
            cancelText={t('common.cancel')}
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
                            label={t('purchases.suppliers.rif')}
                            rules={[
                                { required: true, message: t('purchases.suppliers.errors.rif_required') },
                                { min: 6, message: t('purchases.suppliers.errors.min_6') },
                            ]}
                        >
                            <Input placeholder={t('purchases.suppliers.rif_placeholder')} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="comercialName"
                            label={t('purchases.suppliers.comercial_name')}
                            rules={[{ required: true, message: t('purchases.suppliers.errors.name_required') }]}
                        >
                            <Input placeholder={t('purchases.suppliers.comercial_name_placeholder')} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="legalName"
                    label={t('purchases.suppliers.legal_name')}
                >
                    <Input placeholder={t('purchases.suppliers.legal_name_placeholder')} />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="contactName"
                            label={t('purchases.suppliers.contact_name')}
                        >
                            <Input placeholder={t('purchases.suppliers.contact_name_placeholder')} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="phone"
                            label={t('purchases.suppliers.phone')}
                        >
                            <Input placeholder={t('purchases.suppliers.phone_placeholder')} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="email"
                            label={t('purchases.suppliers.email')}
                            rules={[{ type: 'email', message: t('purchases.suppliers.errors.invalid_email') }]}
                        >
                            <Input placeholder={t('purchases.suppliers.email_placeholder')} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="category"
                            label={t('purchases.suppliers.category')}
                        >
                            <Input placeholder={t('purchases.suppliers.category_placeholder')} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    name="address"
                    label={t('purchases.suppliers.address')}
                >
                    <Input.TextArea rows={2} placeholder={t('purchases.suppliers.address_placeholder')} />
                </Form.Item>

                {isEditing && (
                    <Form.Item
                        name="active"
                        valuePropName="checked"
                    >
                        <Checkbox>{t('purchases.suppliers.active')}</Checkbox>
                    </Form.Item>
                )}
            </Form>
        </Modal>
    );
};
