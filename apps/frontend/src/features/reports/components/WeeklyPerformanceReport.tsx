import { useState } from 'react';
import { Card, Row, Col, Radio, Space, Typography, Tooltip, Empty, Grid } from 'antd';
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



    return (
        <div style={{ padding: '0px' }}>
            {/* Header section */}
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 24, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Row gutter={[16, 24]} align="middle">
                    <Col xs={24} lg={10}>
                        <Title level={isMobile ? 4 : 2} style={{ margin: 0 }}>Rendimiento Semanal</Title>
                        <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>Identifica los picos de ventas por día de la semana.</Text>
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

            {/* Weekday Cards */}
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: `repeat(${isMobile ? 2 : 7}, 1fr)`, 
                gap: 12,
                marginBottom: 24 
            }}>
                {performance.map((item) => (
                    <Card
                        key={item.day}
                        variant="borderless"
                        style={{
                            background: getStatusColor(item.status),
                            border: `2px solid ${getStatusBorder(item.status)}`,
                            textAlign: 'center',
                            borderRadius: 16,
                            boxShadow: `0 4px 12px ${getStatusBorder(item.status)}15`
                        }}
                        styles={{ body: { padding: 16 } }}
                    >
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <Text strong style={{ fontSize: 10, textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)', letterSpacing: '0.05em' }}>{item.day}</Text>
                            <Title level={isMobile ? 5 : 4} style={{ margin: '0', color: '#111827', fontWeight: 800 }}>
                                {formatVenezuelanPrice(item.total, '', 0, true)}
                            </Title>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(255,255,255,0.5)', padding: '2px 8px', borderRadius: 8 }}>
                                {getStatusIcon(item.status)}
                                <Text style={{ fontSize: 11, fontWeight: 800, color: '#111827' }}>
                                    {item.percentage.toFixed(0)}%
                                </Text>
                            </div>
                        </Space>
                    </Card>
                ))}
            </div>

            {/* Charts section */}
            <Row gutter={[16, 16]}>
                <Col xs={24} lg={16}>
                    <Card 
                        title={<Text strong style={{ fontSize: 16 }}>Distribución Visual de Ventas</Text>} 
                        variant="borderless" 
                        style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fff' }}
                        extra={
                            <Tooltip title="Muestra el total de ventas acumulado para cada día en el período seleccionado.">
                                <InfoCircleOutlined style={{ color: '#1890ff' }} />
                            </Tooltip>
                        }
                    >
                        <div style={{ height: isMobile ? 300 : 450, minHeight: isMobile ? 300 : 450, width: '100%', minWidth: 0, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                                <BarChart data={performance} margin={{ top: 10, right: 10, left: isMobile ? -20 : 0, bottom: 0 }}>
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
                                        formatter={(value: number) => [`${currency} ${formatVenezuelanPrice(value)}`, 'Venta Total']}
                                        labelStyle={{ fontWeight: 'bold' }}
                                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                                    />
                                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                                        {performance.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.status === 'HIGH' ? '#52c41a' : entry.status === 'LOW' ? '#ff4d4f' : '#bae7ff'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <Card 
                        title={<Text strong>Resumen de Operación</Text>} 
                        variant="borderless" 
                        style={{ height: '100%', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Día más movido</Text>
                                <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                                    <CalendarOutlined style={{ fontSize: 24, marginRight: 12, color: '#1890ff' }} />
                                    <div>
                                        <Title level={4} style={{ margin: 0 }}>
                                            {performance.reduce((prev, current) => (prev.total > current.total) ? prev : current).day}
                                        </Title>
                                        <Text type="success" style={{ fontSize: 11 }}>Representa el {performance.reduce((prev, current) => (prev.total > current.total) ? prev : current).percentage.toFixed(1)}% de los ingresos.</Text>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <Text type="secondary" style={{ fontSize: 12 }}>Día con menos ventas</Text>
                                <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                                    <CalendarOutlined style={{ fontSize: 24, marginRight: 12, color: '#ff4d4f' }} />
                                    <div>
                                        <Title level={4} style={{ margin: 0 }}>
                                            {performance.reduce((prev, current) => (prev.total < current.total) ? prev : current).day}
                                        </Title>
                                        <Text type="danger" style={{ fontSize: 11 }}>Oportunidad para promociones.</Text>
                                    </div>
                                </div>
                            </div>

                            <Card 
                                variant="borderless" 
                                style={{ background: '#f0f5ff', borderRadius: 12 }} 
                                styles={{ body: { padding: '12px' } }}
                            >
                                <Space align="start">
                                    <InfoCircleOutlined style={{ color: '#1890ff', marginTop: 3 }} />
                                    <Text style={{ fontSize: 11 }}>
                                        Los datos mostrados consideran el valor revaluado en {periodLabel} a la tasa actual.
                                    </Text>
                                </Space>
                            </Card>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default WeeklyPerformanceReport;
