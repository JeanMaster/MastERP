import { useState } from 'react';
import { Card, Table, Tag, Button, App, Space, Typography, DatePicker } from 'antd';
import { ReloadOutlined, DeleteOutlined, ExportOutlined } from '@ant-design/icons';
import { taxRetentionsApi, type TaxRetention } from '../../../services/taxRetentionsApi';
import { formatVenezuelanNumber } from '../../../utils/formatters';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;

export const RetentionsListPage = () => {
    const { message, modal } = App.useApp();
    const queryClient = useQueryClient();
    const [dateRange, setDateRange] = useState<any>(null);

    const { data: retentions = [], isLoading, refetch } = useQuery({
        queryKey: ['tax-retentions'],
        queryFn: taxRetentionsApi.findAll,
    });

    const handleExportTxt = async () => {
        try {
            message.loading({ content: 'Generando archivo TXT...', key: 'exporting' });
            
            const startDate = dateRange?.[0]?.format('YYYY-MM-DD');
            const endDate = dateRange?.[1]?.format('YYYY-MM-DD');
            
            const txtContent = await taxRetentionsApi.exportTxt(startDate, endDate);
            
            // Crear el blob y descargar el archivo
            const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const timestamp = dayjs().format('YYYYMMDD_HHmm');
            
            link.href = url;
            link.setAttribute('download', `retenciones_iva_${timestamp}.txt`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            message.success({ content: 'Archivo generado exitosamente', key: 'exporting' });
        } catch (error: any) {
            console.error('Export error:', error);
            message.error({ 
                content: error.response?.data?.message || 'Error al generar el archivo TXT', 
                key: 'exporting' 
            });
        }
    };

    const deleteMutation = useMutation({
        mutationFn: taxRetentionsApi.remove,
        onSuccess: () => {
            message.success('Retención eliminada y saldo revertido');
            queryClient.invalidateQueries({ queryKey: ['tax-retentions'] });
            queryClient.invalidateQueries({ queryKey: ['pending-invoices'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al eliminar retención');
        }
    });

    const handleDelete = (id: string) => {
        modal.confirm({
            title: '¿Eliminar Comprobante?',
            content: 'Se revertirá el pago asociado a la factura y se restaurará el saldo pendiente.',
            okText: 'Sí, eliminar',
            okType: 'danger',
            onOk: () => deleteMutation.mutate(id)
        });
    };

    const columns = [
        {
            title: 'Comprobante',
            dataIndex: 'voucherNumber',
            key: 'voucherNumber',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Fecha',
            dataIndex: 'voucherDate',
            key: 'voucherDate',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY')
        },
        {
            title: 'Tipo',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => {
                const colors: any = { IVA: 'blue', ISLR: 'purple', MUNICIPAL: 'orange' };
                return <Tag color={colors[type] || 'default'}>{type}</Tag>;
            }
        },
        {
            title: 'Referencia (Factura/Compra)',
            key: 'source',
            render: (_: any, record: TaxRetention) => {
                if (record.invoice) {
                    return (
                        <Space direction="vertical" size={0}>
                            <Text style={{ fontSize: '12px' }}>Factura: {record.invoice.number}</Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>Cliente: {record.invoice.client?.name}</Text>
                        </Space>
                    );
                }
                if (record.purchase) {
                    return (
                        <Space direction="vertical" size={0}>
                            <Text style={{ fontSize: '12px' }}>Compra: {record.purchase.invoiceNumber}</Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>Proveedor: {record.purchase.supplier?.name}</Text>
                        </Space>
                    );
                }
                return '-';
            }
        },
        {
            title: 'Base Imponible',
            dataIndex: 'baseAmount',
            key: 'baseAmount',
            align: 'right' as const,
            render: (amount: number) => `Bs. ${formatVenezuelanNumber(amount)}`
        },
        {
            title: '%',
            dataIndex: 'retentionPercent',
            key: 'retentionPercent',
            render: (p: number) => `${p}%`
        },
        {
            title: 'Monto Retenido',
            dataIndex: 'amount',
            key: 'amount',
            align: 'right' as const,
            render: (amount: number) => (
                <Text strong style={{ color: '#cf1322' }}>
                    Bs. {formatVenezuelanNumber(amount)}
                </Text>
            )
        },
        {
            title: 'Acciones',
            key: 'actions',
            render: (_: any, record: TaxRetention) => (
                <Space>
                    <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={() => handleDelete(record.id)}
                    />
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <Title level={2}>Control de Retenciones Fiscales</Title>
                <Space>
                    <DatePicker.RangePicker onChange={setDateRange} />
                    <Button 
                        icon={<ExportOutlined />} 
                        onClick={handleExportTxt}
                        disabled={isLoading}
                    >
                        TXT SENIAT
                    </Button>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Actualizar</Button>
                </Space>
            </div>

            <Card>
                <Table
                    dataSource={retentions}
                    columns={columns}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{ pageSize: 15 }}
                />
            </Card>
        </div>
    );
};
