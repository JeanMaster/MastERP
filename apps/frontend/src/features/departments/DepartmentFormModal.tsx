import { useEffect } from 'react';
import { Modal, Form, Input, TreeSelect, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { departmentsApi } from '../../services/departmentsApi';
import type { Department, CreateDepartmentDto, UpdateDepartmentDto } from '../../services/departmentsApi';

interface DepartmentFormModalProps {
    open: boolean;
    department: Department | null;
    onClose: () => void;
}

export const DepartmentFormModal = ({ open, department, onClose }: DepartmentFormModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // Fetch all departments for parent selection
    const { data: departments = [] } = useQuery({
        queryKey: ['departments'],
        queryFn: departmentsApi.getAll,
        enabled: open,
    });

    // Create mutation
    const createMutation = useMutation({
        mutationFn: departmentsApi.create,
        onSuccess: () => {
            message.success('Departamento creado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al crear departamento');
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateDepartmentDto }) =>
            departmentsApi.update(id, dto),
        onSuccess: () => {
            message.success('Departamento actualizado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al actualizar departamento');
        },
    });

    // Load form data when editing
    useEffect(() => {
        if (department) {
            form.setFieldsValue({
                name: department.name,
                description: department.description,
                parentId: department.parentId,
            });
        } else {
            form.resetFields();
        }
    }, [department, form]);

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
    }, [open]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            const dto: CreateDepartmentDto = {
                name: values.name,
                description: values.description,
                parentId: values.parentId || undefined,
            };

            if (department) {
                updateMutation.mutate({ id: department.id, dto });
            } else {
                createMutation.mutate(dto);
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    // Build tree data for TreeSelect (only show root departments as options)
    const buildTreeData = () => {
        // Solo mostrar departamentos principales (sin padre)
        const rootDepts = departments.filter(d => !d.parentId);

        // Si estamos editando, excluir el propio departamento y sus hijos
        let filteredDepts = rootDepts;
        if (department) {
            filteredDepts = rootDepts.filter(d =>
                d.id !== department.id &&
                d.parentId !== department.id
            );
        }

        return filteredDepts.map(dept => ({
            value: dept.id,
            title: dept.name,
            disabled: false,
        }));
    };

    const treeData = buildTreeData();

    return (
        <Modal
            title={department ? 'Editar Departamento' : 'Nuevo Departamento'}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={department ? 'Actualizar (F9)' : 'Crear (F9)'}
            cancelText="Cancelar"
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Form.Item
                    label="Nombre"
                    name="name"
                    rules={[{ required: true, message: 'El nombre es requerido' }]}
                >
                    <Input placeholder="Ej: Ferretería" />
                </Form.Item>

                <Form.Item label="Descripción" name="description">
                    <Input.TextArea rows={3} placeholder="Descripción del departamento..." />
                </Form.Item>

                <Form.Item
                    label="Departamento Padre (Opcional)"
                    name="parentId"
                    help="Solo se permiten 2 niveles: Principal → Subdepartamento"
                >
                    <TreeSelect
                        placeholder="Seleccionar departamento padre"
                        allowClear
                        treeData={treeData}
                        showSearch
                        treeNodeFilterProp="title"
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};
