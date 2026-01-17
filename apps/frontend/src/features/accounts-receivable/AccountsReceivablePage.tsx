import { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Tag, App, Space, Statistic, Row, Col } from 'antd';
import { FileTextOutlined, ClockCircleOutlined, ReloadOutlined, DeleteOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { invoicesApi, type Invoice } from '../../services/invoicesApi';
import { paymentsApi } from '../../services/paymentsApi';
import { salesApi } from '../../services/salesApi';
import { currenciesApi } from '../../services/currenciesApi';

import { RegisterPaymentModal } from './components/RegisterPaymentModal';
import { ClientStatementModal } from './components/ClientStatementModal';
import { formatVenezuelanNumber } from '../../utils/formatters';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';

export const AccountsReceivablePage = () => {
    const { message, modal } = App.useApp();
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

    const { data: currencies = [] } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
    });

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
    const handleDeletePayment = (paymentId: string) => {
        modal.confirm({
            title: '¿Estás seguro de que deseas eliminar este pago?',
            content: 'Esta acción revertirá el balance de la factura y no se puede deshacer.',
            okText: 'Sí, eliminar',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk: async () => {
                try {
                    await paymentsApi.delete(paymentId);
                    message.success('Pago eliminado y balance revertido');
                    fetchPendingInvoices();
                    fetchAllPayments();
                } catch (error: any) {
                    message.error('Error al eliminar el pago');
                }
            },
        });
    };

    const handleMarkUncollectible = (invoice: Invoice) => {
        if (!invoice.saleId) return;

        modal.confirm({
            title: '¿Declarar IMPAGO / Deuda Incobrable?',
            content: (
                <div>
                    <p>Esta acción eliminará la venta y la deuda asociada.</p>
                    <p style={{ color: 'red', fontWeight: 'bold' }}>⚠️ EL STOCK NO SE RESTAURARÁ</p>
                    <p>Úselo solo si el cliente se llevó la mercancía y no pagará (Pérdida/Robo).</p>
                </div>
            ),
            okText: 'Declarar Impago',
            okType: 'danger',
            cancelText: 'Cancelar',
            onOk: async () => {
                try {
                    await salesApi.markAsUncollectible(invoice.saleId!);
                    message.success('Deuda declarada incobrable y eliminada');
                    fetchPendingInvoices();
                    fetchAllPayments();
                } catch (error: any) {
                    message.error('Error al procesar impago');
                }
            },
        });
    };

    // Calculate totals - Always convert to VES
    const totalReceivable = pendingInvoices.reduce((sum, inv) => {
        if (inv.currencyCode === 'VES') {
            return sum + Number(inv.balance);
        }
        // Find currency rate
        const currency = currencies.find(c => c.code === inv.currencyCode);
        const rate = currency?.exchangeRate || 0;
        return sum + (Number(inv.balance) * rate);
    }, 0);


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
            render: (amount: number, record: Invoice) => {
                const symbol = record.currencyCode === 'VES' ? 'Bs.' : record.currencyCode;
                // Avoid "UDT 2.00 Bs" issue. Just show Symbol + Amount
                return `${symbol} ${formatVenezuelanNumber(amount)}`;
            }
        },
        {
            title: 'Balance',
            dataIndex: 'balance',
            key: 'balance',
            align: 'right' as const,
            render: (amount: number, record: Invoice) => {
                const symbol = record.currencyCode === 'VES' ? 'Bs.' : record.currencyCode;
                return (
                    <strong style={{ color: '#ff4d4f' }}>
                        {symbol} {formatVenezuelanNumber(amount)}
                    </strong>
                );
            },
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
                        disabled={record.status === 'PAID'}
                    >
                        Registrar Pago
                    </Button>
                    <Button
                        size="small"
                        onClick={() => handleViewStatement(record.clientId, record.client?.name || 'Cliente')}
                    >
                        Estado de Cuenta
                    </Button>
                    {record.saleId && (
                        <Button
                            danger
                            size="small"
                            icon={<CloseCircleOutlined />}
                            title="Declarar Impago (Pérdida)"
                            onClick={() => handleMarkUncollectible(record)}
                        >
                            Impago
                        </Button>
                    )}
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
            render: (amount: number) => `Bs. ${formatVenezuelanNumber(amount)}`,
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
        {
            title: 'Acciones',
            key: 'actions',
            align: 'center' as const,
            render: (_: any, record: any) => (
                <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeletePayment(record.id)}
                />
            ),
        },
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 24, margin: 0 }}>Cuentas por Cobrar</h2>
                    <Space>

                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                fetchPendingInvoices();
                                fetchAllPayments();
                            }}
                        >
                            Actualizar
                        </Button>
                    </Space>
                </div>

                <Row gutter={16}>
                    <Col span={8}>
                        <Card>
                            <Statistic
                                title="Total por Cobrar"
                                value={totalReceivable}
                                precision={2}
                                prefix="Bs."
                                valueStyle={{ color: '#cf1322' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card>
                            <Statistic
                                title="Facturas Pendientes"
                                value={pendingInvoices.length}
                                prefix={<FileTextOutlined />}
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card>
                            <Statistic
                                title="Facturas Vencidas"
                                value={overdueInvoices.length}
                                prefix={<ClockCircleOutlined />}
                                valueStyle={{ color: '#52c41a' }}
                            />
                        </Card>
                    </Col>
                </Row>
            </div>

            <Card>
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
