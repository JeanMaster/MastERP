import React from 'react';
import { Modal, Spin, Row, Col, Card, Statistic, Typography, Grid } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../../services/statsApi';
import { usePOSStore } from '../../../store/posStore';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart
} from 'recharts';

const { Title, Text } = Typography;

interface ProductDetailsModalProps {
    productId: string;
    visible: boolean;
    onClose: () => void;
}

export const ProductDetailsModal: React.FC<ProductDetailsModalProps> = ({ productId, visible, onClose }) => {
    const { t } = useTranslation();
    const { primaryCurrency } = usePOSStore();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    
    const { data: stats, isLoading } = useQuery({
        queryKey: ['productStats', productId, primaryCurrency?.code],
        queryFn: () => statsApi.getProductStats(productId, primaryCurrency?.code),
        enabled: visible && !!productId && !!primaryCurrency?.code
    });

    return (
        <Modal
            title={stats?.product?.name || t('reports.products.details_title')}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={800}
            destroyOnClose
            style={{ top: 20 }}
        >
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <Spin size="large" />
                </div>
            ) : stats ? (
                <div style={{ marginTop: 16 }}>
                    <Row gutter={[12, 12]}>
                        <Col xs={12} sm={6}>
                            <Card variant="borderless" style={{ background: '#f5f5f5', borderRadius: 12 }}>
                                <Statistic 
                                    title={<Text type="secondary" style={{ fontSize: 11 }}>STOCK</Text>}
                                    value={stats.product.stock} 
                                    styles={{ content: { fontSize: isMobile ? 18 : 22, fontWeight: 700 } }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card variant="borderless" style={{ background: '#f6ffed', borderRadius: 12 }}>
                                <Statistic 
                                    title={<Text type="secondary" style={{ fontSize: 11 }}>COSTO</Text>}
                                    value={stats.product.costInTarget} 
                                    precision={2}
                                    prefix={primaryCurrency?.symbol}
                                    styles={{ content: { fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#52c41a' } }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card variant="borderless" style={{ background: '#fff7e6', borderRadius: 12 }}>
                                <Statistic 
                                    title={<Text type="secondary" style={{ fontSize: 11 }}>MARGEN</Text>}
                                    value={stats.product.margin} 
                                    suffix="%"
                                    styles={{ content: { fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#faad14' } }}
                                />
                            </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                            <Card variant="borderless" style={{ background: '#e6f7ff', borderRadius: 12 }}>
                                <Statistic 
                                    title={<Text type="secondary" style={{ fontSize: 11 }}>RECAUDO 6M</Text>}
                                    value={stats.metrics.totalRevenue6Months} 
                                    precision={2}
                                    prefix={primaryCurrency?.symbol}
                                    styles={{ content: { fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#1890ff' } }}
                                />
                            </Card>
                        </Col>
                    </Row>
                    
                    <div style={{ marginTop: 24 }}>
                        <Title level={5}>{t('reports.products.evolution_title')}</Title>
                        <Card variant="borderless" style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                            <div style={{ height: isMobile ? 250 : 350, width: '100%', position: 'relative' }}>
                                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                                    <ComposedChart data={stats.salesHistory}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={10} />
                                        <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} fontSize={10} stroke="#8884d8" />
                                        <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} fontSize={10} stroke="#82ca9d" />
                                        <RechartsTooltip 
                                            formatter={(value: any, name: string) => {
                                                if (name === t('common.revenue')) return formatVenezuelanPrice(value, primaryCurrency?.symbol);
                                                return [value, t('common.units_sold')];
                                            }}
                                            contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        />
                                        <Legend iconType="circle" />
                                        <Bar yAxisId="left" dataKey="unitsSold" name={t('common.units')} fill="#8884d8" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Line yAxisId="right" type="monotone" dataKey="revenue" name={t('common.revenue')} stroke="#82ca9d" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </div>
            ) : (
                <Text type="danger">{t('common.error')}</Text>
            )}
        </Modal>
    );
};
