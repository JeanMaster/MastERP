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

    // Fetch returns data
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

    const handleApprove = async (id: string) => {
        Modal.confirm({
            title: '¿Aprobar devolución?',
            content: 'Se marcará como aprobada y podrá ser procesada.',
            onOk: async () => {
                await returnsApi.approve(id, 'Manager'); // TODO: Get actual user
                refetch();
            }
        });
    };

    const handleReject = async (id: string) => {
        Modal.confirm({
            title: '¿Rechazar devolución?',
            content: (
                <div>
                    <p>Ingresa la razón del rechazo:</p>
                    <Input.TextArea id="rejectReason" rows={3} />
                </div>
            ),
            onOk: async () => {
                const reason = (document.getElementById('rejectReason') as HTMLTextAreaElement)?.value;
                await returnsApi.reject(id, reason || 'No especificada');
                refetch();
            }
        });
    };

    const handleProcess = async (id: string) => {
        Modal.confirm({
            title: '¿Procesar devolución?',
            content: 'Se ajustará el inventario y se completará la devolución.',
            onOk: async () => {
                await returnsApi.process(id);
                refetch();
            }
        });
    };

    const getStatusTag = (status: string) => {
        const statusConfig: Record<string, { color: string; icon: any }> = {
            PENDING: { color: 'orange', icon: <ExclamationCircleOutlined /> },
            APPROVED: { color: 'blue', icon: <CheckCircleOutlined /> },
            REJECTED: { color: 'red', icon: <CloseCircleOutlined /> },
            COMPLETED: { color: 'green', icon: <CheckCircleOutlined /> }
        };

        const config = statusConfig[status] || statusConfig.PENDING;
        const labels: Record<string, string> = {
            PENDING: 'Pendiente',
            APPROVED: 'Aprobada',
            REJECTED: 'Rechazada',
            COMPLETED: 'Completada'
        };

        return (
            <Tag color={config.color} icon={config.icon}>
                {labels[status] || status}
            </Tag>
        );
    };

    const getTypeTag = (type: string) => {
        const labels: Record<string, string> = {
            REFUND: 'Reembolso',
            EXCHANGE_SAME: 'Cambio Mismo',
            EXCHANGE_DIFFERENT: 'Cambio Diferente'
        };
        const colors: Record<string, string> = {
            REFUND: 'purple',
            EXCHANGE_SAME: 'cyan',
            EXCHANGE_DIFFERENT: 'geekblue'
        };

        return <Tag color={colors[type]}>{labels[type]}</Tag>;
    };

    const columns = [
        {
            title: 'NC #',
            dataIndex: 'creditNoteNumber',
            key: 'creditNoteNumber',
            width: 120,
            render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>
        },
        {
            title: 'Factura',
            key: 'invoice',
            width: 120,
            render: (_: any, record: Return) => record.originalSale.invoiceNumber
        },
        {
            title: 'Cliente',
            key: 'client',
            width: 150,
            render: (_: any, record: Return) => record.originalSale.client?.name || 'Cliente General'
        },
        {
            title: 'Tipo',
            dataIndex: 'returnType',
            key: 'returnType',
            width: 120,
            render: (type: string) => getTypeTag(type)
        },
        {
            title: 'Monto',
            dataIndex: 'refundAmount',
            key: 'refundAmount',
            width: 100,
            align: 'right' as const,
            render: (amount: number) => formatVenezuelanPrice(amount)
        },
        {
            title: 'Estado',
            dataIndex: 'status',
            key: 'status',
            width: 110,
            render: (status: string) => getStatusTag(status)
        },
        {
            title: 'Fecha',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 100,
            render: (date: string) => dayjs(date).format('DD/MM/YYYY')
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 180,
            render: (_: any, record: Return) => (
                <Space size="small">
                    <Button
                        type="default"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetails(record)}
                        title="Ver detalle"
                    />
                    {record.status === 'PENDING' && (
                        <>
                            <Button
                                type="primary"
                                size="small"
                                icon={<CheckCircleOutlined />}
                                onClick={() => handleApprove(record.id)}
                            >
                                Aprobar
                            </Button>
                            <Button
                                danger
                                size="small"
                                icon={<CloseCircleOutlined />}
                                onClick={() => handleReject(record.id)}
                            >
                                Rechazar
                            </Button>
                        </>
                    )}
                    {record.status === 'APPROVED' && (
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => handleProcess(record.id)}
                        >
                            Procesar
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <Title level={isMobile ? 3 : 2}>📦 Cambios y Devoluciones</Title>

            {/* Filters */}
            <Card style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Space wrap direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
                        <RangePicker
                            value={dateRange}
                            onChange={handleDateRangeChange}
                            format="DD/MM/YYYY"
                            placeholder={['Inicio', 'Fin']}
                            style={{ width: isMobile ? '100%' : 'auto' }}
                        />
                        <Space style={{ width: isMobile ? '100%' : 'auto' }}>
                            <Select
                                style={{ flex: 1, minWidth: isMobile ? 0 : 120 }}
                                placeholder="Estado"
                                allowClear
                                onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                            >
                                <Select.Option value="PENDING">Pendiente</Select.Option>
                                <Select.Option value="APPROVED">Aprobada</Select.Option>
                                <Select.Option value="REJECTED">Rechazada</Select.Option>
                                <Select.Option value="COMPLETED">Completada</Select.Option>
                            </Select>
                            <Select
                                style={{ flex: 1, minWidth: isMobile ? 0 : 120 }}
                                placeholder="Tipo"
                                allowClear
                                onChange={(value) => setFilters(prev => ({ ...prev, returnType: value }))}
                            >
                                <Select.Option value="REFUND">Reembolso</Select.Option>
                                <Select.Option value="EXCHANGE_SAME">Cambio Mismo</Select.Option>
                                <Select.Option value="EXCHANGE_DIFFERENT">Cambio Diferente</Select.Option>
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
                        {isMobile ? 'Nueva' : 'Nueva Devolución'}
                    </Button>
                </Space>
            </Card>

            {/* Returns List */}
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
                            showTotal: (total) => `Total: ${total}`
                        }}
                    />
                )}
            </Card>

            {/* Create Return Modal */}
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
