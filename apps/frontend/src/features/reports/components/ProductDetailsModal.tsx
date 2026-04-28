import React from 'react';
import { Modal, Spin, Row, Col, Card, Statistic, Typography } from 'antd';
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
        >
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '50px 0' }}>
                    <Spin size="large" />
                </div>
            ) : stats ? (
                <div style={{ marginTop: 16 }}>
                    <Row gutter={[16, 16]}>
                        <Col span={6}>
                            <Card size="small">
                                <Statistic 
                                    title={t('common.stock')} 
                                    value={stats.product.stock} 
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card size="small">
                                <Statistic 
                                    title={t('common.cost')} 
                                    value={formatVenezuelanPrice(stats.product.costInTarget, primaryCurrency?.symbol)} 
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card size="small">
                                <Statistic 
                                    title={t('common.margin')} 
                                    value={`${stats.product.margin}%`} 
                                />
                            </Card>
                        </Col>
                        <Col span={6}>
                            <Card size="small">
                                <Statistic 
                                    title={t('reports.products.revenue_6m')} 
                                    value={formatVenezuelanPrice(stats.metrics.totalRevenue6Months, primaryCurrency?.symbol)} 
                                />
                            </Card>
                        </Col>
                    </Row>
                    
                    <div style={{ marginTop: 24 }}>
                        <Title level={5}>{t('reports.products.evolution_title')}</Title>
                        <Card size="small">
                            <div style={{ height: 300, width: '100%' }}>
                                <ResponsiveContainer>
                                    <ComposedChart data={stats.salesHistory}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                                        <RechartsTooltip 
                                            formatter={(value: any, name: string) => {
                                                if (name === t('common.revenue')) return formatVenezuelanPrice(value, primaryCurrency?.symbol);
                                                return [value, t('common.units_sold')];
                                            }}
                                        />
                                        <Legend />
                                        <Bar yAxisId="left" dataKey="unitsSold" name={t('common.units')} fill="#8884d8" barSize={30} />
                                        <Line yAxisId="right" type="monotone" dataKey="revenue" name={t('common.revenue')} stroke="#82ca9d" strokeWidth={3} />
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
