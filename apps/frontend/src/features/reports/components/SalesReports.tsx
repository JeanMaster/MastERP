import { useState } from 'react';
import {
    Card,
    Row,
    Col,
    DatePicker,
    Select,
    InputNumber,
    Button,
    Table,
    Statistic,
    Space,
    Typography,
    Grid,
    Alert
} from 'antd';
import {
    ReloadOutlined,
    DownloadOutlined,
    DollarOutlined,
    ShoppingOutlined,
    PrinterOutlined,
    EditOutlined,
    DeleteOutlined
} from '@ant-design/icons';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Modal, message } from 'antd';
import { salesApi, type Sale, type SalesFilters } from '../../../services/salesApi';
import { productsApi } from '../../../services/productsApi';
import { clientsApi } from '../../../services/clientsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';
import { SaleDetailModal } from './SaleDetailModal';
import { InvoiceModal } from '../../pos/components/InvoiceModal';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

/**
 * SalesReports Component
 * Comprehensive sales history and reporting dashboard.
 * Displays aggregate statistics (Total Sales, Adjusted Revenue, Nominal Revenue, Discounts) and an itemized table of sales with filtering capabilities.
 */
export const SalesReports = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [filters, setFilters] = useState<SalesFilters>({});
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
    const [newPaymentMethod, setNewPaymentMethod] = useState<string>('');
    const [pageSize, setPageSize] = useState<number>(10);
    const queryClient = useQueryClient();

    /**
     * Updates the payment method for a specific sale record.
     */
    const updatePaymentSchema = useMutation({
        mutationFn: (variables: { id: string, method: string }) =>
            salesApi.updatePaymentMethod(variables.id, variables.method),
        onSuccess: () => {
            message.success('Payment method updated');
            setIsEditPaymentModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['sales-reports'] });
        },
        onError: () => {
            message.error('Error updating payment method');
        }
    });

    const handleEditPayment = () => {
        if (selectedSale && newPaymentMethod) {
            updatePaymentSchema.mutate({
                id: selectedSale.id,
                method: newPaymentMethod
            });
        }
    };

    /**
     * Removes a sale record, voids the invoice, and restores inventory stock.
     */
    const deleteSaleMutation = useMutation({
        mutationFn: (id: string) => salesApi.remove(id),
        onSuccess: () => {
            message.success('Sale deleted and stock restored');
            queryClient.invalidateQueries({ queryKey: ['sales-reports'] });
        },
        onError: () => {
            message.error('Error deleting sale');
        }
    });

    const handleDeleteSale = (sale: Sale) => {
        Modal.confirm({
            title: 'Delete Sale?',
            content: `This action will void invoice ${sale.invoiceNumber}, restore product stock, and if it was the last sale, allow the invoice number to be reused.`,
            okText: 'Yes, Delete',
            okType: 'danger',
            cancelText: 'No',
            onOk: () => deleteSaleMutation.mutate(sale.id)
        });
    };

    // Fetch sales data with current filters
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['sales-reports', filters],
        queryFn: () => salesApi.getWithFilters(filters),
        enabled: true
    });

    const sales = data?.sales || [];
    const summary = data?.summary || { totalSales: 0, grossRevenue: 0, nominalRevenue: 0, discounts: 0, averageTicket: 0 };

    const { data: products = [] } = useQuery({
        queryKey: ['products'],
        queryFn: () => productsApi.getAll(),
    });

    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => clientsApi.getAll(),
    });

    // Summary statistics from backend
    const totalSalesCount = summary.totalSales;
    const totalAdjustedRevenue = summary.grossRevenue;
    const totalDiscount = summary.discounts;
    const averageTicket = summary.averageTicket;

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

    const handleFilterChange = (key: keyof SalesFilters, value: any) => {
        setFilters(prev => ({
            ...prev,
            [key]: value || undefined
        }));
    };

    const handleResetFilters = () => {
        setFilters({});
        setDateRange(null);
    };

    const columns = [
        {
            title: 'Invoice #',
            dataIndex: 'invoiceNumber',
            key: 'invoiceNumber',
            width: 120,
            fixed: 'left' as const,
            render: (invoiceNumber: string, record: Sale) => (
                <Button
                    type="link"
                    onClick={() => {
                        setSelectedSale(record);
                        setIsDetailModalOpen(true);
                    }}
                    style={{ padding: 0, height: 'auto' }}
                >
                    <Text strong style={{ color: '#1890ff' }}>{invoiceNumber}</Text>
                </Button>
            ),
            sorter: (a: Sale, b: Sale) => a.invoiceNumber.localeCompare(b.invoiceNumber)
        },
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            width: 150,
            render: (date: string) => dayjs(date).format('MM/DD/YYYY HH:mm'),
            sorter: (a: Sale, b: Sale) => dayjs(a.date).unix() - dayjs(b.date).unix()
        },
        {
            title: 'Customer',
            dataIndex: 'client',
            key: 'client',
            width: 160,
            render: (client: any) => client?.name || 'Walk-in Customer'
        },
        {
            title: 'Items',
            key: 'products',
            render: (_: any, record: Sale) => (
                <div style={{ maxWidth: '100%' }}>
                    {record.items.slice(0, 3).map(item => (
                        <div key={item.id} style={{ fontSize: '12px', lineHeight: '1.4', whiteSpace: 'normal' }}>
                            • {item.product.name} x{item.quantity}
                        </div>
                    ))}
                    {record.items.length > 3 && (
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                            +{record.items.length - 3} more...
                        </Text>
                    )}
                </div>
            )
        },
        {
            title: 'Paid Amt (Nominal)',
            dataIndex: 'total',
            key: 'nominalTotal',
            width: 150,
            align: 'right' as const,
            render: (value: number) => (
                <Text style={{ fontSize: '14px', color: '#595959' }}>
                    {formatVenezuelanPrice(value)}
                </Text>
            ),
            sorter: (a: Sale, b: Sale) => (a.total || 0) - (b.total || 0)
        },
        {
            title: 'Revalued Total',
            dataIndex: 'revaluedTotal',
            key: 'total',
            width: 150,
            align: 'right' as const,
            render: (value: number | null | undefined, record: Sale) => (
                <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
                    {formatVenezuelanPrice(value ?? record.total ?? 0)}
                </Text>
            ),
            sorter: (a: Sale, b: Sale) => (a.revaluedTotal || a.total || 0) - (b.revaluedTotal || b.total || 0)
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 130,
            align: 'center' as const,
            fixed: isMobile ? false : ('right' as const),
            render: (_: any, record: Sale) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(record);
                            setNewPaymentMethod(record.paymentMethod.split(',')[0]);
                            setIsEditPaymentModalOpen(true);
                        }}
                        title="Edit Payment Method"
                    />
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSale(record);
                        }}
                        title="Delete Sale"
                    />
                    <Button
                        type="text"
                        icon={<PrinterOutlined />}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(record);
                            setIsInvoiceModalOpen(true);
                        }}
                        title="Reprint Invoice"
                        style={{ color: '#1890ff' }}
                    />
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: isMobile ? 8 : 24 }}>
            <div style={{ marginBottom: 24 }}>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                        <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>📊 Sales Reports</Title>
                        <Text type="secondary">Visualize and analyze your sales performance</Text>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <Space wrap>
                            <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={() => refetch()}
                                block={isMobile}
                            >
                                Refresh
                            </Button>
                            <Button
                                icon={<DownloadOutlined />}
                                disabled={sales.length === 0}
                                block={isMobile}
                            >
                                Export
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </div>

            {/* Summary Statistics */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={12} lg={4}>
                    <Card size="small">
                        <Statistic
                            title="Total Sales"
                            value={totalSalesCount}
                            prefix={<ShoppingOutlined />}
                            valueStyle={{ color: '#1890ff', fontSize: isMobile ? 18 : 22 }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card size="small">
                        <Statistic
                            title="Adjusted Gross Revenue"
                            value={totalAdjustedRevenue}
                            precision={2}
                            prefix={<DollarOutlined />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            valueStyle={{ color: '#52c41a', fontSize: isMobile ? 18 : 22 }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card size="small" style={{ border: '1px solid #d9d9d9' }}>
                        <Statistic
                            title="Real Nominal Revenue"
                            value={summary.nominalRevenue || 0}
                            precision={2}
                            prefix={<ShoppingOutlined style={{ opacity: 0.7 }} />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            valueStyle={{ color: '#595959', fontSize: isMobile ? 18 : 22 }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card size="small">
                        <Statistic
                            title="Total Discounts"
                            value={totalDiscount}
                            precision={2}
                            prefix={<DollarOutlined />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            valueStyle={{ color: '#ff4d4f', fontSize: isMobile ? 18 : 22 }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card size="small">
                        <Statistic
                            title="Average Ticket"
                            value={averageTicket}
                            precision={2}
                            prefix={<DollarOutlined />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            valueStyle={{ color: '#722ed1', fontSize: isMobile ? 18 : 22 }}
                        />
                    </Card>
                </Col>
            </Row>

            {!isMobile && (
                <Alert
                    message="Returns and Inflation Adjustment Guide"
                    description={
                        <Space direction="vertical" size={2}>
                            <Text>• <Text strong>Real Nominal Revenue</Text> is the exact amount collected on the day of sale. <Text strong style={{ color: '#cf1322' }}>Use the 'Paid Amt' data for refunds.</Text></Text>
                            <Text>• <Text strong>Adjusted Gross Revenue</Text> revalues historical sales to today's rate for inflation-adjusted growth analysis.</Text>
                        </Space>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Card title="Filters" style={{ marginBottom: 16 }} size={isMobile ? 'small' : 'default'}>
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                        <Text strong>Date Range:</Text>
                        <RangePicker
                            style={{ width: '100%', marginTop: 8 }}
                            value={dateRange}
                            onChange={handleDateRangeChange}
                            format="MM/DD/YYYY"
                            placeholder={['Start Date', 'End Date']}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>Customer:</Text>
                        <Select
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder="All Customers"
                            allowClear
                            onChange={(value) => handleFilterChange('clientId', value)}
                            value={filters.clientId}
                            options={clients.map(c => ({ label: c.name, value: c.id }))}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>Product:</Text>
                        <Select
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder="All Products"
                            allowClear
                            onChange={(value) => handleFilterChange('productId', value)}
                            value={filters.productId}
                            options={products.map(p => ({ label: p.name, value: p.id }))}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>Payment:</Text>
                        <Select
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder="All Methods"
                            allowClear
                            onChange={(value) => handleFilterChange('paymentMethod', value)}
                            value={filters.paymentMethod}
                        >
                            <Select.Option value="CASH">Cash</Select.Option>
                            <Select.Option value="DEBIT">Debit Card</Select.Option>
                            <Select.Option value="CREDIT">Credit Card</Select.Option>
                            <Select.Option value="TRANSFER">Transfer</Select.Option>
                            <Select.Option value="MOBILE">Mobile Payment</Select.Option>
                        </Select>
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>Min Amount:</Text>
                        <InputNumber
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder="0.00"
                            min={0}
                            onChange={(value) => handleFilterChange('minAmount', value)}
                            value={filters.minAmount}
                        />
                    </Col>
                </Row>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <Space>
                        <Button onClick={handleResetFilters}>Clear All</Button>
                        <Button type="primary" onClick={() => refetch()} loading={isLoading}>Apply Filters</Button>
                    </Space>
                </div>
            </Card>

            <Card styles={{ body: { padding: isMobile ? 0 : 24 } }}>
                <Table
                    columns={columns}
                    dataSource={sales}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{
                        pageSize,
                        showSizeChanger: true,
                        onShowSizeChange: (_, size) => setPageSize(size),
                        pageSizeOptions: ['10', '20', '50', '100'],
                        size: isMobile ? 'small' : 'default',
                        responsive: true
                    }}
                    scroll={{ x: 900 }}
                    size={isMobile ? 'small' : 'middle'}
                />
            </Card>

            <SaleDetailModal
                open={isDetailModalOpen}
                sale={selectedSale}
                onCancel={() => setIsDetailModalOpen(false)}
            />

            <InvoiceModal
                open={isInvoiceModalOpen}
                sale={selectedSale}
                onClose={() => setIsInvoiceModalOpen(false)}
            />

            <Modal
                title="Edit Payment Method"
                open={isEditPaymentModalOpen}
                onCancel={() => setIsEditPaymentModalOpen(false)}
                onOk={handleEditPayment}
                confirmLoading={updatePaymentSchema.isPending}
            >
                <Text>Select the new payment method for invoice <Text strong>{selectedSale?.invoiceNumber}</Text>:</Text>
                <Select
                    style={{ width: '100%', marginTop: 16 }}
                    value={newPaymentMethod}
                    onChange={setNewPaymentMethod}
                >
                    <Select.Option value="CASH">Cash (Bs)</Select.Option>
                    <Select.Option value="DEBIT">Debit Card</Select.Option>
                    <Select.Option value="CREDIT">Credit Card</Select.Option>
                    <Select.Option value="TRANSFER">Transfer</Select.Option>
                    <Select.Option value="MOBILE">Mobile Payment</Select.Option>
                    <Select.Option value="CURRENCY_USD">Cash USD</Select.Option>
                    <Select.Option value="CURRENCY_EUR">Cash EUR</Select.Option>
                </Select>
                <div style={{ marginTop: 12 }}>
                    <Text type="warning" style={{ fontSize: 12 }}>
                        Note: This action only updates the reporting label. 
                        The original cash register movements will not be automatically updated.
                    </Text>
                </div>
            </Modal>
        </div>
    );
};