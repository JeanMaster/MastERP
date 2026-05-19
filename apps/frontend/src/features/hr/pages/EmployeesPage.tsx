import { useState } from 'react';
import { Table, Button, Space, Typography, Tag, Tooltip, Popconfirm, App, Grid, List } from 'antd';
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

    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>👥 {t('hr.employees.title')}</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    {isMobile ? undefined : t('hr.employees.register_button')}
                </Button>
            </div>

            {!isMobile ? (
                <Table
                    columns={columns}
                    dataSource={employees}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{
                        showTotal: (total) => t('hr.employees.messages.total_employees', { total })
                    }}
                />
            ) : (
                <List
                    loading={isLoading}
                    dataSource={employees}
                    rowKey="id"
                    pagination={{ pageSize: 10, size: 'small', simple: true }}
                    renderItem={(item: Employee) => (
                        <List.Item
                            style={{
                                padding: '16px',
                                background: '#fff',
                                marginBottom: 12,
                                borderRadius: 16,
                                border: '1px solid #f0f0f0',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                display: 'block'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div onClick={() => handleEdit(item)} style={{ cursor: 'pointer' }}>
                                    <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>
                                        {item.firstName} {item.lastName}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                                        {item.position} • {item.department}
                                    </div>
                                </div>
                                <Tag color={item.isActive ? 'green' : 'red'} style={{ margin: 0 }}>
                                    {item.isActive ? t('hr.active') : t('hr.inactive')}
                                </Tag>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase' }}>{t('hr.employees.table.identification')}</div>
                                    <div style={{ fontSize: 14 }}>{item.identification}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase' }}>{t('hr.employees.table.base_salary')}</div>
                                    <div style={{ fontWeight: 600, fontSize: 16 }}>
                                        {item.baseSalary} <small>{item.currency || 'VES'}</small>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                                <div style={{ fontSize: 13, color: '#595959' }}>
                                    {t('hr.employees.table.payment_frequency')}: {
                                        item.paymentFrequency === 'WEEKLY' ? t('hr.employees.frequencies.WEEKLY') :
                                        item.paymentFrequency === 'BIWEEKLY' ? t('hr.employees.frequencies.BIWEEKLY') :
                                        t('hr.employees.frequencies.MONTHLY')
                                    }
                                </div>
                                <Space>
                                    <Button
                                        icon={<EditOutlined style={{ color: '#6366f1' }} />}
                                        onClick={() => handleEdit(item)}
                                        type="text"
                                    />
                                    <Popconfirm
                                        title={t('hr.employees.messages.deactivate_confirm')}
                                        onConfirm={() => handleDelete(item.id)}
                                        okText={t('common.yes')}
                                        cancelText={t('common.no')}
                                    >
                                        <Button 
                                            icon={<DeleteOutlined style={{ color: '#ef4444' }} />} 
                                            type="text"
                                            disabled={!item.isActive} 
                                        />
                                    </Popconfirm>
                                </Space>
                            </div>
                        </List.Item>
                    )}
                />
            )}

            <EmployeeFormModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                employee={editingEmployee}
            />
        </div>
    );
};
