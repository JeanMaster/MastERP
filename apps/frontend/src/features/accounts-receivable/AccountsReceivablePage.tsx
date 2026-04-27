import { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Tag, App, Space, Statistic, Row, Col } from 'antd';
import { FileTextOutlined, ClockCircleOutlined, ReloadOutlined, DeleteOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { invoicesApi, type Invoice } from '../../services/invoicesApi';
import { paymentsApi } from '../../services/paymentsApi';
import { salesApi } from '../../services/salesApi';
import { currenciesApi } from '../../services/currenciesApi';

import { RegisterPaymentModal } from './components/RegisterPaymentModal';
import { RegisterRetentionModal } from './components/RegisterRetentionModal';
import { ClientStatementModal } from './components/ClientStatementModal';
import { formatVenezuelanNumber } from '../../utils/formatters';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';

/**
 * AccountsReceivablePage Component
 * Management interface for Credit Sales and Pending Payments.
 * Allows tracking customer debt, registering payments, and managing tax retentions.
 */
export const AccountsReceivablePage = () => {
    const { message, modal } = App.useApp();
    const [activeTab, setActiveTab] = useState('pending');
    const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
    const [allPayments, setAllPayments] = useState<any[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [loadingPayments, setLoadingPayments] = useState(false);

    // Modal states
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [retentionModalVisible, setRetentionModalVisible] = useState(false);
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
            message.error('Error loading pending invoices');
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
            message.error('Error loading payment history');
        } finally {
            setLoadingPayments(false);
        }
    };

    const handleRegisterPayment = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setPaymentModalVisible(true);
    };

    const handleRegisterRetention = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setRetentionModalVisible(true);
    };

    const handlePaymentSuccess = () => {
        setPaymentModalVisible(false);
        setSelectedInvoice(null);
        fetchPendingInvoices();
        fetchAllPayments();
        message.success('Balance updated!');
    };

    const handleViewStatement = async (clientId: string, clientName: string) => {
        try {
            const invoices = await invoicesApi.getClientInvoices(clientId);
            setStatementClient(clientName);
            setStatementInvoices(invoices);
            setStatementModalVisible(true);
        } catch (error: any) {
            message.error('Error loading account statement');
        }
    };

    const handleDeletePayment = (paymentId: string) => {
        modal.confirm({
            title: 'Delete Payment?',
            content: 'This action will revert the invoice balance and cannot be undone.',
            okText: 'Yes, delete',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await paymentsApi.delete(paymentId);
                    message.success('Payment deleted and balance reverted');
                    fetchPendingInvoices();
                    fetchAllPayments();
                } catch (error: any) {
                    message.error('Error deleting payment');
                }
            },
        });
    };

    const handleMarkUncollectible = (invoice: Invoice) => {
        if (!invoice.saleId) return;

        modal.confirm({
            title: 'Declare as UNCOLLECTIBLE / Bad Debt?',
            content: (
                <div>
                    <p>This action will remove the sale and associated debt from the books.</p>
                    <p style={{ color: 'red', fontWeight: 'bold' }}>⚠️ INVENTORY STOCK WILL NOT BE RESTORED</p>
                    <p>Use only if the customer took the goods and will not pay (Loss/Theft).</p>
                </div>
            ),
            okText: 'Declare Bad Debt',
            okType: 'danger',
            cancelText: 'Cancel',
            onOk: async () => {
                try {
                    await salesApi.markAsUncollectible(invoice.saleId!);
                    message.success('Debt declared uncollectible and removed');
                    fetchPendingInvoices();
                    fetchAllPayments();
                } catch (error: any) {
                    message.error('Error processing uncollectible debt');
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
            title: 'Invoice #',
            dataIndex: 'number',
            key: 'number',
        },
        {
            title: 'Customer',
            dataIndex: ['client', 'name'],
            key: 'client',
        },
        {
            title: 'Date',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY'),
        },
        {
            title: 'Due Date',
            dataIndex: 'dueDate',
            key: 'dueDate',
            render: (date: string) => {
                if (!date) return '-';
                const isOverdue = dayjs(date).isBefore(dayjs());
                return (
                    <span style={{ color: isOverdue ? '#ff4d4f' : undefined }}>
                        {dayjs(date).format('MM/DD/YYYY')}
                    </span>
                );
            },
        },
        {
            title: 'Status',
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
                    PENDING: 'Pending',
                    PARTIAL: 'Partial',
                    PAID: 'Paid',
                    OVERDUE: 'Overdue',
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
                        {symbol} ${formatVenezuelanNumber(amount)}
                    </strong>
                );
            },
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: Invoice) => (
                <Space>
                    <Button
                        type="primary"
                        size="small"
                        onClick={() => handleRegisterPayment(record)}
                        disabled={record.status === 'PAID'}
                    >
                        Pay
                    </Button>
                    <Button
                        type="primary"
                        size="small"
                        style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                        onClick={() => handleRegisterRetention(record)}
                        disabled={record.status === 'PAID'}
                    >
                        Retention
                    </Button>
                    <Button
                        size="small"
                        onClick={() => handleViewStatement(record.clientId, record.client?.name || 'Customer')}
                    >
                        Statement
                    </Button>
                    {record.saleId && (
                        <Button
                            danger
                            size="small"
                            icon={<CloseCircleOutlined />}
                            title="Declare Uncollectible (Loss)"
                            onClick={() => handleMarkUncollectible(record)}
                        >
                            Bad Debt
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const paymentsColumns = [
        {
            title: 'Date',
            dataIndex: 'paymentDate',
            key: 'paymentDate',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY HH:mm'),
        },
        {
            title: 'Invoice #',
            dataIndex: ['invoice', 'number'],
            key: 'invoice',
        },
        {
            title: 'Customer',
            dataIndex: ['invoice', 'client', 'name'],
            key: 'client',
        },
        {
            title: 'Amount',
            dataIndex: 'amount',
            key: 'amount',
            align: 'right' as const,
            render: (amount: number) => `Bs. ${formatVenezuelanNumber(amount)}`,
        },
        {
            title: 'Method',
            dataIndex: 'paymentMethod',
            key: 'paymentMethod',
        },
        {
            title: 'Reference',
            dataIndex: 'reference',
            key: 'reference',
            render: (ref: string) => ref || '-',
        },
        {
            title: 'Actions',
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
                    <h2 style={{ fontSize: 24, margin: 0 }}>Accounts Receivable</h2>
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                fetchPendingInvoices();
                                fetchAllPayments();
                            }}
                        >
                            Refresh
                        </Button>
                    </Space>
                </div>

                <Row gutter={16}>
                    <Col span={8}>
                        <Card>
                            <Statistic
                                title="Total Receivable"
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
                                title="Pending Invoices"
                                value={pendingInvoices.length}
                                prefix={<FileTextOutlined />}
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card>
                            <Statistic
                                title="Overdue Invoices"
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
                    <Tabs.TabPane tab="Pending Invoices" key="pending">
                        <Table
                            dataSource={pendingInvoices}
                            columns={invoiceColumns}
                            rowKey="id"
                            loading={loadingInvoices}
                            pagination={{ pageSize: 10 }}
                        />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab="Payment History" key="payments">
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

            <RegisterRetentionModal
                visible={retentionModalVisible}
                invoice={selectedInvoice}
                onClose={() => {
                    setRetentionModalVisible(false);
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
