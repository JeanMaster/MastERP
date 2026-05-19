
import { useEffect, useState } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, Radio, Table, Progress, Tooltip as AntTooltip, Typography, Grid } from 'antd';
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

const { Title, Text } = Typography;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF6384', '#36A2EB', '#FFCE56'];

export const ExpenseReports = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
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
            render: (text: string) => <Text strong style={{ fontSize: isMobile ? 12 : 14 }}>{text}</Text>
        },
        {
            title: 'Monto Total',
            dataIndex: 'amount',
            key: 'amount',
            align: 'right' as const,
            render: (value: number) => (
                <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: isMobile ? 600 : 400 }}>
                    {formatVenezuelanPrice(value)}
                </span>
            ),
            sorter: (a: any, b: any) => a.amount - b.amount
        },
        {
            title: '% Ventas',
            dataIndex: 'percentageOfSales',
            key: 'percentageOfSales',
            align: 'right' as const,
            width: isMobile ? 80 : 180,
            render: (value: number) => (
                isMobile ? (
                    <Text type={value > 30 ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>
                        {value.toFixed(1)}%
                    </Text>
                ) : (
                    <div style={{ width: 140 }}>
                        <AntTooltip title={`${value.toFixed(2)}% de las ventas totales`}>
                            <Progress percent={value} size="small" status={value > 30 ? 'exception' : 'normal'} format={percent => `${percent?.toFixed(1)}%`} />
                        </AntTooltip>
                    </div>
                )
            ),
            sorter: (a: any, b: any) => a.percentageOfSales - b.percentageOfSales
        }
    ];

    return (
        <div style={{ padding: '0px' }}>
            {/* Header & Filters */}
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row gutter={[16, 24]} align="middle">
                    <Col xs={24} lg={12}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Reporte de Gastos</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Análisis de costos operativos y su impacto en las ventas.</Text>
                    </Col>
                    <Col xs={24} lg={12}>
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <div style={{ minWidth: isMobile ? '100%' : 200 }}>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>MONEDA</Text>
                                <ReportCurrencySelector
                                    value={selectedCurrency}
                                    onChange={setSelectedCurrency}
                                />
                            </div>
                            <div>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>PERÍODO</Text>
                                <Radio.Group
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    buttonStyle="solid"
                                    size="large"
                                    block={isMobile}
                                >
                                    <Radio.Button value="day">Hoy</Radio.Button>
                                    <Radio.Button value="month">Mes</Radio.Button>
                                    <Radio.Button value="lastMonth">Ant.</Radio.Button>
                                    <Radio.Button value="all">Todo</Radio.Button>
                                </Radio.Group>
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* KPIs */}
            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                <Col xs={12} lg={8}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fff1f0' }} styles={{ body: { padding: isMobile ? 12 : 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 12 }}>TOTAL GASTOS</Text>}
                            value={report.totalExpenses}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#cf1322', fontSize: isMobile ? 20 : 24, fontWeight: 800 } }}
                            suffix={<ShoppingOutlined style={{ opacity: 0.5 }} />}
                        />
                    </Card>
                </Col>
                <Col xs={12} lg={8}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f6ffed' }} styles={{ body: { padding: 12 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 12 }}>TOTAL VENTAS</Text>}
                            value={report.totalSales}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#389e0d', fontSize: isMobile ? 20 : 24, fontWeight: 800 } }}
                            suffix={<DollarOutlined style={{ opacity: 0.5 }} />}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#e6f7ff' }} styles={{ body: { padding: 12 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 12 }}>IMPACTO EN VENTAS</Text>}
                            value={percentageOfSales}
                            precision={2}
                            styles={{ content: { color: '#096dd9', fontSize: isMobile ? 20 : 24, fontWeight: 800 } }}
                            suffix="%"
                            prefix={<PieChartOutlined style={{ opacity: 0.5 }} />}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Charts Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} lg={12}>
                    <Card variant="borderless" title={<Text strong>Distribución de Gastos</Text>} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ width: '100%', height: 300, minHeight: 300 }}>
                            <ResponsiveContainer minWidth={0} width="100%" height="100%" debounce={50}>
                                <PieChart>
                                    <Pie
                                        data={report.expensesByCategory}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        nameKey="category"
                                        label={({ name, percent }: any) => isMobile ? `${(percent * 100).toFixed(0)}%` : `${name}: ${(percent * 100).toFixed(1)}%`}
                                        outerRadius={isMobile ? 70 : 90}
                                        innerRadius={isMobile ? 40 : 50}
                                        paddingAngle={5}
                                        dataKey="amount"
                                    >
                                        {report.expensesByCategory.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => formatVenezuelanPrice(value)} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card variant="borderless" title={<Text strong>Gastos por Categoría</Text>} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ width: '100%', height: 300, minHeight: 300 }}>
                            <ResponsiveContainer minWidth={0} width="100%" height="100%" debounce={50}>
                                <BarChart
                                    data={report.expensesByCategory}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: isMobile ? 0 : 40, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis type="number" axisLine={false} tickLine={false} fontSize={10} tickFormatter={(val) => isMobile ? `${(val/1000).toFixed(0)}k` : val.toLocaleString()} />
                                    <YAxis type="category" dataKey="category" width={isMobile ? 80 : 100} axisLine={false} tickLine={false} fontSize={10} />
                                    <Tooltip 
                                        formatter={(value: number) => formatVenezuelanPrice(value)}
                                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="amount" name="Monto" fill="#FF8042" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Detailed Table */}
            <Card 
                title={<Text strong>{isMobile ? "Gastos y Rentabilidad" : "Detalle de Gastos y Rentabilidad"}</Text>}
                variant="borderless"
                styles={{ body: { padding: isMobile ? 8 : 24 } }}
                style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 24 }}
            >
                {!isMobile ? (
                    <Table
                        columns={columns}
                        dataSource={report.expensesByCategory}
                        rowKey="category"
                        pagination={false}
                        size="middle"
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
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {report.expensesByCategory.map((item: any) => (
                            <Card key={item.category} variant="borderless" style={{ background: '#fafafa', borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div>
                                        <Text strong style={{ fontSize: 14 }}>{item.category}</Text>
                                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>IMPACTO EN VENTAS</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <Text strong style={{ fontSize: 16, color: '#cf1322' }}>
                                            {formatVenezuelanPrice(item.amount)}
                                        </Text>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: item.percentageOfSales > 30 ? '#ff4d4f' : '#1890ff' }}>
                                            {item.percentageOfSales.toFixed(1)}%
                                        </div>
                                    </div>
                                </div>
                                <Progress 
                                    percent={item.percentageOfSales} 
                                    size="small" 
                                    showInfo={false}
                                    status={item.percentageOfSales > 30 ? 'exception' : 'normal'}
                                    strokeColor={item.percentageOfSales > 30 ? '#ff4d4f' : '#1890ff'}
                                    style={{ margin: 0 }}
                                />
                            </Card>
                        ))}
                        <Card variant="borderless" style={{ background: '#f5f5f5', borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <Text strong>TOTAL GENERAL</Text>
                                    <div style={{ fontSize: 11, color: '#8c8c8c' }}>RESUMEN DEL PERÍODO</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: '#cf1322' }}>
                                        {formatVenezuelanPrice(report.totalExpenses)}
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        Impacto Global: {percentageOfSales.toFixed(2)}%
                                    </Text>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </Card>
        </div>
    );
};
