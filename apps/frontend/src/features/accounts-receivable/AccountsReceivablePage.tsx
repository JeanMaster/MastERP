import { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Tag, App, Space, Statistic, Row, Col } from 'antd';
import { DollarOutlined, FileTextOutlined, ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { invoicesApi, type Invoice } from '../../services/invoicesApi';
import { paymentsApi } from '../../services/paymentsApi';
import { RegisterPaymentModal } from './components/RegisterPaymentModal';
import { ClientStatementModal } from './components/ClientStatementModal';
import { formatVenezuelanPrice } from '../../utils/formatters';
import dayjs from 'dayjs';

export const AccountsReceivablePage = () => {
    const { message } = App.useApp();
    const [activeTab, setActiveTab] = useState('pending');
    const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
    const [allPayments, setAllPayments] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [loadingPayments, setLoadingPayments] = useState(false);

    // Modal states
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [statementModalVisible, setStatementModalVisible] = useState(false);
    const [statementClient, setStatementClient] = useState<string>('');
    const [statementInvoices, setStatementInvoices] = useState<Invoice[]>([]);

    useEffect(() => {
        fetchPendingInvoices();
        fetchAllPayments();
    }, []);

    const fetchPendingInvoices = async () => {
        try {
            setLoadingInvoices(true);
            const data = await invoicesApi.getPendingInvoices();
            setPendingInvoices(data);
        } catch (error: any) {
            message.error('Error al cargar facturas pendientes');
        } finally {
            setLoadingInvoices(false);
        }
    };

    const fetchAllPayments = async () => {
        try {
            setLoadingPayments(true);
            const data = await paymentsApi.getAllPayments();
            setAllPayments(data);
        } catch (error: any) {
            message.error('Error al cargar historial de pagos');
        } finally {
            setLoadingPayments(false);
        }
    };

    const handleRegisterPayment = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setPaymentModalVisible(true);
    };

    const handlePaymentSuccess = () => {
        setPaymentModalVisible(false);
        setSelectedInvoice(null);
        fetchPendingInvoices();
        fetchAllPayments();
        message.success('¡Balance actualizado!');
    };

    const handleViewStatement = async (clientId: string, clientName: string) => {
        try {
            const invoices = await invoicesApi.getClientInvoices(clientId);
            setStatementClient(clientName);
            setStatementInvoices(invoices);
            setStatementModalVisible(true);
        } catch (error: any) {
            message.error('Error al cargar estado de cuenta');
        }
    };

    // Calculate totals
    const totalReceivable = pendingInvoices.reduce((sum, inv) => sum + Number(inv.balance), 0);
    const overdueInvoices = pendingInvoices.filter(inv =>
        inv.dueDate && dayjs(inv.dueDate).isBefore(dayjs())
    );

    const invoiceColumns = [
        {
            title: 'Factura',
            dataIndex: 'number',
            key: 'number',
        },
        {
            title: 'Cliente',
            dataIndex: ['client', 'name'],
            key: 'client',
        },
        {
            title: 'Fecha',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY'),
        },
        {
            title: 'Vencimiento',
            dataIndex: 'dueDate',
            key: 'dueDate',
            render: (date: string) => {
                if (!date) return '-';
                const isOverdue = dayjs(date).isBefore(dayjs());
                return (
                    <span style={{ color: isOverdue ? '#ff4d4f' : undefined }}>
                        {dayjs(date).format('DD/MM/YYYY')}
                    </span>
                );
            },
        },
        {
            title: 'Estado',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const colors: Record<string, string> = {
                    PENDING: 'orange',
                    PARTIAL: 'blue',
                    PAID: 'green',
                    OVERDUE: 'red',
                };
                const labels: Record<string, string> = {
                    PENDING: 'Pendiente',
                    PARTIAL: 'Parcial',
                    PAID: 'Pagada',
                    OVERDUE: 'Vencida',
                };
                return <Tag color={colors[status]}>{labels[status] || status}</Tag>;
            },
        },
        {
            title: 'Total',
            dataIndex: 'total',
            key: 'total',
            align: 'right' as const,
            render: (amount: number, record: Invoice) => `${record.currencyCode === 'VES' ? 'Bs.' : record.currencyCode} ${formatVenezuelanPrice(amount)}`,
        },
        {
            title: 'Balance',
            dataIndex: 'balance',
            key: 'balance',
            align: 'right' as const,
            render: (amount: number, record: Invoice) => (
                <strong style={{ color: '#ff4d4f' }}>
                    {record.currencyCode === 'VES' ? 'Bs.' : record.currencyCode} {formatVenezuelanPrice(amount)}
                </strong>
            ),
        },
        {
            title: 'Acciones',
            key: 'actions',
            render: (_: any, record: Invoice) => (
                <Space>
                    <Button
                        type="primary"
                        size="small"
                        onClick={() => handleRegisterPayment(record)}
                    >
                        Registrar Pago
                    </Button>
                    <Button
                        size="small"
                        onClick={() => handleViewStatement(record.clientId, record.client?.name || 'Cliente')}
                    >
                        Estado de Cuenta
                    </Button>
                </Space>
            ),
        },
    ];

    const paymentsColumns = [
        {
            title: 'Fecha',
            dataIndex: 'paymentDate',
            key: 'paymentDate',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
        },
        {
            title: 'Factura',
            dataIndex: ['invoice', 'number'],
            key: 'invoice',
        },
        {
            title: 'Cliente',
            dataIndex: ['invoice', 'client', 'name'],
            key: 'client',
        },
        {
            title: 'Monto',
            dataIndex: 'amount',
            key: 'amount',
            align: 'right' as const,
            render: (amount: number) => `Bs. ${formatVenezuelanPrice(amount)}`,
        },
        {
            title: 'Método',
            dataIndex: 'paymentMethod',
            key: 'paymentMethod',
        },
        {
            title: 'Referencia',
            dataIndex: 'reference',
            key: 'reference',
            render: (ref: string) => ref || '-',
        },
    ];

    return (
        <div>
            {/* KPIs */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={8}>
                    <Card>
                        <Statistic
                            title="Total por Cobrar"
                            value={totalReceivable}
                            precision={2}
                            prefix="Bs."
                            styles={{ content: { color: '#ff4d4f' } }}
                            suffix={<DollarOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card>
                        <Statistic
                            title="Facturas Pendientes"
                            value={pendingInvoices.length}
                            styles={{ content: { color: '#1890ff' } }}
                            suffix={<FileTextOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card>
                        <Statistic
                            title="Facturas Vencidas"
                            value={overdueInvoices.length}
                            styles={{ content: { color: overdueInvoices.length > 0 ? '#ff4d4f' : '#52c41a' } }}
                            suffix={<ClockCircleOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Tabs */}
            <Card
                title="Cuentas por Cobrar"
                extra={
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => {
                            fetchPendingInvoices();
                            fetchAllPayments();
                        }}
                    >
                        Actualizar
                    </Button>
                }
            >
                <Tabs activeKey={activeTab} onChange={setActiveTab}>
                    <Tabs.TabPane tab="Facturas Pendientes" key="pending">
                        <Table
                            dataSource={pendingInvoices}
                            columns={invoiceColumns}
                            rowKey="id"
                            loading={loadingInvoices}
                            pagination={{ pageSize: 10 }}
                        />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Historial de Pagos" key="payments">
                        <Table
                            dataSource={allPayments}
                            columns={paymentsColumns}
                            rowKey="id"
                            loading={loadingPayments}
                            pagination={{ pageSize: 10 }}
                        />
                    </Tabs.TabPane>
                </Tabs>
            </Card>

            {/* Modals */}
            <RegisterPaymentModal
                visible={paymentModalVisible}
                invoice={selectedInvoice}
                onClose={() => {
                    setPaymentModalVisible(false);
                    setSelectedInvoice(null);
                }}
                onSuccess={handlePaymentSuccess}
            />

            <ClientStatementModal
                visible={statementModalVisible}
                clientName={statementClient}
                invoices={statementInvoices}
                onClose={() => setStatementModalVisible(false)}
            />
        </div>
    );
};
