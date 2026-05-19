import { useState } from 'react';
import { Card, Row, Col, Statistic, Table, Radio, Space, Typography, Tag, Tooltip, Grid, Pagination } from 'antd';
import {
    RiseOutlined,
    WarningOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../../services/statsApi';
import { usePOSStore } from '../../../store/posStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const COGSReport: React.FC = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [dateFilter, setDateFilter] = useState<'day' | 'month' | 'all'>('month');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const { currencies } = usePOSStore();

    const getDates = () => {
        if (dateFilter === 'day') {
            return {
                startDate: dayjs().format('YYYY-MM-DD'),
                endDate: dayjs().format('YYYY-MM-DD'),
            };
        }
        if (dateFilter === 'month') {
            return {
                startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
                endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
            };
        }
        return { startDate: '2000-01-01', endDate: dayjs().format('YYYY-MM-DD') };
    };

    const { data: report, isLoading } = useQuery({
        queryKey: ['cogsReport', selectedCurrency, dateFilter],
        queryFn: () => {
            const { startDate, endDate } = getDates();
            return statsApi.getCOGSReport(selectedCurrency, startDate, endDate);
        },
    });

    const paginatedProducts = report?.products?.slice((currentPage - 1) * pageSize, currentPage * pageSize) || [];

    if (isLoading || !report) return <Card loading />;

    const currencySymbol = currencies.find((c: any) => c.code === selectedCurrency)?.symbol || selectedCurrency;

    // MATH LOGIC
    const utilityOperativa = report.totalSales - report.totalCOGS - report.totalExpenses - report.totalInflationLoss;
    const restockNeed = Math.max(0, report.totalCOGS - report.totalPurchases);
    const estimatedCashFlow = report.totalSales - report.totalPurchases - report.totalExpenses;

    const getPercentage = (value: number) => {
        if (!report.totalSales || report.totalSales === 0) return '0%';
        return `${((value / report.totalSales) * 100).toFixed(1)}%`;
    };

    const columns = [
        { title: 'Producto', dataIndex: 'name', key: 'name' },
        { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (sku: string) => sku || '-' },
        {
            title: 'Cant.',
            dataIndex: 'quantity',
            key: 'quantity',
            render: (q: number) => q.toLocaleString(),
            sorter: (a: any, b: any) => (Number(a.quantity) || 0) - (Number(b.quantity) || 0)
        },
        {
            title: 'Costo Total',
            dataIndex: 'totalCost',
            key: 'totalCost',
            render: (val: number) => `${currencySymbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sorter: (a: any, b: any) => (Number(a.totalCost) || 0) - (Number(b.totalCost) || 0)
        },
        {
            title: 'Venta Total',
            dataIndex: 'totalRevenue',
            key: 'totalRevenue',
            render: (val: number) => `${currencySymbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            sorter: (a: any, b: any) => (Number(a.totalRevenue) || 0) - (Number(b.totalRevenue) || 0)
        },
        {
            title: 'Pérdida Inflación',
            dataIndex: 'inflationLoss',
            key: 'inflationLoss',
            render: (val: number) => (
                <Text type="danger">
                    -{currencySymbol} {val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
            ),
            sorter: (a: any, b: any) => (Number(a.inflationLoss) || 0) - (Number(b.inflationLoss) || 0)
        },
        {
            title: 'Margen Real',
            key: 'realMargin',
            render: (_: any, record: any) => {
                const realProfit = record.totalRevenue - record.totalCost - record.inflationLoss;
                const pct = record.totalRevenue > 0 ? (realProfit / record.totalRevenue) * 100 : 0;

                return (
                    <Space direction="vertical" size={0}>
                        <Text strong style={{ color: realProfit >= 0 ? '#52c41a' : '#cf1322' }}>
                            {currencySymbol} {realProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>
                        <Tag color={pct >= 15 ? 'green' : pct >= 10 ? 'orange' : 'red'}>
                            {pct.toFixed(1)}% Real
                        </Tag>
                    </Space>
                );
            },
            sorter: (a: any, b: any) => {
                const profitA = a.totalRevenue - a.totalCost - a.inflationLoss;
                const profitB = b.totalRevenue - b.totalCost - b.inflationLoss;
                return profitA - profitB;
            }
        },
        {
            title: 'Ajuste Sugerido',
            key: 'suggestedAdjustment',
            render: (_: any, record: any) => {
                const inflImpactPct = record.totalRevenue > 0 ? (record.inflationLoss / record.totalRevenue) : 0;
                const nominalMarginPct = record.totalRevenue > 0 ? (record.totalRevenue - record.totalCost) / record.totalRevenue : 0;
                const realMarginPct = nominalMarginPct - inflImpactPct;

                // Target real margin: 15%
                const targetRealMargin = 0.15;
                if (realMarginPct >= targetRealMargin) return <Tag color="blue">OK</Tag>;

                // Suggested Increase %: (Target - CurrentReal) / (1 - Target - Impact)
                // Using a simpler heuristic for the UI:
                const neededIncrease = Math.max(0, (targetRealMargin - realMarginPct) * 100);

                return (
                    <Tooltip title={`Para alcanzar 15% de margen real, considera subir el precio un ${neededIncrease.toFixed(1)}% aproximadamente.`}>
                        <Tag color="volcano" icon={<RiseOutlined />}>+{neededIncrease.toFixed(1)}%</Tag>
                    </Tooltip>
                );
            }
        },
    ];

    return (
        <div style={{ padding: '0px' }}>
            {/* Header section */}
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row gutter={[16, 24]} align="middle">
                    <Col xs={24} lg={12}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Análisis de Reposición</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Rendimiento real vs. costo de reposición e inflación.</Text>
                    </Col>
                    <Col xs={24} lg={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <div>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>PERÍODO</Text>
                                <Radio.Group 
                                    value={dateFilter} 
                                    onChange={(e) => {
                                        setDateFilter(e.target.value);
                                        setCurrentPage(1);
                                    }} 
                                    buttonStyle="solid"
                                    size="large"
                                    block={isMobile}
                                >
                                    <Radio.Button value="day">Hoy</Radio.Button>
                                    <Radio.Button value="month">Este Mes</Radio.Button>
                                    <Radio.Button value="all">Todo</Radio.Button>
                                </Radio.Group>
                            </div>
                            <div>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>MONEDA</Text>
                                <Radio.Group 
                                    value={selectedCurrency} 
                                    onChange={(e) => setSelectedCurrency(e.target.value)} 
                                    buttonStyle="solid"
                                    size="large"
                                    block={isMobile}
                                >
                                    {currencies.map((c: any) => (
                                        <Radio.Button key={c.code} value={c.code}>{c.code}</Radio.Button>
                                    ))}
                                </Radio.Group>
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>

            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>VENTAS TOTALES</Text>}
                            value={report.totalSales}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#52c41a', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Total facturado</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>FLUJO CAJA ESTIMADO</Text>}
                            value={estimatedCashFlow}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: estimatedCashFlow >= 0 ? '#1890ff' : '#ff4d4f', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Disponible estimado</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>COGS TOTAL</Text>}
                            value={report.totalCOGS}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#722ed1', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Costo de lo vendido</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>GAP REPOSICIÓN</Text>}
                            value={restockNeed}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: restockNeed > 0 ? '#faad14' : '#52c41a', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                            suffix={<WarningOutlined style={{ opacity: 0.5 }} />}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Inversión faltante</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, background: '#fff1f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="danger" style={{ fontSize: 11 }}>DEVALUACIÓN</Text>}
                            value={report.totalInflationLoss}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#cf1322', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="danger" style={{ fontSize: 10 }}>Impacto inflacionario</Text>
                    </Card>
                </Col>
                <Col xs={12} sm={12} lg={4}>
                    <Card variant="borderless" style={{ borderRadius: 12, background: '#f6ffed', border: '1px solid #b7eb8f', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text strong style={{ color: '#389e0d', fontSize: 11 }}>UTILIDAD REAL</Text>}
                            value={utilityOperativa}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#52c41a', fontSize: isMobile ? 22 : 26, fontWeight: 800 } }}
                        />
                        <Text type="success" style={{ fontSize: 10, fontWeight: 700 }}>NETO: {getPercentage(utilityOperativa)}</Text>
                    </Card>
                </Col>
            </Row>

            <Card 
                title={isMobile ? "Detalle de Costos" : "Detalle de Costos por Producto Vendido"} 
                variant="borderless" 
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 12 }}
                styles={{ body: { padding: isMobile ? 0 : 24 } }}
            >
                {!isMobile ? (
                    <Table
                        dataSource={report.products}
                        columns={columns}
                        rowKey="sku"
                        pagination={{
                            current: currentPage,
                            pageSize,
                            showSizeChanger: true,
                            onChange: (page, size) => {
                                setCurrentPage(page);
                                setPageSize(size);
                            },
                            pageSizeOptions: ['10', '20', '50', '100']
                        }}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {paginatedProducts.map((item: any) => {
                            const realProfit = item.totalRevenue - item.totalCost - item.inflationLoss;
                            const pct = item.totalRevenue > 0 ? (realProfit / item.totalRevenue) * 100 : 0;
                            const neededIncrease = Math.max(0, (0.15 - (pct/100)) * 100);

                            return (
                                <Card key={item.sku} variant="borderless" style={{ background: '#fafafa', borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <div style={{ maxWidth: '70%' }}>
                                            <Text strong style={{ fontSize: 14 }}>{item.name}</Text>
                                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>SKU: {item.sku || '-'}</div>
                                        </div>
                                        <Tag color="blue" style={{ margin: 0, borderRadius: 6, fontWeight: 700 }}>{item.quantity} UDS</Tag>
                                    </div>
                                    
                                    <Row gutter={[16, 12]} style={{ marginBottom: 12 }}>
                                        <Col span={12}>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>COSTO TOTAL</Text>
                                            <Text strong>{currencySymbol} {item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                                        </Col>
                                        <Col span={12} style={{ textAlign: 'right' }}>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>VENTA TOTAL</Text>
                                            <Text strong>{currencySymbol} {item.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                                        </Col>
                                        <Col span={12}>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>PÉRDIDA INFL.</Text>
                                            <Text type="danger">-{currencySymbol} {item.inflationLoss.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                                        </Col>
                                        <Col span={12} style={{ textAlign: 'right' }}>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>MARGEN REAL</Text>
                                            <Text strong style={{ color: realProfit >= 0 ? '#52c41a' : '#cf1322' }}>
                                                {pct.toFixed(1)}%
                                            </Text>
                                        </Col>
                                    </Row>
                                    
                                    <div style={{ padding: '10px 12px', background: realProfit >= 0 ? '#f6ffed' : '#fff1f0', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text strong style={{ fontSize: 12 }}>UTILIDAD REAL:</Text>
                                        <Text strong style={{ color: realProfit >= 0 ? '#52c41a' : '#cf1322', fontSize: 15 }}>
                                            {currencySymbol} {realProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </Text>
                                    </div>

                                    {neededIncrease > 0 && (
                                        <div style={{ textAlign: 'center', background: '#fff7e6', padding: '6px', borderRadius: 6, border: '1px dashed #ffd591' }}>
                                            <Text style={{ fontSize: 11, color: '#d46b08' }}>
                                                <RiseOutlined /> Ajuste sugerido: <Text strong>+{neededIncrease.toFixed(1)}%</Text>
                                            </Text>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                            <Pagination 
                                current={currentPage}
                                total={report.products.length}
                                pageSize={pageSize}
                                onChange={setCurrentPage}
                                size="small"
                                showSizeChanger={false}
                            />
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default COGSReport;
