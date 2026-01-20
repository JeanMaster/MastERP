import React from 'react';
import { Card, Tag, Space, Typography, Empty } from 'antd';
import {
    FireOutlined,
    WarningOutlined,
    InfoCircleOutlined,
    DollarOutlined,
    ShoppingOutlined,
    RiseOutlined,
    ToolOutlined,
} from '@ant-design/icons';
import type { AIRecommendation } from '../services/aiApi';

const { Title, Text, Paragraph } = Typography;

interface InsightsPanelProps {
    recommendations: AIRecommendation[];
    loading?: boolean;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ recommendations, loading }) => {
    if (loading) {
        return <div style={{ padding: 24, textAlign: 'center' }}>Generando recomendaciones...</div>;
    }

    if (!recommendations || recommendations.length === 0) {
        return (
            <Empty
                description="No hay recomendaciones disponibles"
                style={{ padding: 40 }}
            />
        );
    }

    const getPriorityConfig = (priority: 'high' | 'medium' | 'low') => {
        switch (priority) {
            case 'high':
                return { color: 'red', icon: <FireOutlined />, label: 'Alta Prioridad' };
            case 'medium':
                return { color: 'orange', icon: <WarningOutlined />, label: 'Prioridad Media' };
            case 'low':
                return { color: 'blue', icon: <InfoCircleOutlined />, label: 'Prioridad Baja' };
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'sales':
                return <DollarOutlined />;
            case 'inventory':
                return <ShoppingOutlined />;
            case 'finance':
                return <RiseOutlined />;
            case 'operations':
                return <ToolOutlined />;
            default:
                return <InfoCircleOutlined />;
        }
    };

    return (
        <div style={{ padding: 16 }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {recommendations.map((rec, index) => {
                    const priorityConfig = getPriorityConfig(rec.priority);
                    return (
                        <Card
                            key={index}
                            style={{
                                borderLeft: `4px solid ${priorityConfig.color === 'red' ? '#ff4d4f' : priorityConfig.color === 'orange' ? '#faad14' : '#1890ff'}`,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                            }}
                        >
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Space>
                                        {getCategoryIcon(rec.category)}
                                        <Title level={5} style={{ margin: 0 }}>
                                            {rec.title}
                                        </Title>
                                    </Space>
                                    <Tag color={priorityConfig.color} icon={priorityConfig.icon}>
                                        {priorityConfig.label}
                                    </Tag>
                                </div>

                                <Paragraph style={{ margin: '8px 0', color: '#595959' }}>
                                    {rec.description}
                                </Paragraph>

                                <div
                                    style={{
                                        background: '#f0f5ff',
                                        padding: '12px',
                                        borderRadius: '6px',
                                        borderLeft: '3px solid #1890ff',
                                    }}
                                >
                                    <Text strong style={{ color: '#1890ff' }}>
                                        💡 Acción Recomendada:
                                    </Text>
                                    <br />
                                    <Text style={{ color: '#262626' }}>{rec.action}</Text>
                                </div>
                            </Space>
                        </Card>
                    );
                })}
            </Space>
        </div>
    );
};
