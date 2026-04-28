import { useEffect } from 'react';
import { Modal, Form, Input, Select, Checkbox, message, Row, Col, Divider, DatePicker } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '../../services/clientsApi';
import type { Client, CreateClientDto } from '../../services/clientsApi';
import { WhatsAppOutlined, InstagramOutlined, FacebookOutlined, TwitterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

interface ClientFormModalProps {
    open: boolean;
    client: Client | null;
    onClose: () => void;
}

const { Option } = Select;

/**
 * ClientFormModal Component
 * Modal to create or edit a client record.
 * Handles the logic for splitting/combining ID prefixes (V, E, J, G) common in Venezuela.
 */
export const ClientFormModal = ({ open, client, onClose }: ClientFormModalProps) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const isEditing = !!client;

    // Create mutation
    const createMutation = useMutation({
        mutationFn: clientsApi.create,
        onSuccess: () => {
            message.success(t('clients.success_create'));
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            handleClose();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('clients.error_delete'));
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: CreateClientDto }) =>
            clientsApi.update(id, data),
        onSuccess: () => {
            message.success(t('clients.success_update'));
            queryClient.invalidateQueries({ queryKey: ['clients'] });
            handleClose();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('clients.error_delete'));
        },
    });

    // Initialize form with client data or defaults
    useEffect(() => {
        if (open) {
            if (client) {
                // Split ID (e.g., V-12345678) for prefix/number fields
                const [prefix, number] = client.id.split('-');
                form.setFieldsValue({
                    ...client,
                    idPrefix: prefix,
                    idNumber: number,
                    birthDate: client.birthDate ? dayjs(client.birthDate) : null,
                });
            } else {
                form.resetFields();
                form.setFieldsValue({ idPrefix: 'V', hasWhatsapp: false });
            }
        }
    }, [open, client, form]);

    const handleClose = () => {
        form.resetFields();
        onClose();
    };

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

            // Combine Prefix and Number for the primary ID
            const fullId = `${values.idPrefix}-${values.idNumber}`;

            const payload: CreateClientDto = {
                id: fullId,
                name: values.name,
                address: values.address,
                phone: values.phone,
                hasWhatsapp: values.hasWhatsapp,
                email: values.email,
                social1: values.social1,
                social2: values.social2,
                social3: values.social3,
                birthDate: values.birthDate ? values.birthDate.toISOString() : undefined,
            };

            if (isEditing) {
                updateMutation.mutate({ id: client.id, data: payload });
            } else {
                createMutation.mutate(payload);
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    return (
        <Modal
            title={isEditing ? t('clients.edit') : t('clients.new')}
            open={open}
            onOk={handleSubmit}
            onCancel={handleClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={isEditing ? `${t('common.save')} (F9)` : `${t('common.add')} (F9)`}
            cancelText={t('common.cancel')}
            width={700}
            centered
        >
            <Form
                form={form}
                layout="vertical"
                autoComplete="off"
            >
                <Row gutter={16} align="middle">
                    <Col span={6}>
                        <Form.Item
                            label={t('common.type')}
                            name="idPrefix"
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Select disabled={isEditing}>
                                <Option value="V">V ({t('common.person')})</Option>
                                <Option value="E">E</Option>
                                <Option value="J">J</Option>
                                <Option value="G">G</Option>
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={18}>
                        <Form.Item
                            label={t('clients.id')}
                            name="idNumber"
                            rules={[
                                { required: true, message: t('common.error') },
                                { pattern: /^\d+$/, message: t('common.error') }
                            ]}
                        >
                            <Input placeholder="12345678" disabled={isEditing} />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item
                    label={t('clients.name')}
                    name="name"
                    rules={[{ required: true, message: t('common.error') }]}
                >
                    <Input placeholder="John Doe / Example Corp S.A." />
                </Form.Item>

                <Form.Item
                    label={t('common.address')}
                    name="address"
                >
                    <Input.TextArea rows={2} placeholder={t('common.address') + '...'} />
                </Form.Item>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={t('clients.phone')}
                            name="phone"
                            style={{ marginBottom: 0 }}
                        >
                            <Input placeholder="0412-1234567" addonAfter={
                                <Form.Item name="hasWhatsapp" valuePropName="checked" noStyle>
                                    <Checkbox><WhatsAppOutlined style={{ color: 'green' }} /></Checkbox>
                                </Form.Item>
                            } />
                        </Form.Item>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 15 }}>{t('clients.send_whatsapp')}?</div>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            label={t('clients.email')}
                            name="email"
                            rules={[{ type: 'email', message: t('common.error') }]}
                        >
                            <Input placeholder="client@email.com" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            label={t('common.birth_date')}
                            name="birthDate"
                        >
                            <DatePicker 
                                style={{ width: '100%' }} 
                                placeholder="DD-MM-YYYY" 
                                format="DD-MM-YYYY"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider style={{ margin: '15px 0' }}>{t('clients.social_media')} ({t('common.optional')})</Divider>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="social1">
                            <Input prefix={<InstagramOutlined style={{ color: '#E1306C' }} />} placeholder="Instagram" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="social2">
                            <Input prefix={<FacebookOutlined style={{ color: '#4267B2' }} />} placeholder="Facebook" />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="social3">
                            <Input prefix={<TwitterOutlined />} placeholder="Twitter/X" />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </Modal>
    );
};
