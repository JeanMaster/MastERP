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
    Alert,
    Pagination,
    Tag
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
    const [currentPage, setCurrentPage] = useState<number>(1);
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

    const totalPages = Math.max(1, Math.ceil(sales.length / pageSize));
    const activePage = currentPage > totalPages ? 1 : currentPage;

    const paginatedSales = sales.slice(
        (activePage - 1) * pageSize,
        activePage * pageSize
    );



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
        setCurrentPage(1);
    };

    const handleFilterChange = (key: keyof SalesFilters, value: any) => {
        setFilters(prev => ({
            ...prev,
            [key]: value || undefined
        }));
        setCurrentPage(1);
    };

    const handleResetFilters = () => {
        setFilters({});
        setDateRange(null);
        setCurrentPage(1);
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
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row justify="space-between" align="middle" gutter={[16, 24]}>
                    <Col xs={24} md={12}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Historial de Ventas</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Consulta y gestiona todas las transacciones realizadas.</Text>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <Space wrap size={12} style={{ width: isMobile ? '100%' : 'auto' }}>
                            <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={() => refetch()}
                                block={isMobile}
                                size="large"
                                style={{ borderRadius: 8 }}
                            >
                                Actualizar
                            </Button>
                            <Button
                                icon={<DownloadOutlined />}
                                disabled={sales.length === 0}
                                block={isMobile}
                                size="large"
                                style={{ borderRadius: 8 }}
                            >
                                Exportar
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </div>

            {/* Summary Statistics */}
            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                <Col xs={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#e6f7ff' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>TOTAL VENTAS</Text>}
                            value={totalSalesCount}
                            prefix={<ShoppingOutlined style={{ color: '#1890ff' }} />}
                            styles={{ content: { color: '#1890ff', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f6ffed' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>INGRESO REAL</Text>}
                            value={totalAdjustedRevenue}
                            precision={2}
                            prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            styles={{ content: { color: '#52c41a', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f9f9f9' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>FAC. NOMINAL</Text>}
                            value={summary.nominalRevenue || 0}
                            precision={2}
                            prefix={<ShoppingOutlined style={{ opacity: 0.7, color: '#595959' }} />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            styles={{ content: { color: '#595959', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fff1f0' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>DESCUENTOS</Text>}
                            value={totalDiscount}
                            precision={2}
                            prefix={<DollarOutlined style={{ color: '#ff4d4f' }} />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            styles={{ content: { color: '#ff4d4f', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={5}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f9f0ff' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>TICKET PROMEDIO</Text>}
                            value={averageTicket}
                            precision={2}
                            prefix={<DollarOutlined style={{ color: '#722ed1' }} />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            styles={{ content: { color: '#722ed1', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
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

            <Card 
                title={<Text strong style={{ fontSize: 16 }}>{t('sales_history.filters.title')}</Text>} 
                variant="borderless"
                style={{ marginBottom: 24, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                size={isMobile ? 'small' : 'default'}
            >
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={12} lg={8}>
                        <Text strong style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 8 }}>{t('sales_history.filters.date_range').toUpperCase()}</Text>
                        <RangePicker
                            style={{ width: '100%' }}
                            value={dateRange}
                            onChange={handleDateRangeChange}
                            format="MM/DD/YYYY"
                            placeholder={[t('sales_history.filters.start_date'), t('sales_history.filters.end_date')]}
                            size="large"
                        />
                    </Col>
                    <Col xs={12} md={6} lg={4}>
                        <Text strong style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 8 }}>{t('sales_history.filters.payment').toUpperCase()}</Text>
                        <Select
                            style={{ width: '100%' }}
                            placeholder={t('sales_history.filters.all_methods')}
                            allowClear
                            onChange={(value) => handleFilterChange('paymentMethod', value)}
                            value={filters.paymentMethod}
                            size="large"
                        >
                            <Select.Option value="CASH">{t('pos.checkout.cash')}</Select.Option>
                            <Select.Option value="DEBIT">{t('pos.checkout.debit_card')}</Select.Option>
                            <Select.Option value="CREDIT">{t('pos.checkout.credit_card')}</Select.Option>
                            <Select.Option value="TRANSFER">{t('pos.checkout.transfer')}</Select.Option>
                            <Select.Option value="MOBILE">{t('pos.checkout.mobile_pay')}</Select.Option>
                        </Select>
                    </Col>
                    <Col xs={12} md={6} lg={4}>
                        <Text strong style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 8 }}>{t('sales_history.filters.min_amount').toUpperCase()}</Text>
                        <InputNumber
                            style={{ width: '100%' }}
                            placeholder="0.00"
                            min={0}
                            onChange={(value) => handleFilterChange('minAmount', value)}
                            value={filters.minAmount}
                            size="large"
                        />
                    </Col>
                    
                    <Col xs={24} lg={8}>
                        <Text strong style={{ fontSize: 12, color: '#8c8c8c', display: 'block', marginBottom: 8 }}>{t('sales_history.filters.customer').toUpperCase()}</Text>
                        <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder={t('sales_history.filters.all_customers')}
                            allowClear
                            onChange={(value) => handleFilterChange('clientId', value)}
                            value={filters.clientId}
                            options={clients.map(c => ({ label: c.name, value: c.id }))}
                            optionFilterProp="label"
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            size="large"
                        />
                    </Col>
                </Row>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, gap: 12 }}>
                    <Button onClick={handleResetFilters} size="large" style={{ borderRadius: 8 }}>{t('sales_history.filters.clear')}</Button>
                    <Button type="primary" onClick={() => refetch()} loading={isLoading} size="large" style={{ borderRadius: 8 }}>{t('sales_history.filters.apply')}</Button>
                </div>
            </Card>

            {!isMobile ? (
                <Card styles={{ body: { padding: 24 } }}>
                    <Table
                        columns={columns}
                        dataSource={sales}
                        rowKey="id"
                        loading={isLoading}
                        pagination={{
                            current: activePage,
                            pageSize,
                            onChange: (page, size) => {
                                setCurrentPage(page);
                                setPageSize(size);
                            },
                            showSizeChanger: true,
                            pageSizeOptions: ['10', '20', '50', '100'],
                            responsive: true
                        }}
                        scroll={{ x: 'max-content' }}
                        size="small"
                    />
                </Card>
            ) : (
                <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {paginatedSales.map((item: Sale) => (
                            <Card
                                key={item.id}
                                variant="borderless"
                                style={{
                                    borderRadius: 16,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    overflow: 'hidden',
                                    background: '#fff'
                                }}
                                styles={{ body: { padding: 0 } }}
                            >
                                <div style={{ padding: '16px 16px 12px 16px', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <Text strong style={{ fontSize: 16, color: '#1890ff', cursor: 'pointer' }} onClick={() => { setSelectedSale(item); setIsDetailModalOpen(true); }}>
                                                #{item.invoiceNumber}
                                            </Text>
                                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                                                {dayjs(item.date).format('DD/MM/YYYY HH:mm')}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>
                                                {formatVenezuelanPrice(item.revaluedTotal ?? item.total ?? 0)}
                                            </div>
                                            <Tag color="processing" style={{ margin: 0, borderRadius: 4, fontSize: 10, fontWeight: 700 }}>
                                                {item.paymentMethod.split(',')[0]}
                                            </Tag>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ padding: 16 }}>
                                    <div style={{ marginBottom: 12 }}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Cliente</Text>
                                        <Text strong style={{ fontSize: 14 }}>{item.client?.name || t('sales_history.table.walk_in')}</Text>
                                    </div>

                                    <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Resumen Productos</Text>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {item.items.slice(0, 3).map(i => (
                                            <Tag key={i.id} style={{ margin: 0, background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 11, padding: '2px 8px' }}>
                                                {i.product.name} <Text type="secondary">x{i.quantity}</Text>
                                            </Tag>
                                        ))}
                                        {item.items.length > 3 && (
                                            <Tag style={{ margin: 0, background: '#f5f5f5', border: 'none', borderRadius: 6, fontSize: 11 }}>+{item.items.length - 3} más</Tag>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f9f9f9', padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
                                    <Button
                                        type="link"
                                        size="middle"
                                        icon={<PrinterOutlined />}
                                        onClick={() => {
                                            setSelectedSale(item);
                                            setIsInvoiceModalOpen(true);
                                        }}
                                        style={{ padding: 0, fontWeight: 600 }}
                                    >
                                        Imprimir
                                    </Button>
                                    <Space size={12}>
                                        <Button
                                            type="text"
                                            size="middle"
                                            icon={<EditOutlined style={{ color: '#8c8c8c' }} />}
                                            onClick={() => {
                                                setSelectedSale(item);
                                                setNewPaymentMethod(item.paymentMethod.split(',')[0]);
                                                setIsEditPaymentModalOpen(true);
                                            }}
                                        />
                                        <Button
                                            type="text"
                                            size="middle"
                                            danger
                                            icon={<DeleteOutlined />}
                                            onClick={() => handleDeleteSale(item)}
                                        />
                                    </Space>
                                </div>
                            </Card>
                        ))}
                    </div>
                    <div style={{ padding: '12px', textAlign: 'center' }}>
                        <Pagination
                            size="small"
                            current={activePage}
                            total={sales.length}
                            pageSize={pageSize}
                            simple
                            onChange={(page, size) => {
                                setCurrentPage(page);
                                if (size) setPageSize(size);
                            }}
                        />
                    </div>
                </div>
            )}

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