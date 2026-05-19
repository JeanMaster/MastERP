import { useState } from 'react';
import { Card, Table, Button, Space, Input, Tag, Tabs, Tooltip, Grid, List, Typography, Divider } from 'antd';
import { SearchOutlined, ReloadOutlined, DollarOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { purchasesApi } from '../../services/purchasesApi';
import type { Purchase } from '../../services/purchasesApi';
import { formatVenezuelanNumber, formatDate } from '../../utils/formatters';
import { RegisterPurchasePaymentModal } from './components/RegisterPurchasePaymentModal';
import { useTranslation } from 'react-i18next';

/**
 * AccountsPayablePage Component
 * Management interface for supplier debts (Accounts Payable).
 * Tracks invoice balances, due dates, and allows registering payments.
 */
export const AccountsPayablePage = () => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const queryClient = useQueryClient();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;

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
            title: t('accounts_payable.table.date'),
            dataIndex: 'invoiceDate',
            key: 'invoiceDate',
            render: (date: string) => formatDate(date),
            width: 100,
        },
        {
            title: t('accounts_payable.table.supplier'),
            dataIndex: ['supplier', 'comercialName'],
            key: 'supplier',
        },
        {
            title: t('accounts_payable.table.invoice'),
            dataIndex: 'invoiceNumber',
            key: 'invoiceNumber',
            render: (text: string) => text || <span style={{ color: '#ccc' }}>{t('accounts_payable.table.na')}</span>
        },
        {
            title: t('accounts_payable.table.total'),
            dataIndex: 'total',
            key: 'total',
            align: 'right' as const,
            render: (val: number, record: Purchase) => {
                const symbol = record.currencyCode === 'VES' ? 'Bs.' : record.currencyCode;
                return <b>{symbol} {formatVenezuelanNumber(val)}</b>;
            }
        },
        {
            title: t('accounts_payable.table.paid'),
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
            title: t('accounts_payable.table.balance'),
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
            title: t('accounts_payable.table.due_date'),
            dataIndex: 'dueDate',
            key: 'dueDate',
            render: (date: string) => date ? formatDate(date) : '-',
        },
        {
            title: t('accounts_payable.table.status'),
            dataIndex: 'paymentStatus',
            key: 'paymentStatus',
            render: (status: string) => {
                let color = 'default';
                let text = 'Unknown';
                switch (status) {
                    case 'PAID': color = 'success'; text = t('accounts_payable.status.paid'); break;
                    case 'PARTIAL': color = 'warning'; text = t('accounts_payable.status.partial'); break;
                    case 'UNPAID': color = 'error'; text = t('accounts_payable.status.pending'); break;
                }
                return <Tag color={color}>{text}</Tag>;
            }
        },
        {
            title: t('accounts_payable.table.actions'),
            key: 'actions',
            align: 'center' as const,
            render: (_: any, record: Purchase) => (
                <Space>
                    {record.paymentStatus !== 'PAID' && (
                        <Tooltip title={t('accounts_payable.register_payment')}>
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

    const renderInvoiceList = (dataSource: Purchase[]) => (
        !isMobile ? (
            <Table
                columns={columns}
                dataSource={dataSource}
                rowKey="id"
                loading={isLoading}
                pagination={{ pageSize: 10 }}
            />
        ) : (
            <List
                dataSource={dataSource}
                loading={isLoading}
                pagination={{ pageSize: 10, size: 'small', simple: true }}
                renderItem={(item: Purchase) => (
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
                                    <Typography.Text strong style={{ fontSize: '16px', display: 'block' }}>
                                        {item.supplier.comercialName}
                                    </Typography.Text>
                                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                        {item.invoiceNumber || t('accounts_payable.table.na')} • {formatDate(item.invoiceDate)}
                                    </Typography.Text>
                                </div>
                                <Tag color={
                                    item.paymentStatus === 'PAID' ? 'success' : 
                                    item.paymentStatus === 'PARTIAL' ? 'warning' : 'error'
                                } style={{ borderRadius: '12px', margin: 0 }}>
                                    {t(`accounts_payable.status.${item.paymentStatus.toLowerCase()}`)}
                                </Tag>
                            </div>

                            <div style={{ background: '#fafafa', borderRadius: '12px', padding: '12px', marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Typography.Text type="secondary">{t('accounts_payable.table.total')}</Typography.Text>
                                    <Typography.Text strong>
                                        {item.currencyCode === 'VES' ? 'Bs.' : item.currencyCode} {formatVenezuelanNumber(item.total)}
                                    </Typography.Text>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Typography.Text type="secondary">{t('accounts_payable.table.paid')}</Typography.Text>
                                    <Typography.Text style={{ color: 'green' }}>
                                        {item.currencyCode === 'VES' ? 'Bs.' : item.currencyCode} {formatVenezuelanNumber(item.paidAmount)}
                                    </Typography.Text>
                                </div>
                                <Divider style={{ margin: '8px 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography.Text strong>{t('accounts_payable.table.balance')}</Typography.Text>
                                    <Typography.Text strong style={{ color: item.balance > 0 ? 'red' : 'gray', fontSize: '16px' }}>
                                        {item.currencyCode === 'VES' ? 'Bs.' : item.currencyCode} {formatVenezuelanNumber(item.balance)}
                                    </Typography.Text>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                    {t('accounts_payable.table.due_date')}: {item.dueDate ? formatDate(item.dueDate) : '-'}
                                </Typography.Text>
                                {item.paymentStatus !== 'PAID' && (
                                    <Button
                                        type="primary"
                                        icon={<DollarOutlined />}
                                        onClick={() => handleRegisterPayment(item)}
                                        style={{ borderRadius: '8px' }}
                                    >
                                        {t('accounts_payable.register_payment')}
                                    </Button>
                                )}
                            </div>
                        </Card>
                    </List.Item>
                )}
            />
        )
    );

    const tabItems = [
        {
            key: '1',
            label: t('accounts_payable.tabs.pending'),
            children: renderInvoiceList(pendingInvoices),
        },
        {
            key: '2',
            label: t('accounts_payable.tabs.history'),
            children: renderInvoiceList(historyInvoices),
        },
    ];

    return (
        <div style={{ padding: isMobile ? '8px' : '24px' }} className="fade-in">
            <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between', 
                alignItems: isMobile ? 'flex-start' : 'center',
                marginBottom: 24,
                gap: 16
            }}>
                <Typography.Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>
                    {t('accounts_payable.title')}
                </Typography.Title>
                <Space style={{ width: isMobile ? '100%' : 'auto' }}>
                    <Input
                        placeholder={t('accounts_payable.search_placeholder')}
                        prefix={<SearchOutlined />}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: isMobile ? '100%' : 250 }}
                    />
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['purchases'] })}
                    />
                </Space>
            </div>

            <Card styles={{ body: { padding: isMobile ? 8 : 24 } }} style={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <Tabs defaultActiveKey="1" items={tabItems} size={isMobile ? 'small' : undefined} />
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
