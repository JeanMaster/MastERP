import { useState } from 'react';
import { Card, Table, Button, Space, Input, Tag, Tabs, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, DollarOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { purchasesApi } from '../../services/purchasesApi';
import type { Purchase } from '../../services/purchasesApi';
import { formatVenezuelanNumber, formatDate } from '../../utils/formatters';
import { RegisterPurchasePaymentModal } from './components/RegisterPurchasePaymentModal';

/**
 * AccountsPayablePage Component
 * Management interface for supplier debts (Accounts Payable).
 * Tracks invoice balances, due dates, and allows registering payments.
 */
export const AccountsPayablePage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const queryClient = useQueryClient();

    // Fetch all purchases (as they contain payment status)
    const { data: purchases = [], isLoading } = useQuery({
        queryKey: ['purchases'],
        queryFn: purchasesApi.getAll,
    });

    const handleRegisterPayment = (purchase: Purchase) => {
        setSelectedPurchase(purchase);
        setPaymentModalOpen(true);
    };

    // Filtering logic
    const filteredPurchases = purchases.filter(p =>
    (p.supplier.comercialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Grouping by status
    const pendingInvoices = filteredPurchases.filter(p => p.paymentStatus !== 'PAID');
    const historyInvoices = filteredPurchases.filter(p => p.paymentStatus === 'PAID' || p.paidAmount > 0);

    const columns = [
        {
            title: 'Date',
            dataIndex: 'invoiceDate',
            key: 'invoiceDate',
            render: (date: string) => formatDate(date),
            width: 100,
        },
        {
            title: 'Supplier',
            dataIndex: ['supplier', 'comercialName'],
            key: 'supplier',
        },
        {
            title: 'Invoice #',
            dataIndex: 'invoiceNumber',
            key: 'invoiceNumber',
            render: (text: string) => text || <span style={{ color: '#ccc' }}>N/A</span>
        },
        {
            title: 'Total',
            dataIndex: 'total',
            key: 'total',
            align: 'right' as const,
            render: (val: number, record: Purchase) => {
                const symbol = record.currencyCode === 'VES' ? 'Bs.' : record.currencyCode;
                return <b>{symbol} {formatVenezuelanNumber(val)}</b>;
            }
        },
        {
            title: 'Paid',
            dataIndex: 'paidAmount',
            key: 'paidAmount',
            align: 'right' as const,
            render: (val: number, record: Purchase) => {
                const symbol = record.currencyCode === 'VES' ? 'Bs.' : record.currencyCode;
                return (
                    <span style={{ color: 'green' }}>
                        {symbol} {formatVenezuelanNumber(val)}
                    </span>
                );
            }
        },
        {
            title: 'Balance',
            dataIndex: 'balance',
            key: 'balance',
            align: 'right' as const,
            render: (val: number, record: Purchase) => {
                const symbol = record.currencyCode === 'VES' ? 'Bs.' : record.currencyCode;
                return (
                    <span style={{ color: val > 0 ? 'red' : 'gray', fontWeight: 'bold' }}>
                        {symbol} {formatVenezuelanNumber(val)}
                    </span>
                );
            }
        },
        {
            title: 'Due Date',
            dataIndex: 'dueDate',
            key: 'dueDate',
            render: (date: string) => date ? formatDate(date) : '-',
        },
        {
            title: 'Status',
            dataIndex: 'paymentStatus',
            key: 'paymentStatus',
            render: (status: string) => {
                let color = 'default';
                let text = 'Unknown';
                switch (status) {
                    case 'PAID': color = 'success'; text = 'Paid'; break;
                    case 'PARTIAL': color = 'warning'; text = 'Partial'; break;
                    case 'UNPAID': color = 'error'; text = 'Pending'; break;
                }
                return <Tag color={color}>{text}</Tag>;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            align: 'center' as const,
            render: (_: any, record: Purchase) => (
                <Space>
                    {record.paymentStatus !== 'PAID' && (
                        <Tooltip title="Register Payment">
                            <Button
                                type="primary"
                                size="small"
                                icon={<DollarOutlined />}
                                onClick={() => handleRegisterPayment(record)}
                            />
                        </Tooltip>
                    )}
                </Space>
            ),
        }
    ];

    const tabItems = [
        {
            key: '1',
            label: 'Pending Invoices',
            children: (
                <Table
                    columns={columns}
                    dataSource={pendingInvoices}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{ pageSize: 10 }}
                />
            ),
        },
        {
            key: '2',
            label: 'Payment History',
            children: (
                <Table
                    columns={columns}
                    dataSource={historyInvoices}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{ pageSize: 10 }}
                />
            ),
        },
    ];

    return (
        <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <h1>Accounts Payable</h1>
                <Space>
                    <Input
                        placeholder="Search supplier, invoice..."
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: 250 }}
                    />
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['purchases'] })}
                    />
                </Space>
            </div>

            <Card styles={{ body: { padding: 10 } }}>
                <Tabs defaultActiveKey="1" items={tabItems} />
            </Card>

            <RegisterPurchasePaymentModal
                open={paymentModalOpen}
                purchase={selectedPurchase}
                onClose={() => {
                    setPaymentModalOpen(false);
                    setSelectedPurchase(null);
                }}
            />
        </div>
    );
};
