import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Table, Radio, Space, Typography, Tag, Tooltip } from 'antd';
import {
    RiseOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { statsApi } from '../../../services/statsApi';
import { usePOSStore } from '../../../store/posStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const COGSReport: React.FC = () => {
    const [dateFilter, setDateFilter] = useState<'day' | 'month' | 'all'>('month');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('VES');
    const { currencies } = usePOSStore();

    const getDates = () => {
        if (dateFilter === 'day') {
            return {
                startDate: dayjs().format('YYYY-MM-DD'),
                endDate: dayjs().format('YYYY-MM-DD'),
            };
        }
        if (dateFilter === 'month') {
            return {
                startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
                endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
            };
        }
        return { startDate: '2000-01-01', endDate: dayjs().format('YYYY-MM-DD') };
    };

    const { data: report, isLoading } = useQuery({
        queryKey: ['cogsReport', selectedCurrency, dateFilter],
        queryFn: () => {
            const { startDate, endDate } = getDates();
            return statsApi.getCOGSReport(selectedCurrency, startDate, endDate);
        },
    });

    if (isLoading || !report) return <Card loading />;

    const currencySymbol = currencies.find((c: any) => c.code === selectedCurrency)?.symbol || selectedCurrency;

    // MATH LOGIC
    const utilityOperativa = report.totalSales - report.totalCOGS - report.totalExpenses;
    const restockNeed = Math.max(0, report.totalCOGS - report.totalPurchases);
    const estimatedCashFlow = report.totalSales - report.totalPurchases - report.totalExpenses;

    const getPercentage = (value: number) => {
        if (!report.totalSales || report.totalSales === 0) return '0%';
        return `${((value / report.totalSales) * 100).toFixed(1)}%`;
    };

    const columns = [
        { title: 'Producto', dataIndex: 'name', key: 'name' },
        { title: 'Cód/SKU', dataIndex: 'sku', key: 'sku', render: (sku: string) => sku || '-' },
        { title: 'Cant.', dataIndex: 'quantity', key: 'quantity', render: (q: number) => q.toLocaleString() },
        {
            title: 'Costo Total',
            dataIndex: 'totalCost',
            key: 'totalCost',
            render: (val: number) => `${currencySymbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        },
        {
            title: 'Ventas Totales',
            dataIndex: 'totalRevenue',
            key: 'totalRevenue',
            render: (val: number) => `${currencySymbol} ${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
        },
        {
            title: 'Margen Bruto',
            key: 'margin',
            render: (_: any, record: any) => {
                const margin = record.totalRevenue - record.totalCost;
                const pct = record.totalRevenue > 0 ? (margin / record.totalRevenue) * 100 : 0;
                return (
                    <Space>
                        <Text style={{ color: margin >= 0 ? '#52c41a' : '#ff4d4f' }}>
                            {currencySymbol} {margin.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </Text>
                        <Tag color={pct > 20 ? 'green' : 'orange'}>{pct.toFixed(1)}%</Tag>
                    </Space>
                );
            }
        },
    ];

    return (
        <div style={{ padding: '0px' }}>
            <div style={{ marginBottom: 24, background: '#fff', padding: 20, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <Row gutter={16} align="middle">
                    <Col xs={24} md={12}>
                        <Space direction="vertical">
                            <Title level={4} style={{ margin: 0 }}>Análisis de Reposición y Ganancia Real</Title>
                            <Text type="secondary">Diferencia entre el dinero en caja y el rendimiento real de tus ventas.</Text>
                        </Space>
                    </Col>
                    <Col xs={24} md={12} style={{ textAlign: 'right' }}>
                        <Space size="large">
                            <Radio.Group value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} buttonStyle="solid">
                                <Radio.Button value="day">Hoy</Radio.Button>
                                <Radio.Button value="month">Este Mes</Radio.Button>
                                <Radio.Button value="all">Todo</Radio.Button>
                            </Radio.Group>
                            <Radio.Group value={selectedCurrency} onChange={(e) => setSelectedCurrency(e.target.value)} buttonStyle="solid">
                                {currencies.map((c: any) => (
                                    <Radio.Button key={c.code} value={c.code}>{c.code}</Radio.Button>
                                ))}
                            </Radio.Group>
                        </Space>
                    </Col>
                </Row>
            </div>

            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false}>
                        <Statistic
                            title="Ingreso por Ventas"
                            value={report.totalSales}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#52c41a' }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>Monto total facturado (100%)</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false}>
                        <Statistic
                            title="Saldo en Caja (Estimado)"
                            value={estimatedCashFlow}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: estimatedCashFlow >= 0 ? '#1890ff' : '#ff4d4f' }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>Ventas - Compras - Gastos ({getPercentage(estimatedCashFlow)})</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false}>
                        <Statistic
                            title="Inversión Realizada"
                            value={report.totalPurchases}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#722ed1' }}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>Dinero ya gastado ({getPercentage(report.totalPurchases)})</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={4}>
                    <Card bordered={false}>
                        <Statistic
                            title="Falta por Reponer"
                            value={restockNeed}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: restockNeed > 0 ? '#faad14' : '#52c41a' }}
                            suffix={<Tooltip title="Lo que falta invertir para recuperar el stock vendido"><InfoCircleOutlined /></Tooltip>}
                        />
                        <Text type="secondary" style={{ fontSize: 11 }}>Costo Ventas - Inversión ({getPercentage(restockNeed)})</Text>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={8}>
                    <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                        <Statistic
                            title="GANANCIA NETA REAL"
                            value={utilityOperativa}
                            precision={2}
                            prefix={currencySymbol}
                            valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                            suffix={<Tooltip title="Ventas - Costo lo vendido - Gastos operativos"><RiseOutlined /></Tooltip>}
                        />
                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 'bold' }}>Rendimiento Real (Margen Neto: {getPercentage(utilityOperativa)})</Text>
                    </Card>
                </Col>
            </Row>

            <Card title="Detalle de Costos por Producto Vendido" bordered={false}>
                <Table
                    dataSource={report.products}
                    columns={columns}
                    rowKey="sku"
                    pagination={{ pageSize: 10 }}
                />
            </Card>
        </div>
    );
};

export default COGSReport;
