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
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

/**
 * MarketingDashboard Component
 * Central control hub for customer engagement intelligence.
 * Visualizes customer segmentation (tiers), churn risk analysis, and provides actionable shortcuts for upcoming events like birthdays.
 */
export const MarketingDashboard = () => {
    const { t } = useTranslation();
    const { data: stats, isLoading } = useQuery({
        queryKey: ['marketing-stats'],
        queryFn: marketingApi.getStats,
        refetchInterval: 60000 // Refresh every minute for real-time engagement
    });

    if (isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" tip={t('marketing.dashboard.loading_intelligence')} />
            </div>
        );
    }

    if (!stats) return <Empty description={t('marketing.dashboard.no_data')} />;

    const tierData = [
        { name: t('marketing.campaigns.segments.vip'), value: stats.tiers.vip, color: '#722ed3' },
        { name: t('marketing.campaigns.segments.gold'), value: stats.tiers.gold, color: '#faad14' },
        { name: t('marketing.campaigns.segments.silver', { defaultValue: 'Silver' }), value: stats.tiers.silver, color: '#1890ff' },
        { name: t('marketing.campaigns.segments.bronze', { defaultValue: 'Bronze' }), value: stats.tiers.bronze, color: '#8c8c8c' },
    ].filter(t => t.value > 0);

    /**
     * Opens a pre-filled WhatsApp message for customer birthdays.
     */
    const handleWhatsApp = (phone: string, name: string) => {
        const message = encodeURIComponent(t('marketing.dashboard.wa_birthday_msg', { name }));
        window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`, '_blank');
    };

    const birthdayColumns = [
        {
            title: t('common.customer'),
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: t('common.day', { defaultValue: 'Day' }),
            dataIndex: 'day',
            key: 'day',
            render: (day: number) => <Tag color="blue">{day}</Tag>
        },
        {
            title: t('common.actions'),
            key: 'action',
            render: (_: any, record: any) => (
                <Button 
                    type="primary" 
                    icon={<WhatsAppOutlined />} 
                    disabled={!record.phone}
                    onClick={() => handleWhatsApp(record.phone, record.name)}
                    size="small"
                >
                    {t('marketing.dashboard.send_wishes', { defaultValue: 'Send Wishes' })}
                </Button>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Title level={2} style={{ marginBottom: '24px' }}>📈 {t('marketing.dashboard.control_center_title')}</Title>
            
            <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                    <Card bordered={false}>
                        <Statistic 
                            title={t('marketing.dashboard.total_vip')} 
                            value={stats.tiers.vip} 
                            prefix={<StarFilled style={{ color: '#722ed3' }} />} 
                            valueStyle={{ color: '#722ed3' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card bordered={false}>
                        <Statistic 
                            title={t('marketing.dashboard.churn_rate')} 
                            value={stats.churn.percentage.toFixed(1)} 
                            suffix="%" 
                            prefix={<FallOutlined style={{ color: '#cf1322' }} />}
                            valueStyle={{ color: '#cf1322' }}
                        />
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                            {t('marketing.dashboard.inactive_customers', { count: stats.churn.count, days: stats.churn.days })}
                        </div>
                    </Card>
                </Col>
                <Col xs={24} md={8}>
                    <Card bordered={false}>
                        <Statistic 
                            title={t('marketing.dashboard.birthdays_month')} 
                            value={stats.upcomingBirthdays.length} 
                            prefix={<GiftOutlined style={{ color: '#eb2f96' }} />}
                        />
                    </Card>
                </Col>

                <Col xs={24} lg={14}>
                    <Card title={t('marketing.dashboard.tier_segmentation')} bordered={false} style={{ height: '100%', minHeight: '400px' }}>
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
                    <Card title={`🎂 ${t('marketing.dashboard.upcoming_birthdays')}`} bordered={false} style={{ height: '100%', minHeight: '400px' }}>
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
                    <Card title={`🏆 ${t('marketing.dashboard.top_earners')}`} bordered={false}>
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
    const { t } = useTranslation();
    const { data: topEarners, isLoading } = useQuery({
        queryKey: ['marketing-top-earners'],
        queryFn: marketingApi.getTopEarners,
    });

    const columns = [
        { title: t('common.name'), dataIndex: 'name', key: 'name' },
        { title: t('common.code', { defaultValue: 'Client ID' }), dataIndex: 'id', key: 'id' },
        { 
            title: t('marketing.dashboard.top_earners'), 
            dataIndex: 'loyaltyPoints', 
            key: 'loyaltyPoints',
            align: 'right' as const,
            render: (val: any) => <Tag color="gold">{Number(val).toFixed(0)} {t('pos.checkout.pts')}</Tag>
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
