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

/**
 * DepartmentFormModal Component
 * Modal form for creating or editing departments.
 * Supports hierarchical assignment with a 2-level limit.
 */
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
            message.success('Department created successfully');
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error creating department');
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateDepartmentDto }) =>
            departmentsApi.update(id, dto),
        onSuccess: () => {
            message.success('Department updated successfully');
            queryClient.invalidateQueries({ queryKey: ['departments'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error updating department');
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
    }, [department, form, open]);

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

    /**
     * Builds tree data for TreeSelect, excluding current department to prevent self-parenting.
     */
    const buildTreeData = () => {
        // Only show root departments as options (1 level of parents)
        const rootDepts = departments.filter(d => !d.parentId);

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
            title={department ? 'Edit Department' : 'New Department'}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={department ? 'Update (F9)' : 'Create (F9)'}
            cancelText="Cancel"
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Form.Item
                    label="Name"
                    name="name"
                    rules={[{ required: true, message: 'Name is required' }]}
                >
                    <Input placeholder="e.g., Hardware" />
                </Form.Item>

                <Form.Item label="Description" name="description">
                    <Input.TextArea rows={3} placeholder="Department description..." />
                </Form.Item>

                <Form.Item
                    label="Parent Department (Optional)"
                    name="parentId"
                    help="Only 2 levels allowed: Main → Sub-department"
                >
                    <TreeSelect
                        placeholder="Select parent department"
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
