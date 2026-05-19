import { useState } from 'react';
import { Table, Button, Typography, Tag, Card, Grid, List } from 'antd';
import { PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const navigate = useNavigate();

    const { data: periods, isLoading } = useQuery({
        queryKey: ['payroll-periods'],
        queryFn: payrollApi.findAllPeriods,
    });

    const columns = [
        {
            title: t('hr.payroll.table.period_name'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string) => <span style={{ fontWeight: 500 }}>{text}</span>
        },
        {
            title: t('hr.payroll.table.from'),
            dataIndex: 'startDate',
            key: 'startDate',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY')
        },
        {
            title: t('hr.payroll.table.to'),
            dataIndex: 'endDate',
            key: 'endDate',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY')
        },
        {
            title: t('hr.payroll.table.status'),
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
                const statusLabel = t(`hr.payroll.statuses.${status}`, { defaultValue: status });
                return <Tag color={colorMap[status] || 'default'}>{statusLabel}</Tag>;
            }
        },
        {
            title: t('hr.payroll.table.total_amount'),
            key: 'total',
            dataIndex: 'totalAmount',
            align: 'right' as const,
            render: (amount: any) => <span>{amount ? Number(amount).toFixed(2) : '0.00'}</span>
        },
        {
            title: t('hr.payroll.table.actions'),
            key: 'actions',
            width: 150,
            render: (_: any, record: PayrollPeriod) => (
                <Button
                    icon={<UnorderedListOutlined />}
                    onClick={() => navigate(`/app/hr/payroll/${record.id}`)}
                >
                    {t('common.view_details')}
                </Button>
            )
        }
    ];

    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>💰 {t('hr.payroll.title')}</Title>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
                    {isMobile ? undefined : t('hr.payroll.generate_button')}
                </Button>
            </div>

            <Card styles={{ body: { padding: isMobile ? 8 : 24 } }}>
                {!isMobile ? (
                    <Table
                        columns={columns}
                        dataSource={periods}
                        rowKey="id"
                        loading={isLoading}
                        pagination={{
                            showTotal: (total) => t('hr.payroll.messages.total_periods', { total })
                        }}
                    />
                ) : (
                    <List
                        loading={isLoading}
                        dataSource={periods}
                        rowKey="id"
                        pagination={{ pageSize: 10, size: 'small', simple: true }}
                        renderItem={(item: PayrollPeriod) => {
                            const colorMap: Record<string, string> = {
                                PAID: 'green',
                                PROCESSED: 'blue',
                                DRAFT: 'orange',
                                OPEN: 'cyan'
                            };
                            const statusLabel = t(`hr.payroll.statuses.${item.status}`, { defaultValue: item.status });

                            return (
                                <List.Item
                                    onClick={() => navigate(`/app/hr/payroll/${item.id}`)}
                                    style={{
                                        padding: '16px',
                                        background: '#fff',
                                        marginBottom: 12,
                                        borderRadius: 16,
                                        border: '1px solid #f0f0f0',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                        display: 'block',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
                                            {item.name}
                                        </div>
                                        <Tag color={colorMap[item.status] || 'default'} style={{ margin: 0 }}>
                                            {statusLabel}
                                        </Tag>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <div>
                                            <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase' }}>{t('hr.payroll.table.from')} - {t('hr.payroll.table.to')}</div>
                                            <div style={{ fontSize: 13 }}>
                                                {dayjs(item.startDate).format('DD/MM/YYYY')} - {dayjs(item.endDate).format('DD/MM/YYYY')}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 11, color: '#8c8c8c', textTransform: 'uppercase' }}>{t('hr.payroll.table.total_amount')}</div>
                                            <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>
                                                {item.totalAmount ? Number(item.totalAmount).toFixed(2) : '0.00'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                                        <Button 
                                            type="text" 
                                            size="small" 
                                            icon={<UnorderedListOutlined style={{ color: '#1890ff' }} />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/app/hr/payroll/${item.id}`);
                                            }}
                                        >
                                            {t('common.view_details')}
                                        </Button>
                                    </div>
                                </List.Item>
                            );
                        }}
                    />
                )}
            </Card>

            <GeneratePayrollModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
            />
        </div>
    );
};
