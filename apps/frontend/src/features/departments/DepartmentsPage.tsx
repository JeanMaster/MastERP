import { useState } from 'react';
import { Card, Table, Button, Space, Input, message, Popconfirm, Tag, Grid } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { departmentsApi } from '../../services/departmentsApi';
import type { Department } from '../../services/departmentsApi';
import { DepartmentFormModal } from './DepartmentFormModal';

const { useBreakpoint } = Grid;

/**
 * DepartmentsPage Component
 * Management interface for organizational departments and sub-departments.
 * Displays data in a hierarchical tree structure (2 levels deep).
 */
export const DepartmentsPage = () => {
    const { t } = useTranslation();
    const screens = useBreakpoint();
    const isMobile = !screens.lg;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const queryClient = useQueryClient();

    // Fetch departments
    const { data: departments = [], isLoading } = useQuery({
        queryKey: ['departments'],
        queryFn: departmentsApi.getAll,
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: departmentsApi.delete,
        onSuccess: () => {
            message.success(t('departments.success_delete'));
            queryClient.invalidateQueries({ queryKey: ['departments'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('departments.error_delete'));
        },
    });

    const handleAdd = () => {
        setEditingDepartment(null);
        setIsModalOpen(true);
    };

    const handleEdit = (department: Department) => {
        setEditingDepartment(department);
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setEditingDepartment(null);
    };

    // Client-side filtering
    const filteredData = departments.filter((dept) =>
        dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dept.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    /**
     * Builds a tree structure for the Ant Design table.
     * Currently supports up to 2 levels of hierarchy.
     */
    const buildTree = (depts: Department[]): any[] => {
        const parents = depts.filter(d => !d.parentId);
        return parents.map(parent => ({
            key: parent.id,
            ...parent,
            children: depts
                .filter(d => d.parentId === parent.id)
                .map(child => ({
                    key: child.id,
                    ...child,
                    children: undefined, // Supports 2 levels only
                })),
        }));
    };

    const treeData = buildTree(filteredData);

    const columns = [
        {
            title: t('departments.name'),
            dataIndex: 'name',
            key: 'name',
            width: '30%',
        },
        {
            title: t('departments.description'),
            dataIndex: 'description',
            key: 'description',
            width: '35%',
        },
        {
            title: t('departments.type'),
            key: 'type',
            width: '15%',
            render: (_: any, record: Department) => (
                <Tag color={record.parentId ? 'blue' : 'green'}>
                    {record.parentId ? t('departments.sub_department') : t('departments.main')}
                </Tag>
            ),
        },
        {
            title: t('departments.actions'),
            key: 'actions',
            width: '20%',
            render: (_: any, record: Department) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        {t('common.edit')}
                    </Button>
                    <Popconfirm
                        title={t('departments.delete_confirm')}
                        description={t('departments.delete_desc')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('common.delete')}
                        cancelText={t('common.cancel')}
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            {t('common.delete')}
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={t('departments.title')}
            extra={
                <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }} align={isMobile ? 'end' : 'center'}>
                    <Input
                        placeholder={t('departments.search_placeholder')}
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: isMobile ? '100%' : 250 }}
                    />
                    <Space>
                        <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['departments'] })} />
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                            {isMobile ? t('common.new') : t('departments.new')}
                        </Button>
                    </Space>
                </Space>
            }
        >
            <Table
                columns={columns}
                dataSource={treeData}
                loading={isLoading}
                pagination={false}
                defaultExpandAllRows
                scroll={{ x: 'max-content' }}
            />

            <DepartmentFormModal
                open={isModalOpen}
                department={editingDepartment}
                onClose={handleModalClose}
            />
        </Card>
    );
};
