import { Card, Space, Typography, Empty, Row, Col, Divider } from 'antd';
import {
    RiseOutlined,
    PieChartOutlined,
    CheckCircleOutlined,
    WarningOutlined,
    CloseCircleOutlined,
} from '@ant-design/icons';
import type { AIDiagnosis } from '../services/aiApi';

const { Title, Text, Paragraph } = Typography;

interface InsightsPanelProps {
    diagnosis?: AIDiagnosis;
    loading?: boolean;
}

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ diagnosis, loading }) => {
    if (loading) {
        return <div style={{ padding: 48, textAlign: 'center' }}>Generando diagnóstico de salud...</div>;
    }

    if (!diagnosis) {
        return (
            <Empty
                description="No hay diagnóstico disponible para el periodo actual"
                style={{ padding: 40 }}
            />
        );
    }

    const getStatusConfig = (status: 'healthy' | 'warning' | 'critical') => {
        switch (status) {
            case 'healthy':
                return { color: 'green', icon: <CheckCircleOutlined />, label: 'Saludable', bgcolor: '#f6ffed', border: '#b7eb8f' };
            case 'warning':
                return { color: 'orange', icon: <WarningOutlined />, label: 'Precaución', bgcolor: '#fff7e6', border: '#ffe58f' };
            case 'critical':
                return { color: 'red', icon: <CloseCircleOutlined />, label: 'Estado Crítico', bgcolor: '#fff1f0', border: '#ffa39e' };
        }
    };

    const statusConfig = getStatusConfig(diagnosis.overallStatus);

    return (
        <div style={{ padding: '0 24px' }}>
            <Card
                style={{
                    marginBottom: 24,
                    background: statusConfig.bgcolor,
                    borderColor: statusConfig.border,
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
            >
                <Row align="middle" gutter={24}>
                    <Col>
                        <span style={{ fontSize: 32, color: statusConfig.color === 'green' ? '#52c41a' : statusConfig.color === 'orange' ? '#faad14' : '#f5222d' }}>
                            {statusConfig.icon}
                        </span>
                    </Col>
                    <Col flex="auto">
                        <Title level={4} style={{ margin: 0 }}>Estado del Negocio: {statusConfig.label}</Title>
                        <Paragraph strong style={{ margin: '8px 0 0 0' }}>
                            {diagnosis.summary}
                        </Paragraph>
                    </Col>
                </Row>
            </Card>

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                    <Title level={5}><RiseOutlined style={{ color: '#1890ff' }} /> Análisis de Ventas</Title>
                    <Card bordered={false} style={{ background: '#f8f9fa', borderRadius: '8px' }}>
                        <Paragraph style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', color: '#434343' }}>
                            {diagnosis.salesAnalysis}
                        </Paragraph>
                    </Card>
                </div>

                <Divider style={{ margin: '12px 0' }} />

                <div>
                    <Title level={5}><PieChartOutlined style={{ color: '#722ed1' }} /> Balance Financiero Estructural</Title>
                    <Card bordered={false} style={{ background: '#f8f9fa', borderRadius: '8px' }}>
                        <Paragraph style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', color: '#434343' }}>
                            {diagnosis.financialBalance}
                        </Paragraph>
                    </Card>
                </div>

                <div style={{ marginTop: 16 }}>
                    <Text italic type="secondary" style={{ fontSize: '12px' }}>
                        * Este diagnóstico se centra en la estructura de ingresos vs deudas y gastos, omitiendo el flujo de caja inmediato.
                    </Text>
                </div>
            </Space>
        </div>
    );
};
