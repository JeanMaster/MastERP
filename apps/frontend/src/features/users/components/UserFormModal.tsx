import { Modal, Form, Input, Select, Checkbox, Row, Col, Typography, App, Switch, Divider } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { usersApi } from '../../../services/usersApi';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface UserFormModalProps {
    open: boolean;
    onCancel: () => void;
    user?: any; // If set, we are editing
}

/**
 * UserFormModal Component
 * Form for creating and updating user accounts.
 * Includes security role selection, password management, and granular permission toggles.
 */
export const UserFormModal = ({ open, onCancel, user }: UserFormModalProps) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const isEdit = !!user;

    const ROLES = [
        { label: t('users.roles.admin'), value: 'ADMIN' },
        { label: t('users.roles.supervisor'), value: 'SUPERVISOR' },
        { label: t('users.roles.cashier'), value: 'CASHIER' },
    ];

    const PERMISSIONS = [
        {
            group: t('users.permissions.groups.sales'),
            options: [
                { label: t('users.permissions.options.pos'), value: 'MODULE_POS' },
                { label: t('users.permissions.options.view_sales'), value: 'VIEW_SALES' },
                { label: t('users.permissions.options.manage_cash'), value: 'MANAGE_CASH_REGISTER' },
                { label: t('users.permissions.options.void_sales'), value: 'VOID_SALES' },
            ]
        },
        {
            group: t('users.permissions.groups.inventory'),
            options: [
                { label: t('users.permissions.options.view_products'), value: 'VIEW_PRODUCTS' },
                { label: t('users.permissions.options.edit_products'), value: 'EDIT_PRODUCTS' },
                { label: t('users.permissions.options.inventory_adj'), value: 'INVENTORY_ADJUSTMENTS' },
            ]
        },
        {
            group: t('users.permissions.groups.admin'),
            options: [
                { label: t('users.permissions.options.purchases'), value: 'MODULE_PURCHASES' },
                { label: t('users.permissions.options.expenses'), value: 'MODULE_EXPENSES' },
                { label: t('users.permissions.options.reports'), value: 'MODULE_REPORTS' },
                { label: t('users.permissions.options.config'), value: 'MODULE_CONFIG' },
            ]
        }
    ];

    useEffect(() => {
        if (open) {
            if (user) {
                form.setFieldsValue({
                    ...user,
                    password: '', // Protect sensitive data
                });
            } else {
                form.resetFields();
            }
        }
    }, [open, user, form]);

    /**
     * Handles account creation/update logic.
     */
    const mutation = useMutation({
        mutationFn: (values: any) => {
            if (isEdit) {
                const updateData = { ...values };
                // Only send password if user explicitly entered a new one
                if (!updateData.password) delete updateData.password;
                return usersApi.update(user.id, updateData);
            } else {
                return usersApi.create(values);
            }
        },
        onSuccess: () => {
            message.success(isEdit ? t('users.success_update') : t('users.success_create'));
            queryClient.invalidateQueries({ queryKey: ['users'] });
            onCancel();
        },
        onError: (err: any) => {
            message.error(err?.response?.data?.message || t('common.error'));
        }
    });

    const handleSubmit = (values: any) => {
        mutation.mutate(values);
    };

    // F9 Keyboard Shortcut for quick submission
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                form.submit();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [open, form]);

    return (
        <Modal
            title={isEdit ? t('users.edit') : t('users.new')}
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            okText={isEdit ? `${t('common.save')} (F9)` : `${t('common.add')} (F9)`}
            width={700}
            confirmLoading={mutation.isPending}
            style={{ top: 20 }}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{ isActive: true, role: 'CASHIER', permissions: [] }}
                style={{ marginTop: 20 }}
            >
                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item
                            name="username"
                            label={t('common.username')}
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Input disabled={isEdit} placeholder="e.g., jsmith" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="name"
                            label={t('common.name')}
                            rules={[{ required: true, message: t('common.error') }]}
                        >
                            <Input placeholder="John Smith" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item
                            name="role"
                            label={t('common.role')}
                            rules={[{ required: true }]}
                        >
                            <Select options={ROLES} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="isActive"
                            label={t('common.status')}
                            valuePropName="checked"
                        >
                            <Switch checkedChildren={t('common.active')} unCheckedChildren={t('common.inactive')} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={24}>
                    <Col span={24}>
                        <Form.Item
                            name="password"
                            label={isEdit ? `${t('common.password')} (${t('common.no')} = keep)` : t('common.password')}
                            rules={[
                                { required: !isEdit, message: t('common.error') }, 
                                { min: 6, message: t('common.error') }
                            ]}
                        >
                            <Input.Password placeholder="******" />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider orientation={"left" as any}>{t('users.permissions.title')}</Divider>
                <Form.Item name="permissions">
                    <Checkbox.Group style={{ width: '100%' }}>
                        <Row gutter={[16, 24]}>
                            {PERMISSIONS.map(group => (
                                <Col span={24} key={group.group}>
                                    <Text strong style={{ display: 'block', marginBottom: 12, color: '#1890ff' }}>
                                        {group.group}
                                    </Text>
                                    <Row gutter={[8, 8]}>
                                        {group.options.map(option => (
                                            <Col span={12} key={option.value}>
                                                <Checkbox value={option.value}>{option.label}</Checkbox>
                                            </Col>
                                        ))}
                                    </Row>
                                    <Divider dashed style={{ margin: '16px 0' }} />
                                </Col>
                            ))}
                        </Row>
                    </Checkbox.Group>
                </Form.Item>
            </Form>
        </Modal>
    );
};
