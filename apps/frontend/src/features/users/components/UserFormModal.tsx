import { Modal, Form, Input, Select, Checkbox, Row, Col, Typography, message, Switch, Divider } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect } from 'react';
import { BASE_URL } from '../../../services/apiConfig';

const { Text } = Typography;
const API_URL = BASE_URL;

interface UserFormModalProps {
    open: boolean;
    onCancel: () => void;
    user?: any; // If set, we are editing
}

const ROLES = [
    { label: 'Administrador', value: 'ADMIN' },
    { label: 'Supervisor', value: 'SUPERVISOR' },
    { label: 'Cajero', value: 'CASHIER' },
];

const PERMISSIONS = [
    {
        group: 'Ventas',
        options: [
            { label: 'Vender (POS)', value: 'MODULE_POS' },
            { label: 'Ver Historial', value: 'VIEW_SALES' },
            { label: 'Gestionar Caja', value: 'MANAGE_CASH_REGISTER' },
            { label: 'Anular Ventas', value: 'VOID_SALES' },
        ]
    },
    {
        group: 'Inventario',
        options: [
            { label: 'Ver Productos', value: 'VIEW_PRODUCTS' },
            { label: 'Editar Productos', value: 'EDIT_PRODUCTS' },
            { label: 'Ajustes de Inventario', value: 'INVENTORY_ADJUSTMENTS' },
        ]
    },
    {
        group: 'Administración',
        options: [
            { label: 'Compras', value: 'MODULE_PURCHASES' },
            { label: 'Gastos', value: 'MODULE_EXPENSES' },
            { label: 'Reportes', value: 'MODULE_REPORTS' },
            { label: 'Configuración', value: 'MODULE_CONFIG' },
        ]
    }
];

export const UserFormModal = ({ open, onCancel, user }: UserFormModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const isEdit = !!user;

    useEffect(() => {
        if (open) {
            if (user) {
                form.setFieldsValue({
                    ...user,
                    password: '', // Don't show hash
                });
            } else {
                form.resetFields();
            }
        }
    }, [open, user, form]);

    const mutation = useMutation({
        mutationFn: async (values: any) => {
            if (isEdit) {
                // Only send password if provided
                const updateData = { ...values };
                if (!updateData.password) delete updateData.password;
                return axios.patch(`${API_URL}/users/${user.id}`, updateData);
            } else {
                return axios.post(`${API_URL}/users`, values);
            }
        },
        onSuccess: () => {
            message.success(isEdit ? 'Usuario actualizado' : 'Usuario creado');
            queryClient.invalidateQueries({ queryKey: ['users'] });
            onCancel();
        },
        onError: () => {
            message.error('Error al guardar usuario');
        }
    });

    const handleSubmit = (values: any) => {
        mutation.mutate(values);
    };

    // F9 Keyboard Shortcut
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
            title={isEdit ? "Editar Usuario" : "Nuevo Usuario"}
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            okText={isEdit ? "Guardar (F9)" : "Crear (F9)"}
            width={700}
            confirmLoading={mutation.isPending}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{ isActive: true, role: 'CASHIER', permissions: [] }}
            >
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="username"
                            label="Usuario"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Input disabled={isEdit} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="name"
                            label="Nombre Completo"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Input />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="role"
                            label="Rol"
                            rules={[{ required: true, message: 'Requerido' }]}
                        >
                            <Select options={ROLES} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="isActive"
                            label="Estado"
                            valuePropName="checked"
                        >
                            <Switch checkedChildren="Activo" unCheckedChildren="Inactivo" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="password"
                            label={isEdit ? "Contraseña (déjalo vacío para no cambiar)" : "Contraseña"}
                            rules={[{ required: !isEdit, message: 'Requerido' }, { min: 6, message: 'Mínimo 6 caracteres' }]}
                        >
                            <Input.Password />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider>Permisos Adicionales</Divider>
                <Form.Item name="permissions">
                    <Checkbox.Group style={{ width: '100%' }}>
                        <Row gutter={[16, 16]}>
                            {PERMISSIONS.map(group => (
                                <Col span={24} key={group.group}>
                                    <Text strong>{group.group}</Text>
                                    <Row>
                                        {group.options.map(option => (
                                            <Col span={12} key={option.value}>
                                                <Checkbox value={option.value}>{option.label}</Checkbox>
                                            </Col>
                                        ))}
                                    </Row>
                                    <div style={{ height: 10 }} />
                                </Col>
                            ))}
                        </Row>
                    </Checkbox.Group>
                </Form.Item>
            </Form>
        </Modal>
    );
};
