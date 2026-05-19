import { useEffect, useState } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, Radio, Tag, Typography, Button, Divider, Alert, Grid, Space } from 'antd';
import {
    DownloadOutlined,
    CalculatorOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
} from '@ant-design/icons';
import { statsApi, type TaxReport } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export const TaxReports = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [report, setReport] = useState<TaxReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState<string>('month');

    useEffect(() => {
        fetchReport();
    }, [dateFilter]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            let startDate: string | undefined;
            let endDate: string | undefined;

            if (dateFilter === 'month') {
                startDate = dayjs().startOf('month').format('YYYY-MM-DD');
                endDate = dayjs().endOf('month').format('YYYY-MM-DD');
            } else if (dateFilter === 'lastMonth') {
                startDate = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
                endDate = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
            }

            const data = await statsApi.getTaxReport(startDate, endDate);
            setReport(data);
        } catch (error) {
            console.error('Error fetching tax report:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '50px' }}>
                <Spin size="large" tip="Calculando resumen fiscal...">
                    <div style={{ padding: 50 }} />
                </Spin>
            </div>
        );
    }

    if (!report) {
        return <Empty description="Error al cargar reporte de impuestos" />;
    }

    const { sales, purchases, summary, period } = report;



    return (
        <div style={{ padding: isMobile ? '0' : '4px' }}>
            {/* Header & Filters */}
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 20, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Row gutter={[16, 16]} align="middle" justify="space-between">
                    <Col xs={24} lg={12}>
                        <Space direction="vertical" size={4}>
                            <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
                                {isMobile ? 'Resumen Fiscal' : 'Resumen para Declaración de IVA / IGTF'}
                            </Title>
                            <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>
                                Periodo: {dayjs(period.start).format('DD/MM/YYYY')} - {dayjs(period.end).format('DD/MM/YYYY')}
                            </Text>
                        </Space>
                    </Col>
                    <Col xs={24} lg={12} style={{ textAlign: isMobile ? 'left' : 'right' }}>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <Radio.Group
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                buttonStyle="solid"
                                size={isMobile ? 'small' : 'middle'}
                            >
                                <Radio.Button value="month">Este Mes</Radio.Button>
                                <Radio.Button value="lastMonth">Anterior</Radio.Button>
                            </Radio.Group>
                            <Button 
                                icon={<DownloadOutlined />} 
                                size={isMobile ? 'small' : 'middle'}
                                onClick={() => window.print()}
                                type="primary"
                                ghost
                            >
                                {!isMobile && 'Imprimir'}
                            </Button>
                        </div>
                    </Col>
                </Row>
            </div>

            {/* Main Result Card */}
            {/* Main Result Card */}
            <Card variant="borderless" style={{ marginBottom: 24, borderRadius: 16, background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} styles={{ body: { padding: isMobile ? 16 : 24 } }}>
                <Row gutter={[24, 24]} align="middle">
                    <Col xs={24} md={8}>
                        <Statistic
                            title={<Text strong style={{ fontSize: 11, color: '#8c8c8c' }}>BALANCE IVA (DÉBITO - CRÉDITO)</Text>}
                            value={summary.vatBalance}
                            precision={2}
                            prefix="Bs"
                            styles={{ content: { color: summary.vatBalance >= 0 ? '#cf1322' : '#3f8600', fontSize: isMobile ? 22 : 24, fontWeight: 600 } }}
                        />
                        <Text type="secondary" style={{ fontSize: 10 }}>Antes de retenciones</Text>
                    </Col>
                    <Col xs={24} md={8}>
                        <div style={{ padding: isMobile ? '16px 0' : '0 24px', borderTop: isMobile ? '1px solid #f0f0f0' : 'none', borderBottom: isMobile ? '1px solid #f0f0f0' : 'none', borderLeft: !isMobile ? '1px solid #f0f0f0' : 'none', borderRight: !isMobile ? '1px solid #f0f0f0' : 'none' }}>
                            <Statistic
                                title={<Text strong style={{ fontSize: 12, color: summary.isAValueFavor ? '#3f8600' : '#cf1322' }}>{summary.isAValueFavor ? 'EXCEDENTE / CRÉDITO FISCAL' : 'IVA FINAL A PAGAR'}</Text>}
                                value={summary.isAValueFavor ? summary.vatCreditExcess : summary.vatToPay}
                                precision={2}
                                prefix="Bs"
                                styles={{ content: { color: summary.isAValueFavor ? '#3f8600' : '#cf1322', fontSize: isMobile ? 28 : 32, fontWeight: 700 } }}
                            />
                            <Text type={summary.isAValueFavor ? "success" : "danger"} strong style={{ fontSize: 11 }}>
                                {summary.isAValueFavor ? 'A tu favor para el próximo mes' : 'Monto neto a depositar'}
                            </Text>
                        </div>
                    </Col>
                    <Col xs={24} md={8}>
                        <Statistic
                            title={<Text strong style={{ fontSize: 12, color: '#faad14' }}>TOTAL IGTF A PAGAR</Text>}
                            value={summary.igtfToPay}
                            precision={2}
                            prefix="Bs"
                            styles={{ content: { color: '#faad14', fontSize: isMobile ? 28 : 32, fontWeight: 700 } }}
                        />
                        <Text type="warning" strong style={{ fontSize: 11 }}>Recaudado por ventas en divisas</Text>
                    </Col>
                </Row>
            </Card>

            <Row gutter={[24, 24]}>
                {/* Sales Section */}
                <Col xs={24} lg={12}>
                    <Card 
                        variant="borderless"
                        style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                        title={<Space><ArrowUpOutlined style={{ color: '#1890ff' }} /> <Text strong>Débitos Fiscales (Ventas)</Text></Space>}
                        extra={<Tag color="blue">{sales.count} Doc</Tag>}
                    >
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 12 }}>Base Imponible Ventas</Text>}
                            value={sales.base}
                            precision={2}
                            prefix="Bs"
                        />
                        <Divider style={{ margin: '16px 0' }} />
                        <Row gutter={16}>
                            <Col span={12}>
                                <Statistic
                                    title={<Text type="secondary" style={{ fontSize: 11 }}>IVA Generado</Text>}
                                    value={sales.tax}
                                    precision={2}
                                    prefix="Bs"
                                    styles={{ content: { fontSize: 18, fontWeight: 600 } }}
                                />
                            </Col>
                            <Col span={12}>
                                <Statistic
                                    title={<Text type="secondary" style={{ fontSize: 11 }}>Retenciones Recibidas</Text>}
                                    value={sales.retentions}
                                    precision={2}
                                    prefix="Bs"
                                    styles={{ content: { color: '#3f8600', fontSize: 18, fontWeight: 600 } }}
                                />
                            </Col>
                        </Row>
                        <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0f5ff', borderRadius: 12, display: 'flex', justifyContent: 'space-between' }}>
                            <Text strong style={{ color: '#0050b3' }}>Débito Neto:</Text>
                            <Text strong style={{ color: '#0050b3' }}>{formatVenezuelanPrice(sales.netDebit, 'Bs')}</Text>
                        </div>
                    </Card>
                </Col>

                {/* Purchases Section */}
                <Col xs={24} lg={12}>
                    <Card 
                        variant="borderless"
                        style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                        title={<Space><ArrowDownOutlined style={{ color: '#3f8600' }} /> <Text strong>Créditos Fiscales (Compras)</Text></Space>}
                        extra={<Tag color="green">{purchases.count} Doc</Tag>}
                    >
                        <Statistic
                            title={<Text type="secondary" style={{ fontSize: 12 }}>Base Imponible Compras</Text>}
                            value={purchases.base}
                            precision={2}
                            prefix="Bs"
                        />
                        <Divider style={{ margin: '16px 0' }} />
                        <Row gutter={16}>
                            <Col span={12}>
                                <Statistic
                                    title={<Text type="secondary" style={{ fontSize: 11 }}>IVA Soportado</Text>}
                                    value={purchases.tax}
                                    precision={2}
                                    prefix="Bs"
                                    styles={{ content: { fontSize: 18, fontWeight: 600 } }}
                                />
                            </Col>
                            <Col span={12}>
                                <Statistic
                                    title={<Text type="secondary" style={{ fontSize: 11 }}>Retenciones Emitidas</Text>}
                                    value={purchases.retentions}
                                    precision={2}
                                    prefix="Bs"
                                    styles={{ content: { color: '#cf1322', fontSize: 18, fontWeight: 600 } }}
                                />
                            </Col>
                        </Row>
                        <div style={{ marginTop: 16, padding: '12px 16px', background: '#f6ffed', borderRadius: 12, display: 'flex', justifyContent: 'space-between' }}>
                            <Text strong style={{ color: '#237804' }}>Crédito Neto:</Text>
                            <Text strong style={{ color: '#237804' }}>{formatVenezuelanPrice(purchases.netCredit, 'Bs')}</Text>
                        </div>
                    </Card>
                </Col>
            </Row>

            {/* Assistance Alert */}
            <Alert
                message="Información para Declaración"
                description="Consulte estos montos en el Portal Fiscal (SENIAT). Los valores mostrados son nominales basados en los registros del sistema para el periodo seleccionado."
                type="info"
                showIcon
                style={{ marginTop: 24 }}
                icon={<CalculatorOutlined />}
            />
        </div>
    );
};

