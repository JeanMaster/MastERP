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
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();

    /**
     * Updates the payment method for a specific sale record.
     */
    const updatePaymentSchema = useMutation({
        mutationFn: (variables: { id: string, method: string }) =>
            salesApi.updatePaymentMethod(variables.id, variables.method),
        onSuccess: () => {
            message.success(t('sales_history.messages.update_payment_success'));
            setIsEditPaymentModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['sales-reports'] });
        },
        onError: () => {
            message.error(t('sales_history.messages.update_payment_error'));
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
            message.success(t('sales_history.messages.delete_success'));
            queryClient.invalidateQueries({ queryKey: ['sales-reports'] });
        },
        onError: () => {
            message.error(t('sales_history.messages.delete_error'));
        }
    });

    const handleDeleteSale = (sale: Sale) => {
        Modal.confirm({
            title: t('sales_history.messages.delete_confirm_title'),
            content: t('sales_history.messages.delete_confirm_content', { invoice: sale.invoiceNumber }),
            okText: t('sales_history.filters.apply'),
            okType: 'danger',
            cancelText: t('sales_history.messages.delete_confirm_no', { defaultValue: 'No' }),
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
            title: t('sales_history.table.invoice'),
            dataIndex: 'invoiceNumber',
            key: 'invoiceNumber',
            width: 110,
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
            title: t('sales_history.table.date'),
            dataIndex: 'date',
            key: 'date',
            width: 140,
            render: (date: string) => <span style={{ fontSize: '12px' }}>{dayjs(date).format('MM/DD/YYYY HH:mm')}</span>,
            sorter: (a: Sale, b: Sale) => dayjs(a.date).unix() - dayjs(b.date).unix()
        },
        {
            title: t('sales_history.table.customer'),
            dataIndex: 'client',
            key: 'client',
            width: 140,
            render: (client: any) => <span style={{ fontSize: '12px' }}>{client?.name || t('sales_history.table.walk_in')}</span>
        },
        {
            title: t('sales_history.table.items'),
            key: 'products',
            width: 190,
            render: (_: any, record: Sale) => (
                <div style={{ maxWidth: '100%' }}>
                    {record.items.slice(0, 3).map(item => (
                        <div key={item.id} style={{ fontSize: '11px', lineHeight: '1.2', whiteSpace: 'normal', marginBottom: '2px' }}>
                            • {item.product.name} x{item.quantity}
                        </div>
                    ))}
                    {record.items.length > 3 && (
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                            +{record.items.length - 3} {t('sales_history.table.more')}
                        </Text>
                    )}
                </div>
            )
        },
        {
            title: t('sales_history.table.paid_amt'),
            dataIndex: 'total',
            key: 'nominalTotal',
            width: 120,
            align: 'right' as const,
            render: (value: number) => (
                <Text style={{ fontSize: '13px', color: '#595959' }}>
                    {formatVenezuelanPrice(value)}
                </Text>
            ),
            sorter: (a: Sale, b: Sale) => (a.total || 0) - (b.total || 0)
        },
        {
            title: t('sales_history.table.revalued_total'),
            dataIndex: 'revaluedTotal',
            key: 'total',
            width: 120,
            align: 'right' as const,
            render: (value: number | null | undefined, record: Sale) => (
                <Text strong style={{ color: '#1890ff', fontSize: '13px' }}>
                    {formatVenezuelanPrice(value ?? record.total ?? 0)}
                </Text>
            ),
            sorter: (a: Sale, b: Sale) => (a.revaluedTotal || a.total || 0) - (b.revaluedTotal || b.total || 0)
        },
        {
            title: t('sales_history.table.actions'),
            key: 'actions',
            width: 110,
            align: 'center' as const,
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
                        title={t('sales_history.table.edit_payment')}
                    />
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSale(record);
                        }}
                        title={t('sales_history.table.delete_sale')}
                    />
                    <Button
                        type="text"
                        icon={<PrinterOutlined />}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(record);
                            setIsInvoiceModalOpen(true);
                        }}
                        title={t('sales_history.table.reprint')}
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
                        <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>{t('sales_history.reports_title')}</Title>
                        <Text type="secondary">{t('sales_history.reports_subtitle')}</Text>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <Space wrap>
                            <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={() => refetch()}
                                block={isMobile}
                            >
                                {t('sales_history.refresh')}
                            </Button>
                            <Button
                                icon={<DownloadOutlined />}
                                disabled={sales.length === 0}
                                block={isMobile}
                            >
                                {t('sales_history.export')}
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
                            title={t('sales_history.stats.total_sales')}
                            value={totalSalesCount}
                            prefix={<ShoppingOutlined />}
                            valueStyle={{ color: '#1890ff', fontSize: isMobile ? 18 : 22 }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card size="small">
                        <Statistic
                            title={t('sales_history.stats.adjusted_revenue')}
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
                            title={t('sales_history.stats.nominal_revenue')}
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
                            title={t('sales_history.stats.total_discounts')}
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
                            title={t('sales_history.stats.average_ticket')}
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
                    message={t('sales_history.guide.title')}
                    description={
                        <Space direction="vertical" size={2}>
                            <Text>• <Text strong>{t('sales_history.stats.nominal_revenue')}</Text> {t('sales_history.guide.nominal_desc')} <Text strong style={{ color: '#cf1322' }}>{t('sales_history.guide.refund_warning')}</Text></Text>
                            <Text>• <Text strong>{t('sales_history.stats.adjusted_revenue')}</Text> {t('sales_history.guide.adjusted_desc')}</Text>
                        </Space>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Card title={t('sales_history.filters.title')} style={{ marginBottom: 16 }} size={isMobile ? 'small' : 'default'}>
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                        <Text strong>{t('sales_history.filters.date_range')}:</Text>
                        <RangePicker
                            style={{ width: '100%', marginTop: 8 }}
                            value={dateRange}
                            onChange={handleDateRangeChange}
                            format="MM/DD/YYYY"
                            placeholder={[t('sales_history.filters.start_date'), t('sales_history.filters.end_date')]}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>{t('sales_history.filters.customer')}:</Text>
                        <Select
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder={t('sales_history.filters.all_customers')}
                            allowClear
                            onChange={(value) => handleFilterChange('clientId', value)}
                            value={filters.clientId}
                            options={clients.map(c => ({ label: c.name, value: c.id }))}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>{t('sales_history.filters.product')}:</Text>
                        <Select
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder={t('sales_history.filters.all_products')}
                            allowClear
                            onChange={(value) => handleFilterChange('productId', value)}
                            value={filters.productId}
                            options={products.map(p => ({ label: p.name, value: p.id }))}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>{t('sales_history.filters.payment')}:</Text>
                        <Select
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder={t('sales_history.filters.all_methods')}
                            allowClear
                            onChange={(value) => handleFilterChange('paymentMethod', value)}
                            value={filters.paymentMethod}
                        >
                            <Select.Option value="CASH">{t('pos.checkout.cash', { defaultValue: 'Cash' })}</Select.Option>
                            <Select.Option value="DEBIT">{t('pos.checkout.debit_card', { defaultValue: 'Debit Card' })}</Select.Option>
                            <Select.Option value="CREDIT">{t('pos.checkout.credit_card', { defaultValue: 'Credit Card' })}</Select.Option>
                            <Select.Option value="TRANSFER">{t('pos.checkout.transfer', { defaultValue: 'Transfer' })}</Select.Option>
                            <Select.Option value="MOBILE">{t('pos.checkout.mobile_pay', { defaultValue: 'Mobile Payment' })}</Select.Option>
                        </Select>
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>{t('sales_history.filters.min_amount')}:</Text>
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
                        <Button onClick={handleResetFilters}>{t('sales_history.filters.clear')}</Button>
                        <Button type="primary" onClick={() => refetch()} loading={isLoading}>{t('sales_history.filters.apply')}</Button>
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
                    scroll={{ x: 'max-content' }}
                    size="small"
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
                title={t('sales_history.messages.edit_payment_title')}
                open={isEditPaymentModalOpen}
                onCancel={() => setIsEditPaymentModalOpen(false)}
                onOk={handleEditPayment}
                confirmLoading={updatePaymentSchema.isPending}
            >
                <Text>{t('sales_history.messages.select_new_method', { invoice: selectedSale?.invoiceNumber })}</Text>
                <Select
                    style={{ width: '100%', marginTop: 16 }}
                    value={newPaymentMethod}
                    onChange={setNewPaymentMethod}
                >
                    <Select.Option value="CASH">{t('pos.checkout.cash', { defaultValue: 'Cash (Bs)' })}</Select.Option>
                    <Select.Option value="DEBIT">{t('pos.checkout.debit_card', { defaultValue: 'Debit Card' })}</Select.Option>
                    <Select.Option value="CREDIT">{t('pos.checkout.credit_card', { defaultValue: 'Credit Card' })}</Select.Option>
                    <Select.Option value="TRANSFER">{t('pos.checkout.transfer', { defaultValue: 'Transfer' })}</Select.Option>
                    <Select.Option value="MOBILE">{t('pos.checkout.mobile_pay', { defaultValue: 'Mobile Payment' })}</Select.Option>
                    <Select.Option value="CURRENCY_USD">{t('pos.checkout.currency_prefix', { defaultValue: 'Cash' })} USD</Select.Option>
                    <Select.Option value="CURRENCY_EUR">{t('pos.checkout.currency_prefix', { defaultValue: 'Cash' })} EUR</Select.Option>
                </Select>
                <div style={{ marginTop: 12 }}>
                    <Text type="warning" style={{ fontSize: 12 }}>
                        {t('sales_history.messages.edit_payment_note')}
                    </Text>
                </div>
            </Modal>
        </div>
    );
};