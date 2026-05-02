import { useState } from 'react';
import { Table, Button, Space, Typography, Tag, Tooltip, Popconfirm, App } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { employeesApi } from '../services/employeesApi';
import type { Employee } from '../services/employeesApi';
import { EmployeeFormModal } from '../components/EmployeeFormModal';

const { Title } = Typography;

/**
 * EmployeesPage Component
 * Management dashboard for the workforce. 
 * Allows creating, updating, and deactivating (soft-deleting) employee profiles, tracking their salary, position, and payment frequency.
 */
export const EmployeesPage = () => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const queryClient = useQueryClient();

    const { data: employees, isLoading } = useQuery({
        queryKey: ['employees'],
        queryFn: employeesApi.findAll,
    });

    /**
     * Soft-deletes (deactivates) an employee record.
     */
    const deleteMutation = useMutation({
        mutationFn: employeesApi.remove,
        onSuccess: () => {
            message.success(t('hr.employees.messages.deactivate_success'));
            queryClient.invalidateQueries({ queryKey: ['employees'] });
        }
    });

    const handleCreate = () => {
        setEditingEmployee(null);
        setIsModalVisible(true);
    };

    const handleEdit = (record: Employee) => {
        setEditingEmployee(record);
        setIsModalVisible(true);
    };

    const handleDelete = (id: string) => {
        deleteMutation.mutate(id);
    };

    const columns = [
        {
            title: t('hr.employees.table.full_name'),
            key: 'name',
            render: (_: any, record: Employee) => (
                <Space>
                    <UserOutlined />
                    <span style={{ fontWeight: 'bold' }}>{record.firstName} {record.lastName}</span>
                </Space>
            )
        },
        {
            title: t('hr.employees.table.identification'),
            dataIndex: 'identification',
            key: 'identification',
        },
        {
            title: t('hr.employees.table.position'),
            dataIndex: 'position',
            key: 'position',
        },
        {
            title: t('hr.employees.table.department'),
            dataIndex: 'department',
            key: 'department',
        },
        {
            title: t('hr.employees.table.payment_frequency'),
            dataIndex: 'paymentFrequency',
            key: 'paymentFrequency',
            render: (freq: string) => {
                const map: any = { 
                    WEEKLY: t('hr.employees.frequencies.WEEKLY'), 
                    BIWEEKLY: t('hr.employees.frequencies.BIWEEKLY'), 
                    MONTHLY: t('hr.employees.frequencies.MONTHLY') 
                };
                return map[freq] || freq;
            }
        },
        {
            title: t('hr.employees.table.base_salary'),
            key: 'salary',
            align: 'right' as const,
            render: (_: any, record: Employee) => (
                <span>
                    <strong>{record.baseSalary}</strong> <small>{record.currency || 'VES'}</small>
                </span>
            )
        },
        {
            title: t('hr.employees.table.status'),
            key: 'status',
            align: 'center' as const,
            render: (_: any, record: Employee) => (
                <Tag color={record.isActive ? 'green' : 'red'}>
                    {record.isActive ? t('hr.active') : t('hr.inactive')}
                </Tag>
            )
        },
        {
            title: t('hr.employees.table.actions'),
            key: 'actions',
            width: 100,
            render: (_: any, record: Employee) => (
                <Space>
                    <Tooltip title={t('common.edit')}>
                        <Button
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title={t('hr.employees.messages.deactivate_confirm')}
                        description={t('hr.employees.messages.deactivate_desc')}
                        onConfirm={() => handleDelete(record.id)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                    >
                        <Button icon={<DeleteOutlined />} danger disabled={!record.isActive} />
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                <Title level={2} style={{ margin: 0 }}>👥 {t('hr.employees.title')}</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    {t('hr.employees.register_button')}
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={employees}
                rowKey="id"
                loading={isLoading}
                pagination={{
                    showTotal: (total) => t('hr.employees.messages.total_employees', { total })
                }}
            />

            <EmployeeFormModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                employee={editingEmployee}
            />
        </div>
    );
};
