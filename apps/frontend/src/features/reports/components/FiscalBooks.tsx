import { useState, useEffect } from 'react';
import { Card, Tabs, Table, Button, Spin, Empty, Typography, Row, Col, DatePicker } from 'antd';
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { statsApi, type FiscalBookReport } from '../../../services/statsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export const FiscalBooks = () => {
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
        <div>
            <div style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]} justify="space-between" align="middle">
                    <Col>
                        <Title level={4} style={{ margin: 0 }}>
                            Libros Fiscales (Art. 75 / 76 LIVA)
                        </Title>
                        <Text type="secondary">Registros legales para presentación de impuestos</Text>
                    </Col>
                    <Col>
                        <RangePicker 
                            value={dateRange as any}
                            onChange={(dates) => {
                                if (dates && dates[0] && dates[1]) {
                                    setDateRange([dates[0], dates[1]]);
                                }
                            }}
                            format="DD/MM/YYYY"
                            style={{ marginRight: 8 }}
                        />
                        <Button
                            icon={<PrinterOutlined />}
                            onClick={() => window.print()}
                            style={{ marginRight: 8 }}
                        >
                            Imprimir (Legal)
                        </Button>
                        <Button icon={<DownloadOutlined />} type="primary">
                            Exportar Excel
                        </Button>
                    </Col>
                </Row>
            </div>

            <Card style={{ padding: 0 }} bodyStyle={{ padding: 0 }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={(k) => setActiveTab(k as 'ventas' | 'compras')}
                    items={[
                        { key: 'ventas', label: 'LIBRO DE VENTAS' },
                        { key: 'compras', label: 'LIBRO DE COMPRAS' }
                    ]}
                    style={{ padding: '0 24px' }}
                />

                <div style={{ padding: '0 24px 24px 24px' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '50px 0' }}>
                            <Spin size="large" tip="Cargando registros fiscales..." />
                        </div>
                    ) : !reportData || reportData.rows.length === 0 ? (
                        <Empty description="No hay movimientos fiscales en el periodo seleccionado" />
                    ) : (
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
