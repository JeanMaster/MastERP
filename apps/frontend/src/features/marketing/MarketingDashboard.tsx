import { Card, Row, Col, Statistic, Table, Button, Tag, Spin, Empty, Typography, Grid, List } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { marketingApi } from '../../services/marketingApi';
import { 
    WhatsAppOutlined, 
    FallOutlined, 
    GiftOutlined,
    StarFilled
} from '@ant-design/icons';
import { 
    PieChart, 
    Pie, 
    Cell, 
    Tooltip as RechartsTooltip, 
    Legend,
    ResponsiveContainer
} from 'recharts';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

/**
 * MarketingDashboard Component
 * Central control hub for customer engagement intelligence.
 * Visualizes customer segmentation (tiers), churn risk analysis, and provides actionable shortcuts for upcoming events like birthdays.
 */
export const MarketingDashboard = () => {
    const { t } = useTranslation();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;

    const { data: stats, isLoading } = useQuery({
        queryKey: ['marketing-stats'],
        queryFn: marketingApi.getStats,
        refetchInterval: 60000 // Refresh every minute for real-time engagement
    });

    if (isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" tip={t('marketing.dashboard.loading_intelligence')}>
                    <div style={{ padding: 50 }} />
                </Spin>
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
        <div style={{ padding: isMobile ? '8px' : '24px' }}>
            <Title level={isMobile ? 3 : 2} style={{ marginBottom: '24px' }}>📈 {t('marketing.dashboard.control_center_title')}</Title>
            
            <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={8}>
                    <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic 
                            title={t('marketing.dashboard.total_vip')} 
                            value={stats.tiers.vip} 
                            prefix={<StarFilled style={{ color: '#722ed3' }} />} 
                            styles={{ content: { color: '#722ed3', fontSize: isMobile ? 24 : 32 } }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic 
                            title={t('marketing.dashboard.churn_rate')} 
                            value={stats.churn.percentage.toFixed(1)} 
                            suffix="%" 
                            prefix={<FallOutlined style={{ color: '#cf1322' }} />}
                            styles={{ content: { color: '#cf1322', fontSize: isMobile ? 24 : 32 } }}
                        />
                        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                            {t('marketing.dashboard.inactive_customers', { count: stats.churn.count, days: stats.churn.days })}
                        </div>
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <Statistic 
                            title={t('marketing.dashboard.birthdays_month')} 
                            value={stats.upcomingBirthdays.length} 
                            prefix={<GiftOutlined style={{ color: '#eb2f96' }} />}
                            styles={{ content: { fontSize: isMobile ? 24 : 32 } }}
                        />
                    </Card>
                </Col>

                <Col xs={24} lg={14}>
                    <Card title={t('marketing.dashboard.tier_segmentation')} variant="borderless" style={{ height: '100%', minHeight: isMobile ? '350px' : '400px', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <div style={{ width: '100%', height: isMobile ? 300 : 350 }}>
                            <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                                    <PieChart>
                                        <Pie
                                    data={tierData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={isMobile ? 40 : 60}
                                    outerRadius={isMobile ? 70 : 100}
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
                        </div>
                    </Card>
                </Col>

                <Col xs={24} lg={10}>
                    <Card title={`🎂 ${t('marketing.dashboard.upcoming_birthdays')}`} variant="borderless" style={{ height: '100%', minHeight: isMobile ? '300px' : '400px', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        {!isMobile ? (
                            <Table 
                                dataSource={stats.upcomingBirthdays} 
                                columns={birthdayColumns} 
                                pagination={{ pageSize: 5 }} 
                                rowKey="id"
                                size="small"
                            />
                        ) : (
                            <List
                                dataSource={stats.upcomingBirthdays}
                                rowKey="id"
                                pagination={{ pageSize: 5, size: 'small', simple: true }}
                                renderItem={(item: any) => (
                                    <List.Item
                                        style={{ padding: '12px', borderBottom: '1px solid #f0f0f0' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{item.name}</div>
                                                <Tag color="blue" style={{ marginTop: 4 }}>{t('common.day')}: {item.day}</Tag>
                                            </div>
                                            <Button 
                                                type="primary" 
                                                icon={<WhatsAppOutlined />} 
                                                disabled={!item.phone}
                                                onClick={() => handleWhatsApp(item.phone, item.name)}
                                                size="small"
                                                shape="circle"
                                            />
                                        </div>
                                    </List.Item>
                                )}
                            />
                        )}
                    </Card>
                </Col>

                <Col xs={24}>
                    <Card title={`🏆 ${t('marketing.dashboard.top_earners')}`} variant="borderless" style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                        <TopEarnersTable isMobile={isMobile} />
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
const TopEarnersTable = ({ isMobile }: { isMobile?: boolean }) => {
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

    if (!isMobile) {
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
    }

    return (
        <List
            dataSource={topEarners || []}
            loading={isLoading}
            rowKey="id"
            pagination={{ pageSize: 5, size: 'small', simple: true }}
            renderItem={(item: any) => (
                <List.Item style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: '#8c8c8c' }}>ID: {item.id}</div>
                        </div>
                        <Tag color="gold" style={{ margin: 0 }}>{Number(item.loyaltyPoints).toFixed(0)} {t('pos.checkout.pts')}</Tag>
                    </div>
                </List.Item>
            )}
        />
    );
};
