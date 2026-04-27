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
    Grid
} from 'antd';
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
            title: 'Approve Return?',
            content: 'The request will be marked as approved and ready for final processing.',
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
            title: 'Reject Return Request?',
            content: (
                <div>
                    <p>Please enter the reason for rejection:</p>
                    <Input.TextArea id="rejectReason" rows={3} />
                </div>
            ),
            onOk: async () => {
                const reason = (document.getElementById('rejectReason') as HTMLTextAreaElement)?.value;
                await returnsApi.reject(id, reason || 'No reason specified');
                refetch();
            }
        });
    };

    /**
     * Completes an approved return, adjusting the inventory and marking the case as 'COMPLETED'.
     */
    const handleProcess = async (id: string) => {
        Modal.confirm({
            title: 'Process Return?',
            content: 'This will update the inventory stock and finalize the refund/exchange.',
            onOk: async () => {
                await returnsApi.process(id);
                refetch();
            }
        });
    };

    const getStatusTag = (status: string) => {
        const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
            PENDING: { color: 'orange', icon: <ExclamationCircleOutlined />, label: 'Pending' },
            APPROVED: { color: 'blue', icon: <CheckCircleOutlined />, label: 'Approved' },
            REJECTED: { color: 'red', icon: <CloseCircleOutlined />, label: 'Rejected' },
            COMPLETED: { color: 'green', icon: <CheckCircleOutlined />, label: 'Completed' }
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
            REFUND: 'Refund',
            EXCHANGE_SAME: 'Direct Exchange',
            EXCHANGE_DIFFERENT: 'Product Swap'
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
            title: 'CN #',
            dataIndex: 'creditNoteNumber',
            key: 'creditNoteNumber',
            width: 120,
            render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>
        },
        {
            title: 'Invoice',
            key: 'invoice',
            width: 120,
            render: (_: any, record: Return) => record.originalSale.invoiceNumber
        },
        {
            title: 'Customer',
            key: 'client',
            width: 150,
            render: (_: any, record: Return) => record.originalSale.client?.name || 'Walk-in Customer'
        },
        {
            title: 'Type',
            dataIndex: 'returnType',
            key: 'returnType',
            width: 130,
            render: (type: string) => getTypeTag(type)
        },
        {
            title: 'Refund Amt',
            dataIndex: 'refundAmount',
            key: 'refundAmount',
            width: 120,
            align: 'right' as const,
            render: (amount: number) => formatVenezuelanPrice(amount)
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 110,
            render: (status: string) => getStatusTag(status)
        },
        {
            title: 'Date',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 110,
            render: (date: string) => dayjs(date).format('MM/DD/YYYY')
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 180,
            render: (_: any, record: Return) => (
                <Space size="small">
                    <Button
                        type="default"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetails(record)}
                        title="View detail"
                    />
                    {record.status === 'PENDING' && (
                        <>
                            <Button
                                type="primary"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => handleApprove(record.id)}
                            >
                                Approve
                            </Button>
                            <Button
                                danger
                                size="small"
                                icon={<CloseCircleOutlined />}
                                onClick={() => handleReject(record.id)}
                            >
                                Reject
                            </Button>
                        </>
                    )}
                    {record.status === 'APPROVED' && (
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => handleProcess(record.id)}
                        >
                            Process
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <Title level={isMobile ? 3 : 2}>📦 Returns & Exchanges</Title>

            <Card style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Space wrap direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
                        <RangePicker
                            value={dateRange}
                            onChange={handleDateRangeChange}
                            format="MM/DD/YYYY"
                            placeholder={['Start Date', 'End Date']}
                            style={{ width: isMobile ? '100%' : 'auto' }}
                        />
                        <Space style={{ width: isMobile ? '100%' : 'auto' }}>
                            <Select
                                style={{ flex: 1, minWidth: isMobile ? 0 : 120 }}
                                placeholder="Status"
                                allowClear
                                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                            >
                                <Select.Option value="PENDING">Pending</Select.Option>
                                <Select.Option value="APPROVED">Approved</Select.Option>
                                <Select.Option value="REJECTED">Rejected</Select.Option>
                                <Select.Option value="COMPLETED">Completed</Select.Option>
                            </Select>
                            <Select
                                style={{ flex: 1, minWidth: isMobile ? 0 : 120 }}
                                placeholder="Type"
                                allowClear
                                onChange={(value) => setFilters(prev => ({ ...prev, returnType: value }))}
                            >
                                <Select.Option value="REFUND">Refund</Select.Option>
                                <Select.Option value="EXCHANGE_SAME">Same Product</Select.Option>
                                <Select.Option value="EXCHANGE_DIFFERENT">Product Swap</Select.Option>
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
                        {isMobile ? 'New' : 'New Return Request'}
                    </Button>
                </Space>
            </Card>

            <Card>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: 50 }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <Table
                        dataSource={returns}
                        columns={columns}
                        rowKey="id"
                        scroll={{ x: 'max-content' }}
                        size={isMobile ? 'small' : 'middle'}
                        pagination={{
                            pageSize: 20,
                            showSizeChanger: true,
                            size: isMobile ? 'small' : 'default',
                            showTotal: (total) => `Total: ${total} entries`
                        }}
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
