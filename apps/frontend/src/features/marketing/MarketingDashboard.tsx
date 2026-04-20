import { Card, Row, Col, Statistic, Table, Button, Tag, Spin, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { 
    WhatsAppOutlined, 
    FallOutlined, 
    GiftOutlined,
    StarFilled
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

export const MarketingDashboard = () => {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['marketing-stats'],
        queryFn: marketingApi.getStats,
        refetchInterval: 60000 // Refresh every minute
    });

    if (isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" tip="Cargando inteligencia de marketing..." />
            </div>
        );
    }

    if (!stats) return <Empty description="No hay datos de marketing disponibles" />;

    const tierData = [
        { name: 'VIP (Diamante)', value: stats.tiers.vip, color: '#722ed3' },
        { name: 'Gold (Oro)', value: stats.tiers.gold, color: '#faad14' },
        { name: 'Silver (Plata)', value: stats.tiers.silver, color: '#1890ff' },
        { name: 'Bronce', value: stats.tiers.bronze, color: '#8c8c8c' },
    ].filter(t => t.value > 0);

    const handleWhatsApp = (phone: string, name: string) => {
        const message = encodeURIComponent(`¡Hola ${name}! Te escribimos de ValeryPort para desearte un muy feliz cumpleaños. Tenemos un regalo especial para ti en tu próxima compra. 🎂🎁`);
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`, '_blank');
    };

    const birthdayColumns = [
        {
            title: 'Cliente',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Día',
            dataIndex: 'day',
            key: 'day',
            render: (day: number) => <Tag color="blue">{day}</Tag>
        },
        {
            title: 'Acción',
            key: 'action',
            render: (_: any, record: any) => (
                <Button 
                    type="primary" 
                    icon={<WhatsAppOutlined />} 
                    disabled={!record.phone}
                    onClick={() => handleWhatsApp(record.phone, record.name)}
                    size="small"
                >
                    Felicitar
                </Button>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <h2 style={{ marginBottom: '24px' }}>MarketingP: Centro de Control</h2>
            
            <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                    <Card bordered={false}>
                        <Statistic 
                            title="Total Clientes VIP" 
                            value={stats.tiers.vip} 
                            prefix={<StarFilled style={{ color: '#722ed3' }} />} 
                            valueStyle={{ color: '#722ed3' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card bordered={false}>
                        <Statistic 
                            title="Tasa de Abandono (Churn)" 
                            value={stats.churn.percentage.toFixed(1)} 
                            suffix="%" 
                            prefix={<FallOutlined style={{ color: '#cf1322' }} />}
                            valueStyle={{ color: '#cf1322' }}
                        />
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                            {stats.churn.count} clientes inactivos (&gt; {stats.churn.days} días)
                        </div>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card bordered={false}>
                        <Statistic 
                            title="Cumpleaños este Mes" 
                            value={stats.upcomingBirthdays.length} 
                            prefix={<GiftOutlined style={{ color: '#eb2f96' }} />}
                        />
                    </Card>
                </Col>

                <Col xs={24} lg={14}>
                    <Card title="Segmentación por Tiers" bordered={false} style={{ height: '100%', minHeight: '400px' }}>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={tierData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {tierData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </Col>

                <Col xs={24} lg={10}>
                    <Card title="🎂 Próximos Cumpleaños" bordered={false} style={{ height: '100%', minHeight: '400px' }}>
                        <Table 
                            dataSource={stats.upcomingBirthdays} 
                            columns={birthdayColumns} 
                            pagination={{ pageSize: 5 }} 
                            rowKey="id"
                            size="small"
                        />
                    </Card>
                </Col>

                <Col xs={24}>
                    <Card title="🏆 Top Acumuladores de Puntos" bordered={false}>
                        <TopEarnersTable />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

const TopEarnersTable = () => {
    const { data: topEarners, isLoading } = useQuery({
        queryKey: ['marketing-top-earners'],
        queryFn: marketingApi.getTopEarners,
    });

    const columns = [
        { title: 'Cliente', dataIndex: 'name', key: 'name' },
        { title: 'ID', dataIndex: 'id', key: 'id' },
        { 
            title: 'Puntos Acumulados', 
            dataIndex: 'loyaltyPoints', 
            key: 'loyaltyPoints',
            render: (val: any) => <Tag color="gold">{Number(val).toFixed(0)} pts</Tag>
        },
    ];

    return (
        <Table 
            dataSource={topEarners || []} 
            columns={columns} 
            loading={isLoading}
            pagination={{ pageSize: 5 }} 
            rowKey="id"
            size="small"
        />
    );
};
