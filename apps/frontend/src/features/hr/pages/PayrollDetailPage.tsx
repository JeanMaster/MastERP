import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { payrollApi } from '../services/payrollApi';
import { Typography, Card, Table, Button, Descriptions, Divider, Spin, Space, Tag, Grid, List } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

/**
 * PayrollDetailPage Component
 * Detailed view of a specific payroll period and its individual employee payments.
 * Displays aggregate period information and a breakdown of base salary, allowances (income), and deductions for each staff member.
 */
export const PayrollDetailPage = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: period, isLoading } = useQuery({
        queryKey: ['payroll-period', id],
        queryFn: () => payrollApi.findOnePeriod(id!),
        enabled: !!id
    });

    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;

    if (isLoading) return <div style={{ padding: 50, textAlign: 'center' }}><Spin size="large" /></div>;
    if (!period) return <div style={{ padding: 50, textAlign: 'center' }}><Text type="danger">{t('hr.payroll.detail.not_found')}</Text></div>;

    const columns = [
        {
            title: t('hr.payroll.detail.employee_col'),
            key: 'employee',
            render: (_: any, record: any) => (
                <Text strong>{record.employee.firstName} {record.employee.lastName}</Text>
            )
        },
        {
            title: t('hr.payroll.detail.position_col'),
            key: 'position',
            render: (_: any, record: any) => record.employee.position
        },
        {
            title: t('hr.payroll.detail.salary_col'),
            dataIndex: 'baseSalary',
            key: 'baseSalary',
            align: 'right' as const,
            render: (val: any) => <span>{Number(val).toFixed(2)}</span>
        },
        {
            title: t('hr.payroll.detail.allowances_col'),
            dataIndex: 'totalIncome',
            key: 'totalIncome',
            align: 'right' as const,
            render: (val: any) => <span style={{ color: '#52c41a' }}>{Number(val).toFixed(2)}</span>
        },
        {
            title: t('hr.payroll.detail.deductions_col'),
            dataIndex: 'totalDeductions',
            key: 'totalDeductions',
            align: 'right' as const,
            render: (val: any) => <span style={{ color: '#f5222d' }}>{Number(val).toFixed(2)}</span>
        },
        {
            title: t('hr.payroll.detail.net_pay_col'),
            dataIndex: 'netAmount',
            key: 'netAmount',
            align: 'right' as const,
            render: (val: any) => <Text strong>{Number(val).toFixed(2)}</Text>
        }
    ];



    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/app/hr/payroll')}
                style={{ marginBottom: isMobile ? 16 : 24 }}
                size={isMobile ? 'small' : undefined}
            >
                {t('hr.payroll.detail.back_button')}
            </Button>

            <Card styles={{ body: { padding: isMobile ? 12 : 24 } }}>
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: 24, gap: 16 }}>
                    <div>
                        <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>{period.name}</Title>
                        <Text type="secondary">{t('hr.payroll.detail.period_subtitle')}</Text>
                    </div>
                    <Space style={{ width: isMobile ? '100%' : 'auto' }}>
                        <Button icon={<PrinterOutlined />} block={isMobile}>{t('hr.payroll.detail.print_payslips')}</Button>
                    </Space>
                </div>

                <Descriptions bordered size="small" column={isMobile ? 1 : 2}>
                    <Descriptions.Item label={t('hr.payroll.detail.start_date')}>{dayjs(period.startDate).format('DD/MM/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label={t('hr.payroll.detail.end_date')}>{dayjs(period.endDate).format('DD/MM/YYYY')}</Descriptions.Item>
                    <Descriptions.Item label={t('hr.payroll.table.status')}>
                        <Tag color={period.status === 'PAID' ? 'green' : 'blue'} style={{ margin: 0 }}>
                            {t(`hr.payroll.statuses.${period.status}`, { defaultValue: period.status })}
                        </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('hr.payroll.detail.total_period')}>
                        <Text strong style={{ fontSize: isMobile ? 16 : 18 }}>{Number(period.totalAmount).toFixed(2)} VES</Text>
                    </Descriptions.Item>
                </Descriptions>

                <Divider orientation={"left" as any}>{t('hr.payroll.detail.breakdown_divider')}</Divider>

                {!isMobile ? (
                    <Table
                        columns={columns}
                        dataSource={period.payments || []}
                        rowKey="id"
                        pagination={false}
                        size="middle"
                    />
                ) : (
                    <List
                        dataSource={period.payments || []}
                        rowKey="id"
                        renderItem={(item: any) => (
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
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontWeight: 700, fontSize: 16 }}>{item.employee.firstName} {item.employee.lastName}</div>
                                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>{item.employee.position}</div>
                                </div>

                                <div style={{ background: '#f9fafb', padding: '12px', borderRadius: 12, marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text type="secondary" style={{ fontSize: 13 }}>{t('hr.payroll.detail.salary_col')}</Text>
                                        <Text style={{ fontSize: 13 }}>{Number(item.baseSalary).toFixed(2)}</Text>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <Text type="secondary" style={{ fontSize: 13 }}>{t('hr.payroll.detail.allowances_col')}</Text>
                                        <Text style={{ fontSize: 13, color: '#52c41a' }}>+{Number(item.totalIncome).toFixed(2)}</Text>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text type="secondary" style={{ fontSize: 13 }}>{t('hr.payroll.detail.deductions_col')}</Text>
                                        <Text style={{ fontSize: 13, color: '#f5222d' }}>-{Number(item.totalDeductions).toFixed(2)}</Text>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text strong style={{ fontSize: 14 }}>{t('hr.payroll.detail.net_pay_col')}</Text>
                                    <Text strong style={{ fontSize: 18, color: '#111827' }}>{Number(item.netAmount).toFixed(2)} VES</Text>
                                </div>
                            </List.Item>
                        )}
                    />
                )}
            </Card>
        </div>
    );
};
