import { useState } from 'react';
import { Table, Button, Typography, Tag, Card } from 'antd';
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { payrollApi } from '../services/payrollApi';
import type { PayrollPeriod } from '../services/payrollApi';
import { GeneratePayrollModal } from '../components/GeneratePayrollModal';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title } = Typography;

/**
 * PayrollPage Component
 * Main overview for Payroll management.
 * Displays a list of payroll periods (Weekly/Biweekly/Monthly), their processing status, and total amounts.
 */
export const PayrollPage = () => {
    const [isModalVisible, setIsModalVisible] = useState(false);
    const navigate = useNavigate();

    const { data: periods, isLoading } = useQuery({
        queryKey: ['payroll-periods'],
        queryFn: payrollApi.findAllPeriods,
    });

    const columns = [
        {
            title: 'Period Name',
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>
        },
        {
            title: 'From',
            dataIndex: 'startDate',
            key: 'startDate',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY')
        },
        {
            title: 'To',
            dataIndex: 'endDate',
            key: 'endDate',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY')
        },
        {
            title: 'Status',
            key: 'status',
            dataIndex: 'status',
            align: 'center' as const,
            render: (status: string) => {
                const colorMap: Record<string, string> = {
                    PAID: 'green',
                    PROCESSED: 'blue',
                    DRAFT: 'orange',
                    OPEN: 'cyan'
                };
                return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
            }
        },
        {
            title: 'Total Amount',
            key: 'total',
            dataIndex: 'totalAmount',
            align: 'right' as const,
            render: (amount: any) => <span>{amount ? Number(amount).toFixed(2) : '0.00'}</span>
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 150,
            render: (_: any, record: PayrollPeriod) => (
                <Button
                    icon={<UnorderedListOutlined />}
                    onClick={() => navigate(`/hr/payroll/${record.id}`)}
                >
                    View Details
                </Button>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                <Title level={2} style={{ margin: 0 }}>💰 Payroll History</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                    Generate New Payroll
                </Button>
            </div>

            <Card>
                <Table
                    columns={columns}
                    dataSource={periods}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{
                        showTotal: (total) => `Total: ${total} periods`
                    }}
                />
            </Card>

            <GeneratePayrollModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
            />
        </div>
    );
};
