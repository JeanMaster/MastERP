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

    const updatePaymentSchema = useMutation({
        mutationFn: (variables: { id: string, method: string }) =>
            salesApi.updatePaymentMethod(variables.id, variables.method),
        onSuccess: () => {
            message.success('Método de pago actualizado');
            setIsEditPaymentModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['sales-reports'] });
        },
        onError: () => {
            message.error('Error al actualizar método de pago');
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

    const deleteSaleMutation = useMutation({
        mutationFn: (id: string) => salesApi.remove(id),
        onSuccess: () => {
            message.success('Venta eliminada y stock restaurado');
            queryClient.invalidateQueries({ queryKey: ['sales-reports'] });
        },
        onError: () => {
            message.error('Error al eliminar la venta');
        }
    });

    const handleDeleteSale = (sale: Sale) => {
        Modal.confirm({
            title: '¿Eliminar Venta?',
            content: `Esta acción anulará la factura ${sale.invoiceNumber}, restaurará el stock de los productos y, si fue la última venta, permitirá reutilizar el número de factura.`,
            okText: 'Sí, Eliminar',
            okType: 'danger',
            cancelText: 'No',
            onOk: () => deleteSaleMutation.mutate(sale.id)
        });
    };

    // Fetch sales data with filters
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['sales-reports', filters],
        queryFn: () => salesApi.getWithFilters(filters),
        enabled: true
    });

    const sales = data?.sales || [];
    const summary = data?.summary || { totalVentas: 0, ingresoBruto: 0, ingresoNominal: 0, descuentos: 0, ticketPromedio: 0 };

    // Fetch reference data for filters
    const { data: products = [] } = useQuery({
        queryKey: ['products'],
        queryFn: () => productsApi.getAll(),
    });

    const { data: clients = [] } = useQuery({
        queryKey: ['clients'],
        queryFn: () => clientsApi.getAll(),
    });

    // Use backend summary statistics
    const totalSales = summary.totalVentas;
    const totalRevenue = summary.ingresoBruto;
    const totalDiscount = summary.descuentos;
    const averageTicket = summary.ticketPromedio;

    // Handle filter changes
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

    // Simplified table columns - only showing: Factura, Fecha, Productos, Total
    const columns = [
        {
            title: 'Factura',
            dataIndex: 'invoiceNumber',
            key: 'invoiceNumber',
            width: 100,
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
            title: 'Fecha',
            dataIndex: 'date',
            key: 'date',
            width: 140,
            render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm'),
            sorter: (a: Sale, b: Sale) => dayjs(a.date).unix() - dayjs(b.date).unix()
        },
        {
            title: 'Cliente',
            dataIndex: 'client',
            key: 'client',
            width: 140,
            render: (client: any) => client?.name || 'Cliente General'
        },
        {
            title: 'Productos',
            key: 'products',
            // No fixed width - let it flex
            render: (_: any, record: Sale) => (
                <div style={{ maxWidth: '100%' }}>
                    {record.items.slice(0, 3).map(item => (
                        <div key={item.id} style={{ fontSize: '12px', lineHeight: '1.4', whiteSpace: 'normal' }}>
                            • {item.product.name} x{item.quantity}
                        </div>
                    ))}
                    {record.items.length > 3 && (
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                            +{record.items.length - 3} más...
                        </Text>
                    )}
                </div>
            )
        },
        {
            title: 'Monto Pagado',
            dataIndex: 'total',
            key: 'nominalTotal',
            width: 120,
            align: 'right' as const,
            render: (value: number) => (
                <Text style={{ fontSize: '14px', color: '#595959' }}>
                    {formatVenezuelanPrice(value)}
                </Text>
            ),
            sorter: (a: Sale, b: Sale) => (a.total || 0) - (b.total || 0)
        },
        {
            title: 'Total (Ajust.)',
            dataIndex: 'revaluedTotal',
            key: 'total',
            width: 120,
            align: 'right' as const,
            render: (value: number | null | undefined, record: Sale) => (
                <Text strong style={{ color: '#1890ff', fontSize: '14px' }}>
                    {formatVenezuelanPrice(value ?? record.total ?? 0)}
                </Text>
            ),
            sorter: (a: Sale, b: Sale) => (a.revaluedTotal || a.total || 0) - (b.revaluedTotal || b.total || 0)
        },
        {
            title: 'Acciones',
            key: 'actions',
            width: 120,
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
                            setNewPaymentMethod(record.paymentMethod.split(',')[0]); // Default to first method
                            setIsEditPaymentModalOpen(true);
                        }}
                        title="Editar Método de Pago"
                    />
                    <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSale(record);
                        }}
                        title="Eliminar Venta"
                    />
                    <Button
                        type="text"
                        icon={<PrinterOutlined />}
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(record);
                            setIsInvoiceModalOpen(true);
                        }}
                        title="Reimprimir Factura"
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
                        <Title level={isMobile ? 3 : 2} style={{ margin: 0 }}>📊 Reportes de Ventas</Title>
                        <Text type="secondary">Visualiza y analiza el desempeño de tus ventas</Text>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <Space wrap>
                            <Button
                                type="primary"
                                icon={<ReloadOutlined />}
                                onClick={() => refetch()}
                                block={isMobile}
                            >
                                Actualizar
                            </Button>
                            <Button
                                icon={<DownloadOutlined />}
                                disabled={sales.length === 0}
                                block={isMobile}
                            >
                                Exportar
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
                            title="Total Ventas"
                            value={totalSales}
                            prefix={<ShoppingOutlined />}
                            valueStyle={{ color: '#1890ff', fontSize: isMobile ? 18 : 22 }}
                            styles={{ content: { color: '#1890ff', fontSize: isMobile ? 18 : 22 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card size="small">
                        <Statistic
                            title="Ingreso Bruto (Ajustado)"
                            value={totalRevenue}
                            precision={2}
                            prefix={<DollarOutlined />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            valueStyle={{ color: '#52c41a', fontSize: isMobile ? 18 : 22 }}
                            styles={{ content: { color: '#52c41a', fontSize: isMobile ? 18 : 22 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card size="small" style={{ border: '1px solid #d9d9d9' }}>
                        <Statistic
                            title="Ingreso Real (Nominal)"
                            value={summary.ingresoNominal || 0}
                            precision={2}
                            prefix={<ShoppingOutlined style={{ opacity: 0.7 }} />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            valueStyle={{ color: '#595959', fontSize: isMobile ? 18 : 22 }}
                            styles={{ content: { color: '#595959', fontSize: isMobile ? 18 : 22 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card size="small">
                        <Statistic
                            title="Descuentos"
                            value={totalDiscount}
                            precision={2}
                            prefix={<DollarOutlined />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            valueStyle={{ color: '#ff4d4f', fontSize: isMobile ? 18 : 22 }}
                            styles={{ content: { color: '#ff4d4f', fontSize: isMobile ? 18 : 22 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={5}>
                    <Card size="small">
                        <Statistic
                            title="Ticket Promedio"
                            value={averageTicket}
                            precision={2}
                            prefix={<DollarOutlined />}
                            formatter={(value) => formatVenezuelanPrice(Number(value))}
                            valueStyle={{ color: '#722ed1', fontSize: isMobile ? 18 : 22 }}
                            styles={{ content: { color: '#722ed1', fontSize: isMobile ? 18 : 22 } }}
                        />
                    </Card>
                </Col>
            </Row>

            {!isMobile && (
                <Alert
                    message="Guía de Devoluciones y Ajuste por Inflación"
                    description={
                        <Space direction="vertical" size={2}>
                            <Text>• El <Text strong>Ingreso Real (Nominal)</Text> es la suma de los montos exactos cobrados el día de la venta. <Text strong style={{ color: '#cf1322' }}>Use el dato de 'Monto Pagado' en la tabla para devoluciones.</Text></Text>
                            <Text>• El <Text strong>Ingreso Bruto (Ajustado)</Text> revaloriza las ventas a la tasa de hoy para comparar peras con peras frente a la inflación.</Text>
                        </Space>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Card title="Filtros" style={{ marginBottom: 16 }} size={isMobile ? 'small' : 'default'}>
                <Row gutter={[16, 16]}>
                    <Col xs={24} md={8}>
                        <Text strong>Rango de Fechas:</Text>
                        <RangePicker
                            style={{ width: '100%', marginTop: 8 }}
                            value={dateRange}
                            onChange={handleDateRangeChange}
                            format="DD/MM/YYYY"
                            placeholder={['Inicio', 'Fin']}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>Cliente:</Text>
                        <Select
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder="Todos"
                            allowClear
                            onChange={(value) => handleFilterChange('clientId', value)}
                            value={filters.clientId}
                            options={clients.map(c => ({ label: c.name, value: c.id }))}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>Producto:</Text>
                        <Select
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder="Todos"
                            allowClear
                            onChange={(value) => handleFilterChange('productId', value)}
                            value={filters.productId}
                            options={products.map(p => ({ label: p.name, value: p.id }))}
                        />
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>Pago:</Text>
                        <Select
                            style={{ width: '100%', marginTop: 8 }}
                            placeholder="Todos"
                            allowClear
                            onChange={(value) => handleFilterChange('paymentMethod', value)}
                            value={filters.paymentMethod}
                        >
                            <Select.Option value="CASH">Efectivo</Select.Option>
                            <Select.Option value="DEBIT">T. Débito</Select.Option>
                            <Select.Option value="CREDIT">T. Crédito</Select.Option>
                            <Select.Option value="TRANSFER">Transferencia</Select.Option>
                            <Select.Option value="MOBILE">Pago Móvil</Select.Option>
                        </Select>
                    </Col>
                    <Col xs={12} md={4}>
                        <Text strong>Monto Mín:</Text>
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
                        <Button onClick={handleResetFilters}>Limpiar</Button>
                        <Button type="primary" onClick={() => refetch()} loading={isLoading}>Filtrar</Button>
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
                title="Editar Método de Pago"
                open={isEditPaymentModalOpen}
                onCancel={() => setIsEditPaymentModalOpen(false)}
                onOk={handleEditPayment}
                confirmLoading={updatePaymentSchema.isPending}
            >
                <Text>Seleccione el nuevo método de pago para la factura <Text strong>{selectedSale?.invoiceNumber}</Text>:</Text>
                <Select
                    style={{ width: '100%', marginTop: 16 }}
                    value={newPaymentMethod}
                    onChange={setNewPaymentMethod}
                >
                    <Select.Option value="CASH">Efectivo (Bs)</Select.Option>
                    <Select.Option value="DEBIT">Tarjeta Débito</Select.Option>
                    <Select.Option value="CREDIT">Tarjeta Crédito</Select.Option>
                    <Select.Option value="TRANSFER">Transferencia</Select.Option>
                    <Select.Option value="MOBILE">Pago Móvil</Select.Option>
                    <Select.Option value="CURRENCY_USD">Efectivo USD</Select.Option>
                    <Select.Option value="CURRENCY_EUR">Efectivo EUR</Select.Option>
                </Select>
                <div style={{ marginTop: 12 }}>
                    <Text type="warning" style={{ fontSize: 12 }}>
                        Nota: Esta acción solo actualiza la etiqueta del reporte.
                        Los movimientos de caja originales no se modificarán automáticamente.
                    </Text>
                </div>
            </Modal>
        </div>
    );
};