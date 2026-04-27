import { Card, Row, Col, Statistic, Table, Button, Tag, Spin, Empty, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { 
    WhatsAppOutlined, 
    FallOutlined, 
    GiftOutlined,
    StarFilled
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

const { Title, Text } = Typography;

/**
 * MarketingDashboard Component
 * Central control hub for customer engagement intelligence.
 * Visualizes customer segmentation (tiers), churn risk analysis, and provides actionable shortcuts for upcoming events like birthdays.
 */
export const MarketingDashboard = () => {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['marketing-stats'],
        queryFn: marketingApi.getStats,
        refetchInterval: 60000 // Refresh every minute for real-time engagement
    });

    if (isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" tip="Loading marketing intelligence..." />
            </div>
        );
    }

    if (!stats) return <Empty description="No marketing data available" />;

    const tierData = [
        { name: 'VIP (Diamond)', value: stats.tiers.vip, color: '#722ed3' },
        { name: 'Gold', value: stats.tiers.gold, color: '#faad14' },
        { name: 'Silver', value: stats.tiers.silver, color: '#1890ff' },
        { name: 'Bronze', value: stats.tiers.bronze, color: '#8c8c8c' },
    ].filter(t => t.value > 0);

    /**
     * Opens a pre-filled WhatsApp message for customer birthdays.
     */
    const handleWhatsApp = (phone: string, name: string) => {
        const message = encodeURIComponent(`Hi ${name}! We wish you a very happy birthday from the MastERP team. We have a special gift waiting for you on your next visit! 🎂🎁`);
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`, '_blank');
    };

    const birthdayColumns = [
        {
            title: 'Customer',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Day',
            dataIndex: 'day',
            key: 'day',
            render: (day: number) => <Tag color="blue">{day}</Tag>
        },
        {
            title: 'Action',
            key: 'action',
            render: (_: any, record: any) => (
                <Button 
                    type="primary" 
                    icon={<WhatsAppOutlined />} 
                    disabled={!record.phone}
                    onClick={() => handleWhatsApp(record.phone, record.name)}
                    size="small"
                >
                    Send Wishes
                </Button>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Title level={2} style={{ marginBottom: '24px' }}>📈 Marketing Control Center</Title>
            
            <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                    <Card bordered={false}>
                        <Statistic 
                            title="Total VIP Customers" 
                            value={stats.tiers.vip} 
                            prefix={<StarFilled style={{ color: '#722ed3' }} />} 
                            valueStyle={{ color: '#722ed3' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card bordered={false}>
                        <Statistic 
                            title="Churn Risk Rate" 
                            value={stats.churn.percentage.toFixed(1)} 
                            suffix="%" 
                            prefix={<FallOutlined style={{ color: '#cf1322' }} />}
                            valueStyle={{ color: '#cf1322' }}
                        />
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                            {stats.churn.count} inactive customers (&gt; {stats.churn.days} days)
                        </div>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card bordered={false}>
                        <Statistic 
                            title="Birthdays This Month" 
                            value={stats.upcomingBirthdays.length} 
                            prefix={<GiftOutlined style={{ color: '#eb2f96' }} />}
                        />
                    </Card>
                </Col>

                <Col xs={24} lg={14}>
                    <Card title="Customer Tier Segmentation" bordered={false} style={{ height: '100%', minHeight: '400px' }}>
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
                    <Card title="🎂 Upcoming Birthdays" bordered={false} style={{ height: '100%', minHeight: '400px' }}>
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
                    <Card title="🏆 Top Points Accumulators" bordered={false}>
                        <TopEarnersTable />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

/**
 * TopEarnersTable Sub-component
 * Lists customers with the highest loyalty points.
 */
const TopEarnersTable = () => {
    const { data: topEarners, isLoading } = useQuery({
        queryKey: ['marketing-top-earners'],
        queryFn: marketingApi.getTopEarners,
    });

    const columns = [
        { title: 'Customer Name', dataIndex: 'name', key: 'name' },
        { title: 'Client ID', dataIndex: 'id', key: 'id' },
        { 
            title: 'Accumulated Points', 
            dataIndex: 'loyaltyPoints', 
            key: 'loyaltyPoints',
            align: 'right' as const,
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
