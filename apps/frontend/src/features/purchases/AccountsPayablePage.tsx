
import { useState } from 'react';
import { Card, Table, Button, Space, Input, Tag, Tabs, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, DollarOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { purchasesApi } from '../../services/purchasesApi';
import type { Purchase } from '../../services/purchasesApi';
import { formatVenezuelanNumber, formatDate } from '../../utils/formatters';
import { RegisterPurchasePaymentModal } from './components/RegisterPurchasePaymentModal';

export const AccountsPayablePage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const queryClient = useQueryClient();

    const { data: purchases = [], isLoading } = useQuery({
        queryKey: ['purchases'],
        queryFn: purchasesApi.getAll,
    });

    const handleRegisterPayment = (purchase: Purchase) => {
        setSelectedPurchase(purchase);
        setPaymentModalOpen(true);
    };

    // Filter logic
    const filteredPurchases = purchases.filter(p =>
    (p.supplier.comercialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const pendingInvoices = filteredPurchases.filter(p => p.paymentStatus !== 'PAID');
    const historyInvoices = filteredPurchases.filter(p => p.paymentStatus === 'PAID' || p.paidAmount > 0);

    const columns = [
        {
            title: 'Fecha',
            dataIndex: 'invoiceDate',
            key: 'invoiceDate',
            render: (date: string) => formatDate(date),
            width: 100,
        },
        {
            title: 'Proveedor',
            dataIndex: ['supplier', 'comercialName'],
            key: 'supplier',
        },
        {
            title: 'N° Factura',
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
            title: 'Pagado',
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
            title: 'Saldo',
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
            title: 'Vencimiento',
            dataIndex: 'dueDate',
            key: 'dueDate',
            render: (date: string) => date ? formatDate(date) : '-',
        },
        {
            title: 'Estado',
            dataIndex: 'paymentStatus',
            key: 'paymentStatus',
            render: (status: string) => {
                let color = 'default';
                let text = 'Desconocido';
                switch (status) {
                    case 'PAID': color = 'success'; text = 'Pagada'; break;
                    case 'PARTIAL': color = 'warning'; text = 'Parcial'; break;
                    case 'UNPAID': color = 'error'; text = 'Pendiente'; break;
                }
                return <Tag color={color}>{text}</Tag>;
            }
        },
        {
            title: 'Acciones',
            key: 'actions',
            align: 'center' as const,
            render: (_: any, record: Purchase) => (
                <Space>
                    {record.paymentStatus !== 'PAID' && (
                        <Tooltip title="Registrar Pago">
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

    const items = [
        {
            key: '1',
            label: 'Facturas Pendientes',
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
            label: 'Historial de Pagos',
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
                <h1>Cuentas por Pagar</h1>
                <Space>
                    <Input
                        placeholder="Buscar proveedor, factura..."
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
                <Tabs defaultActiveKey="1" items={items} />
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
