import { useState } from 'react';
import { Table, Button, Space, Typography, Tag, Tooltip, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
            message.success('Employee deactivated successfully');
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
            title: 'Full Name',
            key: 'name',
            render: (_: any, record: Employee) => (
                <Space>
                    <UserOutlined />
                    <span style={{ fontWeight: 'bold' }}>{record.firstName} {record.lastName}</span>
                </Space>
            )
        },
        {
            title: 'ID Number',
            dataIndex: 'identification',
            key: 'identification',
        },
        {
            title: 'Position',
            dataIndex: 'position',
            key: 'position',
        },
        {
            title: 'Department',
            dataIndex: 'department',
            key: 'department',
        },
        {
            title: 'Payment Frequency',
            dataIndex: 'paymentFrequency',
            key: 'paymentFrequency',
            render: (freq: string) => {
                const map: any = { 
                    WEEKLY: 'Weekly', 
                    BIWEEKLY: 'Biweekly', 
                    MONTHLY: 'Monthly' 
                };
                return map[freq] || freq;
            }
        },
        {
            title: 'Base Salary',
            key: 'salary',
            align: 'right' as const,
            render: (_: any, record: Employee) => (
                <span>
                    <strong>{record.baseSalary}</strong> <small>{record.currency || 'VES'}</small>
                </span>
            )
        },
        {
            title: 'Status',
            key: 'status',
            align: 'center' as const,
            render: (_: any, record: Employee) => (
                <Tag color={record.isActive ? 'green' : 'red'}>
                    {record.isActive ? 'Active' : 'Inactive'}
                </Tag>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 100,
            render: (_: any, record: Employee) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button
                            icon={<EditOutlined />}
                            onClick={() => handleEdit(record)}
                        />
                    </Tooltip>
                    <Popconfirm
                        title="Deactivate employee profile?"
                        description="This will mark the employee as inactive."
                        onConfirm={() => handleDelete(record.id)}
                        okText="Yes"
                        cancelText="No"
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
                <Title level={2} style={{ margin: 0 }}>👥 Employee Management</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    Register New Employee
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={employees}
                rowKey="id"
                loading={isLoading}
                pagination={{
                    showTotal: (total) => `Total: ${total} employees`
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
