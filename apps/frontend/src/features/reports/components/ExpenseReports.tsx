
import { useEffect, useState } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, Radio, Table, Progress, Tooltip as AntTooltip, Typography } from 'antd';
import {
    DollarOutlined,
    ShoppingOutlined,
    PieChartOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { statsApi, type ExpenseReport } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { usePOSStore } from '../../../store/posStore';
import { ReportCurrencySelector } from './ReportCurrencySelector';
import dayjs from 'dayjs';

const { Text } = Typography;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6384', '#36A2EB', '#FFCE56'];

export const ExpenseReports = () => {
    const [report, setReport] = useState<ExpenseReport | null>(null);
    const [loading, setLoading] = useState(true);
    const { primaryCurrency, currencies } = usePOSStore();
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const [dateFilter, setDateFilter] = useState<string>('month');

    const currentCurrencyObj = currencies.find(c => c.code === selectedCurrency);
    const currencySymbol = currentCurrencyObj?.symbol || 'Bs';

    useEffect(() => {
        if (primaryCurrency && selectedCurrency === 'VES') {
            setSelectedCurrency(primaryCurrency.code);
        }
    }, [primaryCurrency]);

    useEffect(() => {
        fetchReport();
    }, [selectedCurrency, dateFilter]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            let startDate: string | undefined;
            let endDate: string | undefined;

            if (dateFilter === 'day') {
                startDate = dayjs().format('YYYY-MM-DD');
                endDate = dayjs().format('YYYY-MM-DD');
            } else if (dateFilter === 'yesterday') {
                startDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
                endDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
            } else if (dateFilter === 'month') {
                startDate = dayjs().startOf('month').format('YYYY-MM-DD');
                endDate = dayjs().endOf('month').format('YYYY-MM-DD');
            } else if (dateFilter === 'lastMonth') {
                startDate = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
                endDate = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
            } else if (dateFilter === 'all') {
                startDate = '2000-01-01';
                endDate = dayjs().format('YYYY-MM-DD');
            }

            const data = await statsApi.getExpensesReport(selectedCurrency, startDate, endDate);
            setReport(data);
        } catch (error) {
            console.error('Error fetching expense report:', error);
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
        return <Empty description="Error al cargar reporte de gastos" />;
    }

    const percentageOfSales = report.totalSales > 0 ? (report.totalExpenses / report.totalSales) * 100 : 0;

    // Table Columns
    const columns = [
        {
            title: 'Categoría',
            dataIndex: 'category',
            key: 'category',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Monto Total',
            dataIndex: 'amount',
            key: 'amount',
            align: 'right' as const,
            render: (value: number) => formatVenezuelanPrice(value),
            sorter: (a: any, b: any) => a.amount - b.amount
        },
        {
            title: '% de Ventas',
            dataIndex: 'percentageOfSales',
            key: 'percentageOfSales',
            align: 'right' as const,
            render: (value: number) => (
                <div style={{ width: 140 }}>
                    <AntTooltip title={`${value.toFixed(2)}% de las ventas totales`}>
                        <Progress percent={value} size="small" status={value > 30 ? 'exception' : 'normal'} format={percent => `${percent?.toFixed(1)}%`} />
                    </AntTooltip>
                </div>

            ),
            sorter: (a: any, b: any) => a.percentageOfSales - b.percentageOfSales
        }
    ];

    return (
        <div>
            {/* Filters */}
            <div style={{ marginBottom: 20 }}>
                <Row gutter={[16, 16]} align="middle" justify="space-between">
                    <Col xs={24} md={12}>
                        <Radio.Group
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            buttonStyle="solid"
                        >
                            <Radio.Button value="day">Hoy</Radio.Button>
                            <Radio.Button value="month">Este Mes</Radio.Button>
                            <Radio.Button value="lastMonth">Mes Anterior</Radio.Button>
                            <Radio.Button value="all">Todo</Radio.Button>
                        </Radio.Group>
                    </Col>
                    <Col xs={24} md={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                            <span style={{ fontWeight: 'bold' }}>Moneda del Reporte:</span>
                            <ReportCurrencySelector
                                value={selectedCurrency}
                                onChange={setSelectedCurrency}
                                style={{ width: 200 }}
                            />
                        </div>
                    </Col>
                </Row>
            </div>

            {/* KPIs */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ background: '#fff1f0', border: '1px solid #ffccc7' }}>
                        <Statistic
                            title="Total Gastos"
                            value={report.totalExpenses}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#cf1322' }}
                            suffix={<ShoppingOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                        <Statistic
                            title="Total Ventas (Referencia)"
                            value={report.totalSales}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#389e0d' }}
                            suffix={<DollarOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} style={{ background: '#e6f7ff', border: '1px solid #91d5ff' }}>
                        <Statistic
                            title="Impacto en Ventas"
                            value={percentageOfSales}
                            precision={2}
                            valueStyle={{ color: '#096dd9' }}
                            suffix="%"
                            prefix={<PieChartOutlined />}
                        />
                        <div style={{ fontSize: 12, color: '#666' }}>
                            Qué porcentaje del ingreso se va en gastos
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Charts Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} md={12}>
                    <Card title="Distribución de Gastos (por Categoría)">
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={report.expensesByCategory}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    nameKey="category"
                                    label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="amount"
                                >
                                    {report.expensesByCategory.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatVenezuelanPrice(value)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col xs={24} md={12}>
                    <Card title="Gastos vs % de Ventas">
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                                data={report.expensesByCategory}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis type="category" dataKey="category" width={100} />
                                <Tooltip formatter={(value: number) => formatVenezuelanPrice(value)} />
                                <Legend />
                                <Bar dataKey="amount" name="Monto" fill="#FF8042" />
                            </BarChart>
                        </ResponsiveContainer>
                        <div style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 10 }}>
                            * Gráfico muestra montos absolutos por categoría
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Detailed Table */}
            <Card title="Detalle de Gastos y Rentabilidad">
                <Table
                    columns={columns}
                    dataSource={report.expensesByCategory}
                    rowKey="category"
                    pagination={false}
                    summary={() => {
                        return (
                            <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                                <Table.Summary.Cell index={0}>Total General</Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">
                                    {formatVenezuelanPrice(report.totalExpenses)}
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={2} align="right">
                                    {percentageOfSales.toFixed(2)}%
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                        );
                    }}
                />
            </Card>
        </div>
    );
};
