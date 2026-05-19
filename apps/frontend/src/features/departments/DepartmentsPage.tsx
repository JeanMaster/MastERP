import { useState } from 'react';
import { Card, Table, Button, Space, Input, message, Popconfirm, Tag, Grid, List } from 'antd';
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
            title={!isMobile ? t('departments.title') : undefined}
            extra={!isMobile ? (
                <Space>
                    <Input
                        placeholder={t('departments.search_placeholder')}
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                        allowClear
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['departments'] })} />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                        {t('departments.new')}
                    </Button>
                </Space>
            ) : null}
        >
            {isMobile && (
                <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 20, marginBottom: 16 }}>📁 {t('departments.title')}</h2>
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Input
                            placeholder={t('departments.search_placeholder')}
                            prefix={<SearchOutlined />}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%' }}
                            size="large"
                            allowClear
                        />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAdd}
                                style={{ flex: 1 }}
                                size="large"
                            >
                                {t('departments.new')}
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => queryClient.invalidateQueries({ queryKey: ['departments'] })}
                                size="large"
                            />
                        </div>
                    </Space>
                </div>
            )}

            {!isMobile ? (
                <Table
                    columns={columns}
                    dataSource={treeData}
                    loading={isLoading}
                    pagination={false}
                    defaultExpandAllRows
                />
            ) : (
                <List
                    loading={isLoading}
                    dataSource={filteredData.sort((a, b) => {
                        // Sort so parents come before their children
                        if (!a.parentId && b.parentId === a.id) return -1;
                        if (!b.parentId && a.parentId === b.id) return 1;
                        return 0;
                    })}
                    renderItem={(item: Department) => (
                        <List.Item
                            onClick={() => handleEdit(item)}
                            style={{ 
                                padding: '16px', 
                                cursor: 'pointer',
                                background: '#fff',
                                marginBottom: 12,
                                borderRadius: 16,
                                border: '1px solid #f0f0f0',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                display: 'block',
                                marginLeft: item.parentId ? 20 : 0,
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            {item.parentId && (
                                <div style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 4,
                                    background: '#6366f1'
                                }} />
                            )}
                            <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <div style={{ 
                                            fontWeight: 700, 
                                            fontSize: 16, 
                                            color: '#111827'
                                        }}>
                                            {item.name}
                                        </div>
                                        <Tag color={item.parentId ? 'blue' : 'green'} style={{ fontSize: 10, margin: 0, borderRadius: 4 }}>
                                            {item.parentId ? t('departments.sub_department') : t('departments.main')}
                                        </Tag>
                                    </div>
                                    {item.description && (
                                        <div style={{ 
                                            fontSize: 13, 
                                            color: '#6b7280',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            lineHeight: '1.4'
                                        }}>
                                            {item.description}
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginLeft: 12, color: '#9ca3af' }}>
                                    <EditOutlined style={{ fontSize: 16 }} />
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
            )}

            <DepartmentFormModal
                open={isModalOpen}
                department={editingDepartment}
                onClose={handleModalClose}
            />
        </Card>
    );
};
