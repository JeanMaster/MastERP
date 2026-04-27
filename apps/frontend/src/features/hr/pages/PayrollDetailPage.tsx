import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { payrollApi } from '../services/payrollApi';
import { Typography, Card, Table, Button, Descriptions, Divider, Spin, Space, Tag } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

/**
 * PayrollDetailPage Component
 * Detailed view of a specific payroll period and its individual employee payments.
 * Displays aggregate period information and a breakdown of base salary, allowances (income), and deductions for each staff member.
 */
export const PayrollDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: period, isLoading } = useQuery({
        queryKey: ['payroll-period', id],
        queryFn: () => payrollApi.findOnePeriod(id!),
        enabled: !!id
    });

    if (isLoading) return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;
    if (!period) return <div style={{ padding: 50, textAlign: 'center' }}><Text type="danger">Payroll period not found</Text></div>;

    const columns = [
        {
            title: 'Employee',
            key: 'employee',
            render: (_: any, record: any) => (
                <Text strong>{record.employee.firstName} {record.employee.lastName}</Text>
            )
        },
        {
            title: 'Position',
            key: 'position',
            render: (_: any, record: any) => record.employee.position
        },
        {
            title: 'Base Salary',
            dataIndex: 'baseSalary',
            key: 'baseSalary',
            align: 'right' as const,
            render: (val: any) => <span>{Number(val).toFixed(2)}</span>
        },
        {
            title: 'Allowances',
            dataIndex: 'totalIncome',
            key: 'totalIncome',
            align: 'right' as const,
            render: (val: any) => <span style={{ color: '#52c41a' }}>{Number(val).toFixed(2)}</span>
        },
        {
            title: 'Deductions',
            dataIndex: 'totalDeductions',
            key: 'totalDeductions',
            align: 'right' as const,
            render: (val: any) => <span style={{ color: '#f5222d' }}>{Number(val).toFixed(2)}</span>
        },
        {
            title: 'Net Pay',
            dataIndex: 'netAmount',
            key: 'netAmount',
            align: 'right' as const,
            render: (val: any) => <Text strong>{Number(val).toFixed(2)}</Text>
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/app/hr/payroll')}
                style={{ marginBottom: 24 }}
            >
                Back to Payroll List
            </Button>

            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>{period.name}</Title>
                        <Text type="secondary">Payroll detail for the selected period</Text>
                    </div>
                    <Space>
                        <Button icon={<PrinterOutlined />}>Print All Payslips</Button>
                    </Space>
                </div>

                <Descriptions bordered size="small" column={2}>
                    <Descriptions.Item label="Start Date">{dayjs(period.startDate).format('MM/DD/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label="End Date">{dayjs(period.endDate).format('MM/DD/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label="Status">
                        <Tag color={period.status === 'PAID' ? 'green' : 'blue'}>{period.status}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Total Period Amount">
                        <Text strong style={{ fontSize: 18 }}>{Number(period.totalAmount).toFixed(2)} VES</Text>
                    </Descriptions.Item>
                </Descriptions>

                <Divider orientation={"left" as any}>Employee Payments Breakdown</Divider>

                <Table
                    columns={columns}
                    dataSource={period.payments || []}
                    rowKey="id"
                    pagination={false}
                    size="middle"
                />
            </Card>
        </div>
    );
};
