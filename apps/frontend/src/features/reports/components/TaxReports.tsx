import { useEffect, useState } from 'react';
import { Card, Spin, Empty, Row, Col, Statistic, Radio, Tag, Typography, Button, Divider, Alert } from 'antd';
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
            <div style={{ padding: 48, textAlign: 'center' }}>
                <Spin size="large" tip="Calculando resumen fiscal..." />
            </div>
        );
    }

    if (!report) {
        return <Empty description="Error al cargar reporte de impuestos" />;
    }

    const { sales, purchases, summary, period } = report;

    return (
        <div>
            {/* Header & Filters */}
            <div style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]} align="middle" justify="space-between">
                    <Col>
                        <Title level={4} style={{ margin: 0 }}>
                            Resumen para Declaración de IVA / IGTF
                        </Title>
                        <Text type="secondary">
                            Periodo: {dayjs(period.start).format('DD/MM/YYYY')} al {dayjs(period.end).format('DD/MM/YYYY')}
                        </Text>
                    </Col>
                    <Col>
                        <Radio.Group
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            buttonStyle="solid"
                        >
                            <Radio.Button value="month">Este Mes</Radio.Button>
                            <Radio.Button value="lastMonth">Mes Anterior</Radio.Button>
                        </Radio.Group>
                        <Button 
                            icon={<DownloadOutlined />} 
                            style={{ marginLeft: 8 }}
                            onClick={() => window.print()}
                        >
                            Imprimir
                        </Button>
                    </Col>
                </Row>
            </div>

            {/* Main Result Card */}
            <Card style={{ marginBottom: 24, borderRadius: 8, background: '#fafafa', border: '1px solid #d9d9d9' }}>
                <Row gutter={[24, 24]} align="middle">
                    <Col xs={24} md={8}>
                        <Statistic
                            title={<Text strong style={{ fontSize: 14 }}>BALANCE IVA (DÉBITO - CRÉDITO)</Text>}
                            value={summary.vatBalance}
                            precision={2}
                            prefix="Bs"
                            valueStyle={{ color: summary.vatBalance >= 0 ? '#cf1322' : '#3f8600', fontSize: 24 }}
                        />
                        <Text type="secondary">Antes de retenciones</Text>
                    </Col>
                    <Col xs={24} md={8}>
                        <Statistic
                            title={<Text strong style={{ fontSize: 16 }}>{summary.isAValueFavor ? 'EXCEDENTE / CRÉDITO FISCAL' : 'IVA FINAL A PAGAR'}</Text>}
                            value={summary.isAValueFavor ? summary.vatCreditExcess : summary.vatToPay}
                            precision={2}
                            prefix="Bs"
                            valueStyle={{ color: summary.isAValueFavor ? '#3f8600' : '#cf1322', fontSize: 32 }}
                        />
                        <Text type={summary.isAValueFavor ? "success" : "danger"} strong>
                            {summary.isAValueFavor ? 'A tu favor para el próximo mes' : 'Monto neto a depositar al SENIAT'}
                        </Text>
                    </Col>
                    <Col xs={24} md={8}>
                        <Statistic
                            title={<Text strong style={{ fontSize: 16 }}>TOTAL IGTF A PAGAR</Text>}
                            value={summary.igtfToPay}
                            precision={2}
                            prefix="Bs"
                            valueStyle={{ color: '#faad14', fontSize: 32 }}
                        />
                        <Text type="warning" strong>Recaudado por ventas en divisas</Text>
                    </Col>
                </Row>
            </Card>

            <Row gutter={[24, 24]}>
                {/* Sales Section */}
                <Col xs={24} lg={12}>
                    <Card 
                        title={<span><ArrowUpOutlined style={{ color: '#1890ff' }} /> Débitos Fiscales (Ventas)</span>}
                        extra={<Tag color="blue">{sales.count} Documentos</Tag>}
                    >
                        <Statistic
                            title="Base Imponible Ventas"
                            value={sales.base}
                            precision={2}
                            prefix="Bs"
                        />
                        <Divider style={{ margin: '12px 0' }} />
                        <Row>
                            <Col span={12}>
                                <Statistic
                                    title="IVA Generado"
                                    value={sales.tax}
                                    precision={2}
                                    prefix="Bs"
                                    valueStyle={{ fontSize: 18 }}
                                />
                            </Col>
                            <Col span={12}>
                                <Statistic
                                    title="Retenciones Recibidas"
                                    value={sales.retentions}
                                    precision={2}
                                    prefix="Bs"
                                    valueStyle={{ color: '#3f8600', fontSize: 18 }}
                                />
                            </Col>
                        </Row>
                        <div style={{ marginTop: 16, padding: 12, background: '#f0f5ff', borderRadius: 4 }}>
                            <Text strong>Subtotal Débito Neto: </Text>
                            <Text strong style={{ float: 'right' }}>{formatVenezuelanPrice(sales.netDebit, 'Bs')}</Text>
                        </div>
                    </Card>
                </Col>

                {/* Purchases Section */}
                <Col xs={24} lg={12}>
                    <Card 
                        title={<span><ArrowDownOutlined style={{ color: '#3f8600' }} /> Créditos Fiscales (Compras)</span>}
                        extra={<Tag color="green">{purchases.count} Documentos</Tag>}
                    >
                        <Statistic
                            title="Base Imponible Compras"
                            value={purchases.base}
                            precision={2}
                            prefix="Bs"
                        />
                        <Divider style={{ margin: '12px 0' }} />
                        <Row>
                            <Col span={12}>
                                <Statistic
                                    title="IVA Soportado"
                                    value={purchases.tax}
                                    precision={2}
                                    prefix="Bs"
                                    valueStyle={{ fontSize: 18 }}
                                />
                            </Col>
                            <Col span={12}>
                                <Statistic
                                    title="Retenciones Emitidas"
                                    value={purchases.retentions}
                                    precision={2}
                                    prefix="Bs"
                                    valueStyle={{ color: '#cf1322', fontSize: 18 }}
                                />
                            </Col>
                        </Row>
                        <div style={{ marginTop: 16, padding: 12, background: '#f6ffed', borderRadius: 4 }}>
                            <Text strong>Subtotal Crédito Neto: </Text>
                            <Text strong style={{ float: 'right' }}>{formatVenezuelanPrice(purchases.netCredit, 'Bs')}</Text>
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

