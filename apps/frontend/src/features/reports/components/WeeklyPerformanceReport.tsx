import React, { useState } from 'react';
import { Card, Row, Col, Radio, Space, Typography, Tag, Tooltip, Empty } from 'antd';
import {
    CalendarOutlined,
    RiseOutlined,
    FallOutlined,
    LineOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Cell } from 'recharts';
import { statsApi } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const WeeklyPerformanceReport: React.FC = () => {
    const [dateFilter, setDateFilter] = useState<'month' | 'lastMonth' | 'all'>('month');
    const [currency, setCurrency] = useState<'VES' | 'USD' | 'EUR' | 'UDT'>('VES');

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

    const periodLabel = dateFilter === 'month' ? 'este mes' : dateFilter === 'lastMonth' ? 'el mes pasado' : 'todo el año';

    const { data: performance, isLoading } = useQuery({
        queryKey: ['weeklyPerformance', dateFilter, currency],
        queryFn: () => {
            const { startDate, endDate } = getDates();
            return statsApi.getWeeklyPerformance(currency, startDate, endDate);
        },
    });

    if (isLoading) return <Card loading />;
    if (!performance || performance.length === 0) return <Empty description="No hay datos de ventas para este período" />;

    const getStatusColor = (status: string) => {
        if (status === 'HIGH') return '#f6ffed'; // Light green
        if (status === 'LOW') return '#fff1f0'; // Light red
        return '#fffbe6'; // Light yellow
    };

    const getStatusBorder = (status: string) => {
        if (status === 'HIGH') return '#b7eb8f';
        if (status === 'LOW') return '#ffa39e';
        return '#ffe58f';
    };

    const getStatusIcon = (status: string) => {
        if (status === 'HIGH') return <RiseOutlined style={{ color: '#52c41a' }} />;
        if (status === 'LOW') return <FallOutlined style={{ color: '#cf1322' }} />;
        return <LineOutlined style={{ color: '#faad14' }} />;
    };

    const getStatusText = (status: string) => {
        if (status === 'HIGH') return 'ALTO';
        if (status === 'LOW') return 'BAJO';
        return 'PROMEDIO';
    };

    return (
        <div style={{ padding: '0px' }}>
            {/* Header section */}
            <div style={{ marginBottom: 24, background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Row gutter={16} align="middle">
                    <Col xs={24} md={10}>
                        <Space direction="vertical">
                            <Title level={4} style={{ margin: 0 }}>Rendimiento por Día de la Semana</Title>
                            <Text type="secondary">Identifica qué días tienen mayor flujo de ventas para optimizar tu operación.</Text>
                        </Space>
                    </Col>
                    <Col xs={24} md={14} style={{ textAlign: 'right' }}>
                        <Space wrap>
                            <Radio.Group value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} buttonStyle="solid">
                                <Radio.Button value="month">Este Mes</Radio.Button>
                                <Radio.Button value="lastMonth">Mes Anterior</Radio.Button>
                                <Radio.Button value="all">Todo</Radio.Button>
                            </Radio.Group>
                            <Radio.Group value={currency} onChange={(e) => setCurrency(e.target.value)} buttonStyle="solid">
                                <Radio.Button value="VES">VES</Radio.Button>
                                <Radio.Button value="USD">USD</Radio.Button>
                                <Radio.Button value="EUR">EUR</Radio.Button>
                                <Radio.Button value="UDT">UDT</Radio.Button>
                            </Radio.Group>
                        </Space>
                    </Col>
                </Row>
            </div>

            {/* Weekday Cards */}
            <Row gutter={[12, 12]} style={{ marginBottom: 24 }}>
                {performance.map((item) => (
                    <Col key={item.day} xs={12} sm={8} md={6} lg={3} xl={3} style={{ flexGrow: 1 }}>
                        <Card
                            bordered={true}
                            style={{
                                background: getStatusColor(item.status),
                                borderColor: getStatusBorder(item.status),
                                textAlign: 'center',
                                height: '100%'
                            }}
                            bodyStyle={{ padding: '12px 8px' }}
                        >
                            <Space direction="vertical" size={2}>
                                <Text strong style={{ fontSize: 13, textTransform: 'uppercase' }}>{item.day}</Text>
                                <Title level={5} style={{ margin: '4px 0', color: '#262626' }}>
                                    {currency} {formatVenezuelanPrice(item.total, '', 0, true)}
                                </Title>
                                <Space size={4}>
                                    {getStatusIcon(item.status)}
                                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: 'rgba(0,0,0,0.45)' }}>
                                        {getStatusText(item.status)}
                                    </Text>
                                </Space>
                                <div style={{ marginTop: 4 }}>
                                    <Tag style={{ margin: 0, fontSize: 10 }}>{item.percentage.toFixed(1)}%</Tag>
                                </div>
                            </Space>
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Charts section */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                    <Card title="Distribución Visual de Ventas" bordered={false} extra={
                        <Tooltip title="Muestra el total de ventas acumulado para cada día en el período seleccionado.">
                            <InfoCircleOutlined style={{ color: '#1890ff' }} />
                        </Tooltip>
                    }>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={performance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="day" />
                                <YAxis tickFormatter={(val) => `${currency} ${val.toLocaleString()}`} />
                                <ChartTooltip
                                    formatter={(value: number) => [`${currency} ${formatVenezuelanPrice(value)}`, 'Venta Total']}
                                    labelStyle={{ fontWeight: 'bold' }}
                                />
                                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                                    {performance.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.status === 'HIGH' ? '#52c41a' : entry.status === 'LOW' ? '#ff4d4f' : '#1890ff'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card title="Resumen de Operación" bordered={false} style={{ height: '100%' }}>
                        <Space direction="vertical" size={24} style={{ width: '100%' }}>
                            <div>
                                <Text type="secondary">Día más movido</Text>
                                <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                                    <CalendarOutlined style={{ fontSize: 24, marginRight: 12, color: '#1890ff' }} />
                                    <div>
                                        <Title level={4} style={{ margin: 0 }}>
                                            {performance.reduce((prev, current) => (prev.total > current.total) ? prev : current).day}
                                        </Title>
                                        <Text type="success">Representa el {performance.reduce((prev, current) => (prev.total > current.total) ? prev : current).percentage.toFixed(1)}% de tus ingresos.</Text>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Text type="secondary">Día con menos ventas</Text>
                                <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                                    <CalendarOutlined style={{ fontSize: 24, marginRight: 12, color: '#ff4d4f' }} />
                                    <div>
                                        <Title level={4} style={{ margin: 0 }}>
                                            {performance.reduce((prev, current) => (prev.total < current.total) ? prev : current).day}
                                        </Title>
                                        <Text type="danger">Oportunidad para promociones u ofertas.</Text>
                                    </div>
                                </div>
                            </div>

                            <Card style={{ background: '#f0f5ff', border: 'none' }} bodyStyle={{ padding: '12px' }}>
                                <Space>
                                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                                    <Text style={{ fontSize: 12 }}>
                                        Los datos mostrados consideran el valor revaluado de tus ventas en {periodLabel} a la tasa de cambio actual.
                                    </Text>
                                </Space>
                            </Card>
                        </Space>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default WeeklyPerformanceReport;
