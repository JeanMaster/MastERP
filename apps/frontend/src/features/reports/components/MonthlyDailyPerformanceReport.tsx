import React, { useState } from 'react';
import { Card, Row, Col, Radio, Space, Typography, Tooltip, Empty, Badge } from 'antd';
import {
    InfoCircleOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { statsApi } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const MonthlyDailyPerformanceReport: React.FC = () => {
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
        return {
            startDate: undefined,
            endDate: undefined,
        };
    };

    const { data: performance, isLoading } = useQuery({
        queryKey: ['monthlyDailyPerformance', dateFilter, currency],
        queryFn: () => {
            const { startDate, endDate } = getDates();
            return statsApi.getMonthlyDailyPerformance(currency, startDate, endDate);
        },
    });

    if (isLoading) return <Card loading />;
    if (!performance || performance.length === 0) return <Empty description="No hay datos para este período" />;

    const getStatusColor = (status: string) => {
        if (status === 'HIGH') return '#52c41a'; // Green
        if (status === 'LOW') return '#ff4d4f'; // Red
        return '#faad14'; // Yellow
    };

    const getStatusBg = (status: string) => {
        if (status === 'HIGH') return '#f6ffed';
        if (status === 'LOW') return '#fff1f0';
        return '#fffbe6';
    };

    const periodName = dateFilter === 'all'
        ? 'Todo el tiempo'
        : (dateFilter === 'month' ? dayjs().format('MMMM YYYY') : dayjs().subtract(1, 'month').format('MMMM YYYY'));

    return (
        <div style={{ padding: '0px' }}>
            {/* Header section */}
            <div style={{ marginBottom: 24, background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Row gutter={16} align="middle">
                    <Col xs={24} md={10}>
                        <Space direction="vertical">
                            <Title level={4} style={{ margin: 0 }}>Mapa de Calor de Ventas Diarias</Title>
                            <Text type="secondary">Intensidad de ventas cada día en {periodName}.</Text>
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

            {/* Legend and Summary */}
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                    <Badge color="#52c41a" text="Alto" />
                    <Badge color="#faad14" text="Promedio" />
                    <Badge color="#ff4d4f" text="Bajo" />
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>Valores en {currency} (Sin decimales)</Text>
            </div>

            {/* Heatmap Grid */}
            <Card bordered={false} bodyStyle={{ padding: 12 }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))',
                    gap: '6px'
                }}>
                    {performance.map((day: any) => (
                        <Tooltip
                            key={day.day}
                            title={
                                <div style={{ textAlign: 'center' }}>
                                    <Text strong style={{ color: '#fff' }}>Día {day.day}</Text><br />
                                    <Text style={{ color: '#fff' }}>{currency} {formatVenezuelanPrice(day.total)}</Text><br />
                                    <Text style={{ color: '#fff', fontSize: '0.8em' }}>{day.count} ventas</Text>
                                </div>
                            }
                        >
                            <div style={{
                                minHeight: '65px',
                                borderRadius: '6px',
                                border: `2px solid ${day.total > 0 ? getStatusColor(day.status) : '#f0f0f0'}`,
                                background: day.total > 0 ? getStatusBg(day.status) : '#fafafa',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                padding: '4px'
                            }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <Text strong style={{
                                    fontSize: '1em',
                                    color: day.total > 0 ? getStatusColor(day.status) : '#bfbfbf',
                                    lineHeight: 1
                                }}>
                                    {day.day}
                                </Text>
                                {day.total > 0 ? (
                                    <Text style={{
                                        fontSize: '10px',
                                        color: '#262626',
                                        marginTop: 4,
                                        fontWeight: 600,
                                        textAlign: 'center',
                                        maxWidth: '100%',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {formatVenezuelanPrice(day.total, '', 0)}
                                    </Text>
                                ) : (
                                    <Text style={{ fontSize: '9px', color: '#d9d9d9', marginTop: 4 }}>-</Text>
                                )}
                            </div>
                        </Tooltip>
                    ))}
                </div>
            </Card>

            {/* Trend Chart */}
            <Card title="Recorrido de Facturación" bordered={false} style={{ marginTop: 24 }}>
                <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={performance} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1890ff" stopOpacity={0.1} />
                                <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" />
                        <YAxis tickFormatter={(val) => `${currency} ${val.toLocaleString()}`} />
                        <ChartTooltip
                            formatter={(value: number) => [`${currency} ${formatVenezuelanPrice(value)}`, 'Venta']}
                            labelFormatter={(label) => `Día ${label}`}
                        />
                        <Area
                            type="monotone"
                            dataKey="total"
                            stroke="#1890ff"
                            fillOpacity={1}
                            fill="url(#colorTotal)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

export default MonthlyDailyPerformanceReport;
