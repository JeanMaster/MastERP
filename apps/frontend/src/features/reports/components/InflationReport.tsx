import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Table, Radio, Space, Typography, Tag, Tooltip } from 'antd';
import {
    FallOutlined,
    InfoCircleOutlined,
    HistoryOutlined,
    DollarOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend } from 'recharts';
import { statsApi } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const InflationReport: React.FC = () => {
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
            <div style={{ marginBottom: 24, background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Row gutter={16} align="middle">
                    <Col xs={24} md={12}>
                        <Space direction="vertical">
                            <Title level={4} style={{ margin: 0 }}>Impacto Inflacionario (Transacciones en BS)</Title>
                            <Text type="secondary">Análisis de la pérdida de valor adquisitivo de los ingresos recibidos en Bolívares vs. su valor revaluado a tasa actual.</Text>
                        </Space>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                        <Radio.Group value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} buttonStyle="solid">
                            <Radio.Button value="month">Este Mes</Radio.Button>
                            <Radio.Button value="lastMonth">Mes Anterior</Radio.Button>
                            <Radio.Button value="all">Todo el Año</Radio.Button>
                        </Radio.Group>
                    </Col>
                </Row>
            </div>

            {/* Summary cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="Total Recibido (Bs Nominales)"
                            value={report.summary.totalNominalVES}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#8c8c8c' }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>Suma de pagos registrados en Bs.</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="Valor Revaluado Actual"
                            value={report.summary.totalRevaluedVES}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#1890ff' }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>Lo que valdría hoy ese dinero</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false} style={{ background: '#fff1f0', border: '1px solid #ffa39e' }}>
                        <Statistic
                            title="PÉRDIDA ESTIMADA (BS)"
                            value={report.summary.totalLossVES}
                            precision={2}
                            prefix="Bs."
                            valueStyle={{ color: '#cf1322', fontWeight: 'bold' }}
                            suffix={<FallOutlined />}
                        />
                        <Text type="danger" style={{ fontSize: 11, fontWeight: 'bold' }}>Gap inflacionario acumulado</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card bordered={false}>
                        <Statistic
                            title="% Devaluación Promedio"
                            value={report.summary.lossPercentage}
                            precision={2}
                            suffix="%"
                            valueStyle={{ color: '#cf1322' }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>Impacto sobre el valor total</Text>
                    </Card>
                </Col>
            </Row>

            {/* Monthly Performance Table */}
            <Card title="Rendimiento Mensual Real (Utilidad vs Devaluación)" style={{ marginBottom: 24 }} bordered={false}>
                <Table
                    dataSource={report.monthlyHistory}
                    columns={monthlyColumns}
                    rowKey="month"
                    pagination={false}
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
            </Card>

            {/* Charts section */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={24}>
                    <Card title="Tendencia de Pérdida por Inflación" bordered={false}>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={report.dailyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis tickFormatter={(val) => `Bs. ${val.toLocaleString()}`} />
                                <ChartTooltip
                                    formatter={(value: number) => [`Bs. ${formatVenezuelanPrice(value)}`, 'Pérdida']}
                                    labelStyle={{ fontWeight: 'bold' }}
                                />
                                <Legend />
                                <Line
                                    name="Pérdida Diaria (Bs)"
                                    type="monotone"
                                    dataKey="loss"
                                    stroke="#cf1322"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: '#cf1322' }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    name="Recibido Nominal (Bs)"
                                    type="monotone"
                                    dataKey="nominal"
                                    stroke="#8c8c8c"
                                    strokeDasharray="5 5"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
            </Row>

            {/* Detailed Table */}
            <Card title="Desglose por Método de Pago en Bs." bordered={false}>
                <Table
                    dataSource={report.methodBreakdown}
                    columns={columns}
                    rowKey="method"
                    pagination={false}
                />
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
