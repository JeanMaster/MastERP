import { useEffect, useState } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, Switch, Space } from 'antd';
import {
    ClockCircleOutlined,
    RiseOutlined,
    DollarOutlined,
} from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { statsApi, type HourlyPerformanceResponse } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';

interface HourlyPerformanceReportProps {
    currency: string;
    startDate?: string;
    endDate?: string;
}

export const HourlyPerformanceReport = ({ currency, startDate, endDate }: HourlyPerformanceReportProps) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<HourlyPerformanceResponse | null>(null);
    const [includeSundays, setIncludeSundays] = useState(false);

    useEffect(() => {
        fetchData();
    }, [currency, startDate, endDate, includeSundays]);

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

    if (loading && !data) {
        return (
            <div style={{ padding: '50px', textAlign: 'center' }}>
                <Spin size="large" tip="Cargando rendimiento por hora..." />
            </div>
        );
    }

    if (!data || data.data.length === 0) {
        return <Empty description="No hay datos de ventas para este período" />;
    }

    const currencySymbol = currency === 'VES' ? 'Bs.' : '$';

    return (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Card>
                <Row gutter={16} align="middle">
                    <Col xs={24} sm={12}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ fontWeight: 'bold' }}>Incluir Domingos:</span>
                            <Switch
                                checked={includeSundays}
                                onChange={setIncludeSundays}
                                checkedChildren="Sí"
                                unCheckedChildren="No"
                            />
                        </div>
                    </Col>
                </Row>
            </Card>

            <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Total Ventas (Revaluado)"
                            value={data?.stats.totalSalesSum || 0}
                            precision={2}
                            prefix={<DollarOutlined />}
                            suffix={currencySymbol}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Hora Pico"
                            value={data ? `${data.stats.peakHour}:00` : '00:00'}
                            prefix={<RiseOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card bordered={false} className="stat-card">
                        <Statistic
                            title="Ventas en Hora Pico"
                            value={data?.stats.peakAmount || 0}
                            precision={2}
                            prefix={<ClockCircleOutlined />}
                            suffix={currencySymbol}
                        />
                    </Card>
                </Col>
            </Row>

            <Card title="Distribución de Ventas por Hora">
                <div style={{ height: 400 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.data || []}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="label" />
                            <YAxis />
                            <Tooltip
                                formatter={(value: number) => [
                                    `${formatVenezuelanPrice(value, currencySymbol)}`,
                                    'Total Ventas'
                                ]}
                            />
                            <Bar dataKey="total" name="Ventas">
                                {(data?.data || []).map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.hour === data?.stats.peakHour ? '#1890ff' : '#69b1ff'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ marginTop: 16, fontSize: 12, color: '#888', textAlign: 'center' }}>
                    {includeSundays
                        ? "* Reporte incluye todos los días de la semana."
                        : "* Reporte excluye los domingos para una media más precisa."}
                </div>
            </Card>
        </Space>
    );
};
