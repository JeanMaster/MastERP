import { useState } from 'react';
import { Card, Row, Col, Statistic, Table, Radio, Space, Typography, Tag, Grid } from 'antd';
import {
    InfoCircleOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend } from 'recharts';
import { statsApi } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const InflationReport: React.FC = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [dateFilter, setDateFilter] = useState<'month' | 'lastMonth' | 'all'>('month');

    const getDates = () => {
        if (dateFilter === 'month') {
            return {
                startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
                endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
            };
        }
        if (dateFilter === 'lastMonth') {
            return {
                startDate: dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
                endDate: dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
            };
        }
        return { startDate: '2020-01-01', endDate: dayjs().format('YYYY-MM-DD') };
    };

    const { data: report, isLoading } = useQuery({
        queryKey: ['inflationReport', dateFilter],
        queryFn: () => {
            const { startDate, endDate } = getDates();
            return statsApi.getInflationReport(startDate, endDate);
        },
    });

    if (isLoading || !report) return <Card loading />;

    const columns = [
        {
            title: 'Método de Pago',
            dataIndex: 'method',
            key: 'method',
            render: (text: string) => <Tag color="blue">{text}</Tag>
        },
        {
            title: 'Monto Nominal (Histórico)',
            dataIndex: 'nominal',
            key: 'nominal',
            render: (val: number) => `Bs. ${formatVenezuelanPrice(val)}`
        },
        {
            title: 'Valor Revaluado (Hoy)',
            dataIndex: 'revalued',
            key: 'revalued',
            render: (val: number) => `Bs. ${formatVenezuelanPrice(val)}`
        },
        {
            title: 'Pérdida por Inflación',
            dataIndex: 'loss',
            key: 'loss',
            render: (val: number) => (
                <Text type="danger" strong>
                    Bs. {formatVenezuelanPrice(val)}
                </Text>
            ),
            sorter: (a: any, b: any) => a.loss - b.loss
        },
        {
            title: '% Impacto',
            key: 'impact',
            render: (_: any, record: any) => {
                const pct = record.revalued > 0 ? (record.loss / record.revalued) * 100 : 0;
                return <Tag color={pct > 5 ? 'red' : 'orange'}>{pct.toFixed(2)}%</Tag>;
            }
        }
    ];

    const monthlyColumns = [
        {
            title: 'Mes',
            dataIndex: 'month',
            key: 'month',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Utilidad Operativa (Revaluada)',
            dataIndex: 'operatingProfit',
            key: 'operatingProfit',
            render: (val: number) => `Bs. ${formatVenezuelanPrice(val)}`
        },
        {
            title: 'Impacto Inflacionario (BS)',
            dataIndex: 'inflationLoss',
            key: 'inflationLoss',
            render: (val: number) => (
                <Text type="danger">
                    -Bs. {formatVenezuelanPrice(val)}
                </Text>
            )
        },
        {
            title: 'Utilidad Real (Post-Inflación)',
            dataIndex: 'realProfit',
            key: 'realProfit',
            render: (val: number) => (
                <Text strong style={{ color: val >= 0 ? '#52c41a' : '#cf1322', fontSize: '1.1em' }}>
                    Bs. {formatVenezuelanPrice(val)}
                </Text>
            )
        }
    ];

    return (
        <div style={{ padding: '0px' }}>
            {/* Header section */}
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row gutter={[16, 24]} align="middle">
                    <Col xs={24} lg={12}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Impacto Inflacionario</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Análisis de pérdida de valor adquisitivo en transacciones en Bolívares.</Text>
                    </Col>
                    <Col xs={24} lg={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <div>
                                <Text strong style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>PERÍODO DE ANÁLISIS</Text>
                                <Radio.Group 
                                    value={dateFilter} 
                                    onChange={(e) => setDateFilter(e.target.value)} 
                                    buttonStyle="solid"
                                    size="large"
                                    block={isMobile}
                                >
                                    <Radio.Button value="month">Este Mes</Radio.Button>
                                    <Radio.Button value="lastMonth">Mes Ant.</Radio.Button>
                                    <Radio.Button value="all">Todo el Año</Radio.Button>
                                </Radio.Group>
                            </div>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* Summary cards */}
            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" styles={{ body: { padding: 16 } }} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>RECIBIDO (BS)</Text>}
                            value={report.summary.totalNominalVES}
                            precision={2}
                            prefix="Bs."
                            styles={{ content: { color: '#8c8c8c', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Valor histórico nominal</Text>
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" styles={{ body: { padding: 16 } }} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>VALOR ACTUAL</Text>}
                            value={report.summary.totalRevaluedVES}
                            precision={2}
                            prefix="Bs."
                            styles={{ content: { color: '#1890ff', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Poder adquisitivo hoy</Text>
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" styles={{ body: { padding: 16 } }} style={{ borderRadius: 12, background: '#fff1f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="danger" style={{ fontSize: 11 }}>PÉRDIDA TOTAL</Text>}
                            value={report.summary.totalLossVES}
                            precision={2}
                            prefix="Bs."
                            styles={{ content: { color: '#cf1322', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="danger" style={{ fontSize: 10 }}>Gap inflacionario</Text>
                    </Card>
                </Col>
                <Col xs={12} lg={6}>
                    <Card variant="borderless" styles={{ body: { padding: 16 } }} style={{ borderRadius: 12, background: (report.summary.lossPercentage ?? 0) > 10 ? '#fff1f0' : '#fffbe6', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>% IMPACTO</Text>}
                            value={report.summary.lossPercentage}
                            precision={2}
                            suffix="%"
                            styles={{ content: { color: (report.summary.lossPercentage ?? 0) > 10 ? '#cf1322' : '#faad14', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Sobre el valor total</Text>
                    </Card>
                </Col>
            </Row>

            {/* Monthly Performance Table */}
            <Card 
                title={<Text strong>{isMobile ? "Rendimiento Mensual Real" : "Comparativa de Utilidad Real vs Devaluación"}</Text>} 
                style={{ marginBottom: 24, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                variant="borderless"
                styles={{ body: { padding: isMobile ? 8 : 24 } }}
            >
                {!isMobile ? (
                    <Table
                        dataSource={report.monthlyHistory}
                        columns={monthlyColumns}
                        rowKey="month"
                        pagination={false}
                        size="middle"
                        summary={(pageData) => {
                            let totalProfit = 0;
                            let totalLoss = 0;
                            let totalReal = 0;

                            pageData.forEach(({ operatingProfit, inflationLoss, realProfit }) => {
                                totalProfit += operatingProfit;
                                totalLoss += inflationLoss;
                                totalReal += realProfit;
                            });

                            return (
                                <Table.Summary fixed>
                                    <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                                        <Table.Summary.Cell index={0}>TOTAL</Table.Summary.Cell>
                                        <Table.Summary.Cell index={1}>Bs. {formatVenezuelanPrice(totalProfit)}</Table.Summary.Cell>
                                        <Table.Summary.Cell index={2}>
                                            <Text type="danger">-Bs. {formatVenezuelanPrice(totalLoss)}</Text>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={3}>
                                            <Text style={{ color: totalReal >= 0 ? '#52c41a' : '#cf1322' }}>
                                                Bs. {formatVenezuelanPrice(totalReal)}
                                            </Text>
                                        </Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </Table.Summary>
                            );
                        }}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {report.monthlyHistory.map((item: any) => (
                            <Card key={item.month} variant="borderless" style={{ background: '#fafafa', borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Text strong style={{ fontSize: 14 }}>{item.month}</Text>
                                    <Tag color={item.realProfit >= 0 ? 'success' : 'error'} style={{ borderRadius: 6, margin: 0 }}>
                                        {item.realProfit >= 0 ? 'UTILIDAD' : 'PÉRDIDA'}
                                    </Tag>
                                </div>
                                <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
                                    <Col span={12}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>UTILIDAD OPERATIVA</Text>
                                        <Text strong style={{ fontSize: 13 }}>Bs. {formatVenezuelanPrice(item.operatingProfit)}</Text>
                                    </Col>
                                    <Col span={12} style={{ textAlign: 'right' }}>
                                        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>IMPACTO INFL.</Text>
                                        <Text type="danger" style={{ fontSize: 13 }}>-Bs. {formatVenezuelanPrice(item.inflationLoss)}</Text>
                                    </Col>
                                </Row>
                                <div style={{ padding: '10px 12px', background: item.realProfit >= 0 ? '#f6ffed' : '#fff1f0', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text strong style={{ fontSize: 12 }}>RESULTADO REAL:</Text>
                                    <Text strong style={{ color: item.realProfit >= 0 ? '#52c41a' : '#cf1322', fontSize: 15 }}>
                                        Bs. {formatVenezuelanPrice(item.realProfit)}
                                    </Text>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </Card>

            {/* Charts section */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={24}>
                    <Card variant="borderless" title={<Text strong>Tendencia de Pérdida Adquisitiva</Text>} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ height: isMobile ? 250 : 350, minHeight: isMobile ? 250 : 350, width: '100%', minWidth: 0, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                                <LineChart data={report.dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis 
                                        dataKey="date" 
                                        tickFormatter={(val) => dayjs(val).format('DD/MM')}
                                        axisLine={false}
                                        tickLine={false}
                                        fontSize={10}
                                        hide={isMobile}
                                    />
                                    <YAxis 
                                        tickFormatter={(val) => isMobile ? `${(val/1000).toFixed(0)}k` : val.toLocaleString()} 
                                        axisLine={false}
                                        tickLine={false}
                                        fontSize={10}
                                        width={isMobile ? 35 : 60}
                                    />
                                    <ChartTooltip
                                        formatter={(value: number) => [`Bs. ${formatVenezuelanPrice(value)}`, 'Pérdida']}
                                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    {!isMobile && <Legend iconType="circle" verticalAlign="top" height={36} />}
                                    <Line
                                        name="Pérdida Diaria"
                                        type="monotone"
                                        dataKey="loss"
                                        stroke="#cf1322"
                                        strokeWidth={3}
                                        dot={false}
                                        activeDot={{ r: 6 }}
                                    />
                                    <Line
                                        name="Valor Nominal"
                                        type="monotone"
                                        dataKey="nominal"
                                        stroke="#bfbfbf"
                                        strokeDasharray="5 5"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Detailed Table */}
            <Card 
                title={<Text strong>{isMobile ? "Impacto por Método" : "Desglose de Pérdida por Método de Pago"}</Text>} 
                variant="borderless"
                style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                styles={{ body: { padding: isMobile ? 8 : 24 } }}
            >
                {!isMobile ? (
                    <Table
                        dataSource={report.methodBreakdown}
                        columns={columns}
                        rowKey="method"
                        pagination={false}
                        size="middle"
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {report.methodBreakdown.map((item: any) => {
                            const pct = item.revalued > 0 ? (item.loss / item.revalued) * 100 : 0;
                            return (
                                <Card key={item.method} variant="borderless" style={{ background: '#fafafa', borderRadius: 12 }} styles={{ body: { padding: 16 } }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text strong style={{ fontSize: 14 }}>{item.method}</Text>
                                        <Tag color={pct > 5 ? 'error' : 'warning'} style={{ borderRadius: 6, margin: 0, fontWeight: 700 }}>
                                            {pct.toFixed(1)}% IMPACTO
                                        </Tag>
                                    </div>
                                    <Row gutter={16}>
                                        <Col span={12}>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>VALOR NOMINAL</Text>
                                            <Text style={{ fontSize: 13, fontWeight: 600 }}>Bs. {formatVenezuelanPrice(item.nominal)}</Text>
                                        </Col>
                                        <Col span={12} style={{ textAlign: 'right' }}>
                                            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>PÉRDIDA ESTIMADA</Text>
                                            <Text type="danger" strong style={{ fontSize: 13, fontWeight: 800 }}>Bs. {formatVenezuelanPrice(item.loss)}</Text>
                                        </Col>
                                    </Row>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </Card>

            <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Space>
                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    <Text type="secondary">
                        Este reporte estima cuánto poder adquisitivo se ha perdido por los ingresos recibidos en Bolívares
                        al compararlos con la tasa de cambio actual. La tabla de Rendimiento Real resta esta pérdida a tu utilidad operativa revaluada.
                    </Text>
                </Space>
            </div>
        </div>
    );
};

export default InflationReport;
