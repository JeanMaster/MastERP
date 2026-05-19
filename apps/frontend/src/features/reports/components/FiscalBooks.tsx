import { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Spin, Empty, Typography, Row, Col, DatePicker, Grid, Tag, Space } from 'antd';
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { statsApi, type FiscalBookReport } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const FiscalBooks = () => {
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const [activeTab, setActiveTab] = useState<'ventas' | 'compras'>('ventas');
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<FiscalBookReport | null>(null);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
        dayjs().startOf('month'),
        dayjs().endOf('month')
    ]);

    useEffect(() => {
        fetchReport();
    }, [activeTab, dateRange]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            const startDate = dateRange[0].format('YYYY-MM-DD');
            const endDate = dateRange[1].format('YYYY-MM-DD');

            let data;
            if (activeTab === 'ventas') {
                data = await statsApi.getLibroVentas(startDate, endDate);
            } else {
                data = await statsApi.getLibroCompras(startDate, endDate);
            }
            setReportData(data);
        } catch (error) {
            console.error('Error fetching fiscal book:', error);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Fecha',
            dataIndex: 'date',
            key: 'date',
            render: (date: Date) => dayjs(date).format('DD/MM/YYYY'),
            width: 100,
        },
        {
            title: activeTab === 'ventas' ? 'RIF/CI Cliente' : 'RIF Proveedor',
            dataIndex: 'rif',
            key: 'rif',
            width: 120,
        },
        {
            title: 'Nombre o Razón Social',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
        },
        {
            title: 'Número Factura',
            dataIndex: 'invoiceNumber',
            key: 'invoiceNumber',
            width: 130,
        },
        {
            title: 'Número Control',
            dataIndex: 'controlNumber',
            key: 'controlNumber',
            width: 130,
        },
        {
            title: 'Tipo',
            dataIndex: 'type',
            key: 'type',
            width: 80,
        },
        {
            title: 'Total con IVA',
            dataIndex: 'totalWithVat',
            key: 'totalWithVat',
            align: 'right' as const,
            render: (val: number) => formatVenezuelanPrice(val, 'Bs'),
        },
        {
            title: 'Base Imponible',
            dataIndex: 'baseAmount',
            key: 'baseAmount',
            align: 'right' as const,
            render: (val: number) => formatVenezuelanPrice(val, 'Bs'),
        },
        {
            title: '% IVA',
            dataIndex: 'vatPercent',
            key: 'vatPercent',
            align: 'center' as const,
            width: 80,
            render: (val: number) => `${val}%`,
        },
        {
            title: 'Impuesto IVA',
            dataIndex: 'vatAmount',
            key: 'vatAmount',
            align: 'right' as const,
            render: (val: number) => formatVenezuelanPrice(val, 'Bs'),
        },
        {
            title: 'IVA Retenido',
            dataIndex: 'vatRetained',
            key: 'vatRetained',
            align: 'right' as const,
            render: (val: number) => formatVenezuelanPrice(val, 'Bs'),
        },
        {
            title: 'Comp. Retención',
            dataIndex: 'retentionVoucher',
            key: 'retentionVoucher',
            width: 130,
        },
    ];

    return (
        <div style={{ padding: isMobile ? 0 : 4 }}>
            <div style={{ marginBottom: 24, background: '#fff', padding: isMobile ? 16 : 20, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Row gutter={[16, 16]} align="middle" justify="space-between">
                    <Col xs={24} lg={12}>
                        <Space direction="vertical" size={4}>
                            <Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
                                {isMobile ? 'Libros Fiscales' : 'Libros Fiscales (Art. 75 / 76 LIVA)'}
                            </Title>
                            <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12 }}>Registros legales para presentación de impuestos</Text>
                        </Space>
                    </Col>
                    <Col xs={24} lg={12}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: isMobile ? 'flex-start' : 'flex-end' }}>
                            <RangePicker 
                                value={dateRange as any}
                                onChange={(dates) => {
                                    if (dates && dates[0] && dates[1]) {
                                        setDateRange([dates[0], dates[1]]);
                                    }
                                }}
                                format="DD/MM/YYYY"
                                size={isMobile ? 'small' : 'middle'}
                                style={{ width: isMobile ? '100%' : 'auto' }}
                            />
                            <Space size={8} style={{ width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
                                <Button
                                    icon={<PrinterOutlined />}
                                    onClick={() => window.print()}
                                    size={isMobile ? 'small' : 'middle'}
                                >
                                    {isMobile ? '' : 'Imprimir (Legal)'}
                                </Button>
                                <Button 
                                    icon={<DownloadOutlined />} 
                                    type="primary"
                                    size={isMobile ? 'small' : 'middle'}
                                >
                                    Exportar
                                </Button>
                            </Space>
                        </div>
                    </Col>
                </Row>
            </div>

            <Card 
                variant="borderless" 
                style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} 
                styles={{ body: { padding: 0 } }}
            >
                <Tabs
                    activeKey={activeTab}
                    onChange={(k) => setActiveTab(k as 'ventas' | 'compras')}
                    items={[
                        { key: 'ventas', label: 'LIBRO DE VENTAS' },
                        { key: 'compras', label: 'LIBRO DE COMPRAS' }
                    ]}
                    style={{ padding: '0 24px' }}
                />

                <div style={{ padding: isMobile ? 0 : '0 24px 24px 24px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '50px 0' }}>
                            <Spin size="large" tip="Cargando registros fiscales...">
                                <div style={{ padding: 40 }} />
                            </Spin>
                        </div>
                    ) : !reportData || reportData.rows.length === 0 ? (
                        <Empty description="No hay movimientos fiscales en el periodo seleccionado" />
                    ) : !isMobile ? (
                        <Table
                            dataSource={reportData.rows}
                            columns={columns}
                            rowKey="id"
                            size="small"
                            pagination={false}
                            scroll={{ x: 'max-content' }}
                            bordered
                            summary={pageData => {
                                let totalVat = 0;
                                let totalBase = 0;
                                let totalTax = 0;
                                let totalRetained = 0;

                                pageData.forEach(({ totalWithVat, baseAmount, vatAmount, vatRetained }) => {
                                    totalVat += totalWithVat;
                                    totalBase += baseAmount;
                                    totalTax += vatAmount;
                                    totalRetained += vatRetained;
                                });

                                return (
                                    <Table.Summary.Row style={{ background: '#fafafa', fontWeight: 'bold' }}>
                                        <Table.Summary.Cell index={0} colSpan={6}>TOTAL PERIODO</Table.Summary.Cell>
                                        <Table.Summary.Cell index={1} align="right">{formatVenezuelanPrice(totalVat, 'Bs')}</Table.Summary.Cell>
                                        <Table.Summary.Cell index={2} align="right">{formatVenezuelanPrice(totalBase, 'Bs')}</Table.Summary.Cell>
                                        <Table.Summary.Cell index={3} />
                                        <Table.Summary.Cell index={4} align="right">{formatVenezuelanPrice(totalTax, 'Bs')}</Table.Summary.Cell>
                                        <Table.Summary.Cell index={5} align="right">{formatVenezuelanPrice(totalRetained, 'Bs')}</Table.Summary.Cell>
                                        <Table.Summary.Cell index={6} />
                                    </Table.Summary.Row>
                                );
                            }}
                        />
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {reportData.rows.map((row: any) => (
                                <div key={row.id} style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <div>
                                            <Tag color="blue" style={{ margin: 0 }}>{row.invoiceNumber}</Tag>
                                            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>
                                                {dayjs(row.date).format('DD/MM/YYYY')} • Control: {row.controlNumber}
                                            </div>
                                        </div>
                                        <Text strong>{formatVenezuelanPrice(row.totalWithVat, 'Bs')}</Text>
                                    </div>
                                    <div style={{ marginBottom: 12 }}>
                                        <Text strong style={{ fontSize: 13 }}>{row.name}</Text>
                                        <div style={{ fontSize: 11, color: '#8c8c8c' }}>{row.rif}</div>
                                    </div>
                                    <Row gutter={[16, 8]}>
                                        <Col span={12}>
                                            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Base Imponible</Text>
                                            <Text style={{ fontSize: 12 }}>{formatVenezuelanPrice(row.baseAmount, 'Bs')}</Text>
                                        </Col>
                                        <Col span={12} style={{ textAlign: 'right' }}>
                                            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>IVA ({row.vatPercent}%)</Text>
                                            <Text style={{ fontSize: 12 }}>{formatVenezuelanPrice(row.vatAmount, 'Bs')}</Text>
                                        </Col>
                                        {row.vatRetained > 0 && (
                                            <Col span={24}>
                                                <div style={{ background: '#f6ffed', padding: '4px 8px', borderRadius: 4, display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                                    <Text style={{ fontSize: 11 }}>Retención IVA:</Text>
                                                    <Text strong style={{ fontSize: 11, color: '#3f8600' }}>-{formatVenezuelanPrice(row.vatRetained, 'Bs')}</Text>
                                                </div>
                                            </Col>
                                        )}
                                    </Row>
                                </div>
                            ))}
                            {/* Summary Card for Mobile */}
                            <div style={{ padding: '16px', background: '#fafafa', borderTop: '2px solid #1890ff' }}>
                                <Text strong style={{ display: 'block', marginBottom: 8 }}>TOTAL PERIODO</Text>
                                <Row gutter={[16, 8]}>
                                    <Col span={12}>
                                        <Text type="secondary" style={{ fontSize: 11 }}>Total con IVA</Text>
                                        <div style={{ fontWeight: 700 }}>
                                            {formatVenezuelanPrice(reportData.rows.reduce((acc: number, r: any) => acc + r.totalWithVat, 0), 'Bs')}
                                        </div>
                                    </Col>
                                    <Col span={12} style={{ textAlign: 'right' }}>
                                        <Text type="secondary" style={{ fontSize: 11 }}>Total Retenido</Text>
                                        <div style={{ fontWeight: 700, color: '#cf1322' }}>
                                            {formatVenezuelanPrice(reportData.rows.reduce((acc: number, r: any) => acc + r.vatRetained, 0), 'Bs')}
                                        </div>
                                    </Col>
                                </Row>
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .ant-table-wrapper, .ant-table-wrapper * {
                        visibility: visible;
                    }
                    .ant-table-wrapper {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    @page { size: landscape; }
                }
            `}</style>
        </div>
    );
};
