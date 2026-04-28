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
import { useTranslation } from 'react-i18next';

/**
 * AccountsReceivablePage Component
 * Management interface for Credit Sales and Pending Payments.
 * Allows tracking customer debt, registering payments, and managing tax retentions.
 */
export const AccountsReceivablePage = () => {
    const { t } = useTranslation();
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
            message.error(t('accounts_receivable.messages.error_loading_invoices'));
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
            message.error(t('accounts_receivable.messages.error_loading_payments'));
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
        message.success(t('accounts_receivable.messages.balance_updated'));
    };

    const handleViewStatement = async (clientId: string, clientName: string) => {
        try {
            const invoices = await invoicesApi.getClientInvoices(clientId);
            setStatementClient(clientName);
            setStatementInvoices(invoices);
            setStatementModalVisible(true);
        } catch (error: any) {
            message.error(t('accounts_receivable.messages.error_loading_statement'));
        }
    };

    const handleDeletePayment = (paymentId: string) => {
        modal.confirm({
            title: t('accounts_receivable.messages.delete_payment_title'),
            content: t('accounts_receivable.messages.delete_payment_content'),
            okText: t('accounts_receivable.messages.delete_payment_ok'),
            okType: 'danger',
            cancelText: t('common.cancel'),
            onOk: async () => {
                try {
                    await paymentsApi.delete(paymentId);
                    message.success(t('accounts_receivable.messages.delete_payment_success'));
                    fetchPendingInvoices();
                    fetchAllPayments();
                } catch (error: any) {
                    message.error(t('accounts_receivable.messages.delete_payment_error'));
                }
            },
        });
    };

    const handleMarkUncollectible = (invoice: Invoice) => {
        if (!invoice.saleId) return;

        modal.confirm({
            title: t('accounts_receivable.messages.bad_debt_title'),
            content: (
                <div>
                    <p>{t('accounts_receivable.messages.bad_debt_content_1')}</p>
                    <p style={{ color: 'red', fontWeight: 'bold' }}>{t('accounts_receivable.messages.bad_debt_content_2')}</p>
                    <p>{t('accounts_receivable.messages.bad_debt_content_3')}</p>
                </div>
            ),
            okText: t('accounts_receivable.messages.bad_debt_ok'),
            okType: 'danger',
            cancelText: t('common.cancel'),
            onOk: async () => {
                try {
                    await salesApi.markAsUncollectible(invoice.saleId!);
                    message.success(t('accounts_receivable.messages.bad_debt_success'));
                    fetchPendingInvoices();
                    fetchAllPayments();
                } catch (error: any) {
                    message.error(t('accounts_receivable.messages.bad_debt_error'));
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
            title: t('accounts_receivable.invoice_num'),
            dataIndex: 'number',
            key: 'number',
        },
        {
            title: t('common.customer'),
            dataIndex: ['client', 'name'],
            key: 'client',
        },
        {
            title: t('common.date'),
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY'),
        },
        {
            title: t('accounts_receivable.due_date'),
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
            title: t('common.status'),
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
                    PENDING: t('accounts_receivable.pending'),
                    PARTIAL: t('accounts_receivable.partial'),
                    PAID: t('accounts_receivable.paid'),
                    OVERDUE: t('accounts_receivable.overdue'),
                };
                return <Tag color={colors[status]}>{labels[status] || status}</Tag>;
            },
        },
        {
            title: t('common.total'),
            dataIndex: 'total',
            key: 'total',
            align: 'right' as const,
            render: (amount: number, record: Invoice) => {
                const symbol = record.currencyCode === 'VES' ? 'Bs.' : record.currencyCode;
                return `${symbol} ${formatVenezuelanNumber(amount)}`;
            }
        },
        {
            title: t('common.balance'),
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
            title: t('accounts_receivable.actions'),
            key: 'actions',
            render: (_: any, record: Invoice) => (
                <Space>
                    <Button
                        type="primary"
                        size="small"
                        onClick={() => handleRegisterPayment(record)}
                        disabled={record.status === 'PAID'}
                    >
                        {t('accounts_receivable.pay')}
                    </Button>
                    <Button
                        type="primary"
                        size="small"
                        style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
                        onClick={() => handleRegisterRetention(record)}
                        disabled={record.status === 'PAID'}
                    >
                        {t('accounts_receivable.retention')}
                    </Button>
                    <Button
                        size="small"
                        onClick={() => handleViewStatement(record.clientId, record.client?.name || 'Customer')}
                    >
                        {t('accounts_receivable.statement')}
                    </Button>
                    {record.saleId && (
                        <Button
                            danger
                            size="small"
                            icon={<CloseCircleOutlined />}
                            title={t('accounts_receivable.messages.bad_debt_title')}
                            onClick={() => handleMarkUncollectible(record)}
                        >
                            {t('accounts_receivable.bad_debt')}
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    const paymentsColumns = [
        {
            title: t('common.date'),
            dataIndex: 'paymentDate',
            key: 'paymentDate',
            render: (date: string) => dayjs(date).format('MM/DD/YYYY HH:mm'),
        },
        {
            title: t('accounts_receivable.invoice_num'),
            dataIndex: ['invoice', 'number'],
            key: 'invoice',
        },
        {
            title: t('common.customer'),
            dataIndex: ['invoice', 'client', 'name'],
            key: 'client',
        },
        {
            title: t('common.total'),
            dataIndex: 'amount',
            key: 'amount',
            align: 'right' as const,
            render: (amount: number) => `Bs. ${formatVenezuelanNumber(amount)}`,
        },
        {
            title: t('accounts_receivable.method'),
            dataIndex: 'paymentMethod',
            key: 'paymentMethod',
        },
        {
            title: t('common.reference'),
            dataIndex: 'reference',
            key: 'reference',
            render: (ref: string) => ref || '-',
        },
        {
            title: t('accounts_receivable.actions'),
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
                    <h2 style={{ fontSize: 24, margin: 0 }}>{t('accounts_receivable.title')}</h2>
                    <Space>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={() => {
                                fetchPendingInvoices();
                                fetchAllPayments();
                            }}
                        >
                            {t('common.refresh')}
                        </Button>
                    </Space>
                </div>

                <Row gutter={16}>
                    <Col span={8}>
                        <Card>
                            <Statistic
                                title={t('accounts_receivable.total_receivable')}
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
                                title={t('accounts_receivable.pending_invoices')}
                                value={pendingInvoices.length}
                                prefix={<FileTextOutlined />}
                                valueStyle={{ color: '#1890ff' }}
                            />
                        </Card>
                    </Col>
                    <Col span={8}>
                        <Card>
                            <Statistic
                                title={t('accounts_receivable.overdue_invoices')}
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
                    <Tabs.TabPane tab={t('accounts_receivable.pending_invoices')} key="pending">
                        <Table
                            dataSource={pendingInvoices}
                            columns={invoiceColumns}
                            rowKey="id"
                            loading={loadingInvoices}
                            pagination={{ pageSize: 10 }}
                        />
                    </Tabs.TabPane>

                    <Tabs.TabPane tab={t('accounts_receivable.payment_history')} key="payments">
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
