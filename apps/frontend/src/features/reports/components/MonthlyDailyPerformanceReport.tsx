import React, { useState } from 'react';
import { Card, Row, Col, Radio, Space, Typography, Tooltip, Empty, Badge, Grid } from 'antd';
import {
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from 'recharts';
import { statsApi } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const MonthlyDailyPerformanceReport: React.FC = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
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
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row gutter={[16, 24]} align="middle">
                    <Col xs={24} lg={10}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Mapa de Calor</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Intensidad de facturación en {periodName}.</Text>
                    </Col>
                    <Col xs={24} lg={14} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <Radio.Group 
                                value={dateFilter} 
                                onChange={(e) => setDateFilter(e.target.value)} 
                                buttonStyle="solid"
                                size="large"
                                block={isMobile}
                            >
                                <Radio.Button value="month">Este Mes</Radio.Button>
                                <Radio.Button value="lastMonth">Anterior</Radio.Button>
                                <Radio.Button value="all">Todo</Radio.Button>
                            </Radio.Group>
                            <Radio.Group 
                                value={currency} 
                                onChange={(e) => setCurrency(e.target.value)} 
                                buttonStyle="solid"
                                size="large"
                                block={isMobile}
                            >
                                <Radio.Button value="VES">VES</Radio.Button>
                                <Radio.Button value="USD">USD</Radio.Button>
                                <Radio.Button value="EUR">EUR</Radio.Button>
                                <Radio.Button value="UDT">UDT</Radio.Button>
                            </Radio.Group>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* Legend and Summary */}
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 8px' }}>
                <Space size={16}>
                    <Badge color="#52c41a" text={<Text strong style={{ fontSize: 11 }}>ALTO</Text>} />
                    <Badge color="#faad14" text={<Text strong style={{ fontSize: 11 }}>MEDIO</Text>} />
                    <Badge color="#ff4d4f" text={<Text strong style={{ fontSize: 11 }}>BAJO</Text>} />
                </Space>
                <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>VALORES EN {currency}</Text>
            </div>

            {/* Heatmap Grid */}
            <Card 
                variant="borderless" 
                style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                styles={{ body: { padding: isMobile ? 8 : 16 } }}
            >
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${isMobile ? 5 : 7}, 1fr)`,
                    gap: isMobile ? '4px' : '8px'
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
                                minHeight: isMobile ? '50px' : '65px',
                                borderRadius: '8px',
                                border: `2px solid ${day.total > 0 ? getStatusColor(day.status) : '#f0f0f0'}`,
                                background: day.total > 0 ? getStatusBg(day.status) : '#fafafa',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                padding: '4px',
                                boxShadow: day.total > 0 ? `0 2px 4px ${getStatusColor(day.status)}22` : 'none'
                            }}>
                                <Text strong style={{
                                    fontSize: isMobile ? '0.85em' : '1em',
                                    color: day.total > 0 ? getStatusColor(day.status) : '#bfbfbf',
                                    lineHeight: 1
                                }}>
                                    {day.day}
                                </Text>
                                {day.total > 0 && !isMobile && (
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
                                )}
                            </div>
                        </Tooltip>
                    ))}
                </div>
            </Card>

            {/* Trend Chart */}
            <Card 
                title={<Text strong style={{ fontSize: 16 }}>Recorrido de Facturación</Text>} 
                variant="borderless" 
                style={{ marginTop: 24, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fff' }}
            >
                <div style={{ height: isMobile ? 250 : 350, minHeight: isMobile ? 250 : 350, width: '100%', minWidth: 0, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                        <AreaChart data={performance} margin={{ top: 10, right: 30, left: isMobile ? -20 : 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#1890ff" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#1890ff" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="day" fontSize={10} hide={isMobile} axisLine={false} tickLine={false} />
                            <YAxis 
                                axisLine={false} 
                                tickLine={false}
                                fontSize={10} 
                                tickFormatter={(val) => isMobile ? `${(val/1000).toFixed(0)}k` : val.toLocaleString()} 
                                width={isMobile ? 35 : 60}
                            />
                            <ChartTooltip
                                formatter={(value: number) => [`${currency} ${formatVenezuelanPrice(value)}`, 'Venta']}
                                labelFormatter={(label) => `Día ${label}`}
                                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="total"
                                stroke="#1890ff"
                                fillOpacity={1}
                                fill="url(#colorTotal)"
                                strokeWidth={3}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
};

export default MonthlyDailyPerformanceReport;
