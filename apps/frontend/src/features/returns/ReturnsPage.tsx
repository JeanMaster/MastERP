import { useState } from 'react';
import {
    Card,
    Table,
    Button,
    Tag,
    Space,
    Input,
    DatePicker,
    Select,
    Typography,
    Spin,
    Modal,
    Grid,
    List
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
    PlusOutlined,
    ReloadOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    EyeOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { returnsApi, type Return, type ReturnFilters } from '../../services/returnsApi';
import { formatVenezuelanPrice } from '../../utils/formatters';
import dayjs from 'dayjs';
import { CreateReturnModal } from './components/CreateReturnModal';
import { ReturnDetailsModal } from './components/ReturnDetailsModal';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

/**
 * ReturnsPage Component
 * Management dashboard for Product Returns and Exchanges.
 * Handles the lifecycle of a return: Request (Pending) -> Approval/Rejection -> Processing (Stock adjustment).
 */
export const ReturnsPage = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const { t } = useTranslation();
    const [filters, setFilters] = useState<ReturnFilters>({});
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);

    const handleViewDetails = (record: Return) => {
        setSelectedReturn(record);
        setIsDetailsModalOpen(true);
    };

    const { data: returns = [], isLoading, refetch } = useQuery({
        queryKey: ['returns', filters],
        queryFn: () => returnsApi.getAll(filters)
    });

    const handleDateRangeChange = (dates: any) => {
        setDateRange(dates);
        if (dates && dates.length === 2) {
            setFilters(prev => ({
                ...prev,
                startDate: dates[0].format('YYYY-MM-DD'),
                endDate: dates[1].format('YYYY-MM-DD')
            }));
        } else {
            setFilters(prev => ({
                ...prev,
                startDate: undefined,
                endDate: undefined
            }));
        }
    };

    /**
     * Approves a return request, moving it to the 'APPROVED' state where it can then be processed.
     */
    const handleApprove = async (id: string) => {
        Modal.confirm({
            title: t('returns.messages.approve_title'),
            content: t('returns.messages.approve_content'),
            onOk: async () => {
                await returnsApi.approve(id, 'Manager'); 
                refetch();
            }
        });
    };

    /**
     * Rejects a return request with a mandatory reason.
     */
    const handleReject = async (id: string) => {
        Modal.confirm({
            title: t('returns.messages.reject_title'),
            content: (
                <div>
                    <p>{t('returns.messages.reject_prompt')}</p>
                    <Input.TextArea id="rejectReason" rows={3} />
                </div>
            ),
            onOk: async () => {
                const reason = (document.getElementById('rejectReason') as HTMLTextAreaElement)?.value;
                await returnsApi.reject(id, reason || t('common.no_reason', { defaultValue: 'No reason specified' }));
                refetch();
            }
        });
    };

    /**
     * Completes an approved return, adjusting the inventory and marking the case as 'COMPLETED'.
     */
    const handleProcess = async (id: string) => {
        Modal.confirm({
            title: t('returns.messages.process_title'),
            content: t('returns.messages.process_content'),
            onOk: async () => {
                await returnsApi.process(id);
                refetch();
            }
        });
    };

    const getStatusTag = (status: string) => {
        const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
            PENDING: { color: 'orange', icon: <ExclamationCircleOutlined />, label: t('returns.status_pending') },
            APPROVED: { color: 'blue', icon: <CheckCircleOutlined />, label: t('returns.status_approved') },
            REJECTED: { color: 'red', icon: <CloseCircleOutlined />, label: t('returns.status_rejected') },
            COMPLETED: { color: 'green', icon: <CheckCircleOutlined />, label: t('returns.status_completed') }
        };

        const config = statusConfig[status] || statusConfig.PENDING;
        return (
            <Tag color={config.color} icon={config.icon}>
                {config.label}
            </Tag>
        );
    };

    const getTypeTag = (type: string) => {
        const labels: Record<string, string> = {
            REFUND: t('returns.type_refund_short'),
            EXCHANGE_SAME: t('returns.type_exchange_same_short'),
            EXCHANGE_DIFFERENT: t('returns.type_exchange_different_short')
        };
        const colors: Record<string, string> = {
            REFUND: 'purple',
            EXCHANGE_SAME: 'cyan',
            EXCHANGE_DIFFERENT: 'geekblue'
        };

        return <Tag color={colors[type]}>{labels[type] || type}</Tag>;
    };

    const columns = [
        {
            title: t('returns.table.cn_number'),
            dataIndex: 'creditNoteNumber',
            key: 'creditNoteNumber',
            width: 120,
            render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>
        },
        {
            title: t('returns.table.invoice'),
            key: 'invoice',
            width: 120,
            render: (_: any, record: Return) => record.originalSale.invoiceNumber
        },
        {
            title: t('returns.table.customer'),
            key: 'client',
            width: 150,
            render: (_: any, record: Return) => record.originalSale.client?.name || t('common.walk_in_customer', { defaultValue: 'Walk-in Customer' })
        },
        {
            title: t('returns.table.type'),
            dataIndex: 'returnType',
            key: 'returnType',
            width: 130,
            render: (type: string) => getTypeTag(type)
        },
        {
            title: t('returns.table.refund_amt'),
            dataIndex: 'refundAmount',
            key: 'refundAmount',
            width: 120,
            align: 'right' as const,
            render: (amount: number) => formatVenezuelanPrice(amount)
        },
        {
            title: t('returns.table.status'),
            dataIndex: 'status',
            key: 'status',
            width: 110,
            render: (status: string) => getStatusTag(status)
        },
        {
            title: t('returns.table.date'),
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 110,
            render: (date: string) => dayjs(date).format('MM/DD/YYYY')
        },
        {
            title: t('returns.table.actions'),
            key: 'actions',
            width: 180,
            render: (_: any, record: Return) => (
                <Space size="small">
                    <Button
                        type="default"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetails(record)}
                        title={t('returns.table.view_detail')}
                    />
                    {record.status === 'PENDING' && (
                        <>
                            <Button
                                type="primary"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => handleApprove(record.id)}
                            >
                                {t('returns.table.approve')}
                            </Button>
                            <Button
                                danger
                                size="small"
                                icon={<CloseCircleOutlined />}
                                onClick={() => handleReject(record.id)}
                            >
                                {t('returns.table.reject')}
                            </Button>
                        </>
                    )}
                    {record.status === 'APPROVED' && (
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => handleProcess(record.id)}
                        >
                            {t('returns.table.process')}
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <Title level={isMobile ? 3 : 2}>{t('returns.title')}</Title>

            <Card style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Space wrap direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
                        <RangePicker
                            value={dateRange}
                            onChange={handleDateRangeChange}
                            format="MM/DD/YYYY"
                            placeholder={[t('returns.filters.start_date'), t('returns.filters.end_date')]}
                            style={{ width: isMobile ? '100%' : 'auto' }}
                        />
                        <Space style={{ width: isMobile ? '100%' : 'auto' }}>
                            <Select
                                style={{ flex: 1, minWidth: isMobile ? 0 : 120 }}
                                placeholder={t('returns.filters.status')}
                                allowClear
                                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                            >
                                <Select.Option value="PENDING">{t('returns.status_pending')}</Select.Option>
                                <Select.Option value="APPROVED">{t('returns.status_approved')}</Select.Option>
                                <Select.Option value="REJECTED">{t('returns.status_rejected')}</Select.Option>
                                <Select.Option value="COMPLETED">{t('returns.status_completed')}</Select.Option>
                            </Select>
                            <Select
                                style={{ flex: 1, minWidth: isMobile ? 0 : 120 }}
                                placeholder={t('returns.filters.type')}
                                allowClear
                                onChange={(value) => setFilters(prev => ({ ...prev, returnType: value }))}
                            >
                                <Select.Option value="REFUND">{t('returns.type_refund_short')}</Select.Option>
                                <Select.Option value="EXCHANGE_SAME">{t('returns.type_exchange_same_short')}</Select.Option>
                                <Select.Option value="EXCHANGE_DIFFERENT">{t('returns.type_exchange_different_short')}</Select.Option>
                            </Select>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={() => {
                                    setFilters({});
                                    setDateRange(null);
                                    refetch();
                                }}
                            />
                        </Space>
                    </Space>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setIsCreateModalOpen(true)}
                        block={isMobile}
                    >
                        {isMobile ? t('common.new') : t('returns.new_request_full')}
                    </Button>
                </Space>
            </Card>

            <Card styles={{ body: { padding: isMobile ? 8 : 24 } }} style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', overflow: 'hidden' }}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: 50 }}>
                        <Spin size="large" />
                    </div>
                ) : !isMobile ? (
                    <Table
                        dataSource={returns}
                        columns={columns}
                        rowKey="id"
                        scroll={{ x: 'max-content' }}
                        size="middle"
                        pagination={{
                            pageSize: 20,
                            showSizeChanger: true,
                            showTotal: (total) => `${t('common.total', { defaultValue: 'Total' })}: ${total}`
                        }}
                        className="premium-table"
                    />
                ) : (
                    <List
                        dataSource={returns}
                        pagination={{ pageSize: 10, size: 'small', simple: true }}
                        renderItem={(item: Return) => (
                            <List.Item style={{ padding: '8px 0', border: 'none' }}>
                                <Card
                                    style={{ 
                                        width: '100%', 
                                        borderRadius: '16px', 
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                        border: '1px solid #f0f0f0'
                                    }}
                                    styles={{ body: { padding: '16px' } }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <div>
                                            <Typography.Text strong style={{ fontSize: '15px', display: 'block', color: '#1890ff' }}>
                                                {item.creditNoteNumber}
                                            </Typography.Text>
                                            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                                {dayjs(item.createdAt).format('DD/MM/YYYY')} • Invoice: {item.originalSale.invoiceNumber}
                                            </Typography.Text>
                                        </div>
                                        {getStatusTag(item.status)}
                                    </div>

                                    <div style={{ background: '#fafafa', borderRadius: '12px', padding: '12px', marginBottom: 16 }}>
                                        <Space direction="vertical" size={0}>
                                            <Typography.Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase' }}>{t('returns.table.customer')}</Typography.Text>
                                            <Typography.Text strong>{item.originalSale.client?.name || t('common.walk_in_customer')}</Typography.Text>
                                        </Space>
                                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            {getTypeTag(item.returnType)}
                                            <Typography.Text strong style={{ fontSize: '16px' }}>
                                                {formatVenezuelanPrice(item.refundAmount)}
                                            </Typography.Text>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                                        <Button 
                                            icon={<EyeOutlined />} 
                                            onClick={() => handleViewDetails(item)}
                                            style={{ borderRadius: '8px' }}
                                        >
                                            {t('common.view')}
                                        </Button>
                                        {item.status === 'PENDING' && (
                                            <Space>
                                                <Button 
                                                    type="primary" 
                                                    icon={<CheckCircleOutlined />} 
                                                    onClick={() => handleApprove(item.id)}
                                                    style={{ borderRadius: '8px' }}
                                                />
                                                <Button 
                                                    danger 
                                                    icon={<CloseCircleOutlined />} 
                                                    onClick={() => handleReject(item.id)}
                                                    style={{ borderRadius: '8px' }}
                                                />
                                            </Space>
                                        )}
                                        {item.status === 'APPROVED' && (
                                            <Button 
                                                type="primary" 
                                                onClick={() => handleProcess(item.id)}
                                                style={{ borderRadius: '8px' }}
                                            >
                                                {t('returns.table.process')}
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            </List.Item>
                        )}
                    />
                )}
            </Card>

            <CreateReturnModal
                open={isCreateModalOpen}
                onCancel={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    refetch();
                }}
            />

            <ReturnDetailsModal
                open={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                record={selectedReturn}
            />
        </div>
    );
};
