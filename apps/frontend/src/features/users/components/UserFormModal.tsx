import { Modal, Form, Input, Select, Checkbox, Row, Col, Typography, message, Switch, Divider } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { usersApi } from '../../../services/usersApi';

const { Text } = Typography;

interface UserFormModalProps {
    open: boolean;
    onCancel: () => void;
    user?: any; // If set, we are editing
}

const ROLES = [
    { label: 'Administrator', value: 'ADMIN' },
    { label: 'Supervisor', value: 'SUPERVISOR' },
    { label: 'Cashier', value: 'CASHIER' },
];

const PERMISSIONS = [
    {
        group: 'Sales & POS',
        options: [
            { label: 'POS Operations', value: 'MODULE_POS' },
            { label: 'View Sales History', value: 'VIEW_SALES' },
            { label: 'Manage Cash Drawer', value: 'MANAGE_CASH_REGISTER' },
            { label: 'Void Sales / Refunds', value: 'VOID_SALES' },
        ]
    },
    {
        group: 'Inventory Management',
        options: [
            { label: 'View Catalog', value: 'VIEW_PRODUCTS' },
            { label: 'Edit Products', value: 'EDIT_PRODUCTS' },
            { label: 'Inventory Adjustments', value: 'INVENTORY_ADJUSTMENTS' },
        ]
    },
    {
        group: 'Business Admin',
        options: [
            { label: 'Purchase Management', value: 'MODULE_PURCHASES' },
            { label: 'Expense Tracking', value: 'MODULE_EXPENSES' },
            { label: 'Advanced Reporting', value: 'MODULE_REPORTS' },
            { label: 'System Configuration', value: 'MODULE_CONFIG' },
        ]
    }
];

/**
 * UserFormModal Component
 * Form for creating and updating user accounts.
 * Includes security role selection, password management, and granular permission toggles.
 */
export const UserFormModal = ({ open, onCancel, user }: UserFormModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const isEdit = !!user;

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
            message.success(isEdit ? 'User account updated' : 'User account created');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            onCancel();
        },
        onError: (err: any) => {
            message.error(err?.response?.data?.message || 'Error saving user profile');
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
            title={isEdit ? "Edit User Profile" : "Register New System User"}
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            okText={isEdit ? "Update User (F9)" : "Create User (F9)"}
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
                            label="Username / Login"
                            rules={[{ required: true, message: 'Login username is required' }]}
                        >
                            <Input disabled={isEdit} placeholder="e.g., jsmith" />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="name"
                            label="Employee Full Name"
                            rules={[{ required: true, message: 'Please enter a name' }]}
                        >
                            <Input placeholder="John Smith" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={24}>
                    <Col span={12}>
                        <Form.Item
                            name="role"
                            label="Global Security Role"
                            rules={[{ required: true }]}
                        >
                            <Select options={ROLES} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="isActive"
                            label="Account Status"
                            valuePropName="checked"
                        >
                            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={24}>
                    <Col span={24}>
                        <Form.Item
                            name="password"
                            label={isEdit ? "New Password (Leave blank to keep current)" : "Password"}
                            rules={[
                                { required: !isEdit, message: 'Password is required' }, 
                                { min: 6, message: 'Minimum 6 characters for security' }
                            ]}
                        >
                            <Input.Password placeholder="******" />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider orientation="left">Granular Access Permissions</Divider>
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
