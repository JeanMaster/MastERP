import { useEffect, useState } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, Switch, Typography, Grid } from 'antd';
import {
    ClockCircleOutlined,
    RiseOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { statsApi, type HourlyPerformanceResponse } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';

interface HourlyPerformanceReportProps {
    currency: string;
    startDate?: string;
    endDate?: string;
}

const { Text } = Typography;

export const HourlyPerformanceReport = ({ currency, startDate, endDate }: HourlyPerformanceReportProps) => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<HourlyPerformanceResponse | null>(null);
    const [includeSundays, setIncludeSundays] = useState(() => {
        return localStorage.getItem('reports_include_sundays') === 'true';
    });
    const [use12Hour, setUse12Hour] = useState(() => {
        return localStorage.getItem('reports_use_12hour') === 'true';
    });

    useEffect(() => {
        fetchData();
        localStorage.setItem('reports_include_sundays', includeSundays.toString());
    }, [currency, startDate, endDate, includeSundays]);

    useEffect(() => {
        localStorage.setItem('reports_use_12hour', use12Hour.toString());
    }, [use12Hour]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const response = await statsApi.getHourlyPerformance(currency, includeSundays, startDate, endDate);
            setData(response);
        } catch (error) {
            console.error('Error fetching hourly performance:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatHour = (hour: number) => {
        if (!use12Hour) return `${hour}:00`;
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour} ${period}`;
    };

    if (loading && !data) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" tip="Cargando rendimiento por hora...">
                    <div style={{ padding: 50 }} />
                </Spin>
            </div>
        );
    }

    if (!data || data.data.length === 0) {
        return <Empty description="No hay datos de ventas para este período" />;
    }

    const currencySymbol = currency === 'VES' ? 'Bs.' : '$';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: isMobile ? 12 : 24 } }}>
                <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={12}>
                        <div style={{ display: 'flex', gap: isMobile ? 12 : 24, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Text strong style={{ fontSize: 12 }}>Incluir Domingos:</Text>
                                <Switch
                                    checked={includeSundays}
                                    onChange={setIncludeSundays}
                                    checkedChildren="Sí"
                                    unCheckedChildren="No"
                                    size="small"
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Text strong style={{ fontSize: 12 }}>Formato 12h:</Text>
                                <Switch
                                    checked={use12Hour}
                                    onChange={setUse12Hour}
                                    checkedChildren="12h"
                                    unCheckedChildren="24h"
                                    size="small"
                                />
                            </div>
                        </div>
                    </Col>
                </Row>
            </Card>

            <Row gutter={[12, 12]}>
                <Col xs={24} sm={8}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f0f5ff' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>VENTA TOTAL (REVAL)</Text>}
                            value={data?.stats.totalSalesSum || 0}
                            precision={2}
                            prefix={currencySymbol}
                            styles={{ content: { color: '#1890ff', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#f6ffed' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>HORA PICO</Text>}
                            value={data ? formatHour(data.stats.peakHour) : '00:00'}
                            prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
                            styles={{ content: { color: '#52c41a', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                    </Card>
                </Col>
                <Col xs={12} sm={8}>
                    <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fffbe6' }} styles={{ body: { padding: 16 } }}>
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 11 }}>MONTO PICO</Text>}
                            value={data?.stats.peakAmount || 0}
                            precision={2}
                            prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                            styles={{ content: { color: '#faad14', fontSize: isMobile ? 18 : 22, fontWeight: 800 } }}
                        />
                    </Card>
                </Col>
            </Row>

            <Card 
                title={<Text strong style={{ fontSize: 16 }}>Distribución de Ventas por Hora</Text>} 
                variant="borderless" 
                style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', background: '#fff' }}
                styles={{ body: { padding: isMobile ? 12 : 24 } }}
            >
                <div style={{ height: isMobile ? 250 : 400, minHeight: isMobile ? 250 : 400, width: '100%', minWidth: 0, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                        <BarChart data={data?.data || []} margin={{ top: 10, right: 10, left: isMobile ? -20 : 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis
                                dataKey="hour"
                                tickFormatter={formatHour}
                                fontSize={10}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis 
                                axisLine={false}
                                tickLine={false}
                                fontSize={10}
                                tickFormatter={(val) => isMobile ? `${(val/1000).toFixed(0)}k` : val.toLocaleString()}
                                width={isMobile ? 35 : 60}
                            />
                            <Tooltip
                                labelFormatter={formatHour}
                                formatter={(value: number) => [
                                    `${formatVenezuelanPrice(value, currencySymbol)}`,
                                    'Ventas'
                                ]}
                                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                            />
                            <Bar dataKey="total" name="Ventas" radius={[6, 6, 0, 0]}>
                                {(data?.data || []).map((entry: any, index: number) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.hour === data?.stats.peakHour ? '#1890ff' : '#bae7ff'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ marginTop: 16, fontSize: 11, color: '#8c8c8c', textAlign: 'center' }}>
                    {includeSundays
                        ? "* Reporte incluye todos los días de la semana."
                        : "* Reporte excluye los domingos para una media más precisa."}
                </div>
            </Card>
        </div>
    );
};
