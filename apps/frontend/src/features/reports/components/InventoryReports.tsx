import { useEffect, useState } from 'react';
import { Card, Table, Spin, Empty, Row, Col, Statistic, Tooltip } from 'antd';
import { ShopOutlined, DollarOutlined, WarningOutlined } from '@ant-design/icons';
import { statsApi, type InventoryReport } from '../../../services/statsApi';
import { usePOSStore } from '../../../store/posStore';
import { ReportCurrencySelector } from './ReportCurrencySelector';
import { formatVenezuelanPriceOnly } from '../../../utils/formatters';

export const InventoryReports = () => {
    const [report, setReport] = useState<InventoryReport | null>(null);
    const [loading, setLoading] = useState(true);
    const { primaryCurrency, currencies } = usePOSStore();
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');

    const currentCurrencyObj = currencies.find(c => c.code === selectedCurrency);
    const currencySymbol = currentCurrencyObj?.symbol || 'Bs';

    // Initialize to primary
    useEffect(() => {
        if (primaryCurrency && selectedCurrency === 'VES') {
            setSelectedCurrency(primaryCurrency.code);
        }
    }, [primaryCurrency]);

    useEffect(() => {
        fetchReport();
    }, [selectedCurrency]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const data = await statsApi.getInventoryReport(selectedCurrency);
            setReport(data);
        } catch (error) {
            console.error('Error fetching inventory report:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!report) {
        return <Empty description="Error al cargar reporte de inventario" />;
    }

    const deptColumns = [
        {
            title: 'Departamento',
            dataIndex: 'department',
            key: 'department',
        },
        {
            title: 'Unidades',
            dataIndex: 'units',
            key: 'units',
            align: 'right' as const,
        },
        {
            title: 'Valor Total',
            dataIndex: 'value',
            key: 'value',
            align: 'right' as const,
            render: (value: number) => `${currencySymbol} ${formatVenezuelanPriceOnly(value)}`,
        },
    ];

    const lowStockColumns = [
        {
            title: 'Producto',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Categoría',
            dataIndex: ['category', 'name'],
            key: 'category',
        },
        {
            title: 'Stock Actual',
            dataIndex: 'stock',
            key: 'stock',
            align: 'right' as const,
            render: (stock: number) => (
                <span style={{ color: stock === 0 ? '#ff4d4f' : '#faad14' }}>
                    {stock}
                </span>
            ),
        },
    ];

    return (
        <div>
            {/* Summary Cards */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={8}>
                    <Card>
                        <Tooltip
                            title={
                                <div>
                                    <div style={{ marginBottom: 4, fontWeight: 'bold' }}>Moneda del Reporte:</div>
                                    <ReportCurrencySelector
                                        value={selectedCurrency}
                                        onChange={setSelectedCurrency}
                                    />
                                </div>
                            }
                        >
                            <div style={{ cursor: 'pointer' }}>
                                <Statistic
                                    title={
                                        <span>
                                            Valor Total de Inventario <DollarOutlined style={{ fontSize: 12, marginLeft: 4 }} />
                                        </span>
                                    }
                                    value={report.totalInventoryValue}
                                    precision={2}
                                    prefix={currencySymbol}
                                    valueStyle={{ color: '#1890ff' }}
                                    styles={{ content: { color: '#1890ff' } }}
                                />
                            </div>
                        </Tooltip>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card>
                        <Statistic
                            title="Departamentos"
                            value={report.stockByDepartment.length}
                            valueStyle={{ color: '#52c41a' }}
                            styles={{ content: { color: '#52c41a' } }}
                            suffix={<ShopOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card>
                        <Statistic
                            title="Productos con Stock Bajo"
                            value={report.lowStockProducts.length}
                            valueStyle={{ color: '#faad14' }}
                            styles={{ content: { color: '#faad14' } }}
                            suffix={<WarningOutlined />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Stock by Department */}
            <Card title="Stock por Departamento" style={{ marginBottom: 16 }}>
                <Table
                    dataSource={report.stockByDepartment}
                    columns={deptColumns}
                    rowKey="department"
                    pagination={false}
                />
            </Card>

            {/* Low Stock Products */}
            <Card title="Productos con Stock Bajo">
                <Table
                    dataSource={report.lowStockProducts}
                    columns={lowStockColumns}
                    rowKey="name"
                    pagination={{ pageSize: 10 }}
                />
            </Card>
        </div>
    );
};