import { useState } from 'react';
import { Card, Table, Tag, Button, App, Space, Typography, DatePicker } from 'antd';
import { ReloadOutlined, DeleteOutlined, ExportOutlined } from '@ant-design/icons';
import { taxRetentionsApi, type TaxRetention } from '../../../services/taxRetentionsApi';
import { formatVenezuelanNumber } from '../../../utils/formatters';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;

/**
 * RetentionsListPage Component
 * Page to list and manage tax retention vouchers (IVA, ISLR).
 * Allows exporting data for SENIAT (Venezuelan tax authority).
 */
export const RetentionsListPage = () => {
    const { message, modal } = App.useApp();
    const queryClient = useQueryClient();
    const [dateRange, setDateRange] = useState<any>(null);

    const { data: retentions = [], isLoading, refetch } = useQuery({
        queryKey: ['tax-retentions'],
        queryFn: taxRetentionsApi.findAll,
    });

    /**
     * Exports selected date range retentions to a TXT file compliant with SENIAT standards.
     */
    const handleExportTxt = async () => {
        try {
            message.loading({ content: 'Generating TXT file...', key: 'exporting' });
            
            const startDate = dateRange?.[0]?.format('YYYY-MM-DD');
            const endDate = dateRange?.[1]?.format('YYYY-MM-DD');
            
            const txtContent = await taxRetentionsApi.exportTxt(startDate, endDate);
            
            // Create blob and download file
            const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const timestamp = dayjs().format('YYYYMMDD_HHmm');
            
            link.href = url;
            link.setAttribute('download', `vat_retentions_${timestamp}.txt`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            message.success({ content: 'File generated successfully', key: 'exporting' });
        } catch (error: any) {
            console.error('Export error:', error);
            message.error({ 
                content: error.response?.data?.message || 'Error generating TXT file', 
                key: 'exporting' 
            });
        }
    };

    const deleteMutation = useMutation({
        mutationFn: taxRetentionsApi.remove,
        onSuccess: () => {
            message.success('Retention deleted and balance reverted');
            queryClient.invalidateQueries({ queryKey: ['tax-retentions'] });
            queryClient.invalidateQueries({ queryKey: ['pending-invoices'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error deleting retention');
        }
    });

    /**
     * Handles voucher deletion confirmation.
     * @param id The retention voucher ID.
     */
    const handleDelete = (id: string) => {
        modal.confirm({
            title: 'Delete Voucher?',
            content: 'The associated invoice payment will be reverted and the pending balance will be restored.',
            okText: 'Yes, Delete',
            okType: 'danger',
            onOk: () => deleteMutation.mutate(id)
        });
    };

    const columns = [
        {
            title: 'Voucher #',
            dataIndex: 'voucherNumber',
            key: 'voucherNumber',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: 'Date',
            dataIndex: 'voucherDate',
            key: 'voucherDate',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY')
        },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => {
                const colors: any = { IVA: 'blue', ISLR: 'purple', MUNICIPAL: 'orange' };
                return <Tag color={colors[type] || 'default'}>{type}</Tag>;
            }
        },
        {
            title: 'Reference (Invoice/Purchase)',
            key: 'source',
            render: (_: any, record: TaxRetention) => {
                if (record.invoice) {
                    return (
                        <Space direction="vertical" size={0}>
                            <Text style={{ fontSize: '12px' }}>Invoice: {record.invoice.number}</Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>Client: {record.invoice.client?.name}</Text>
                        </Space>
                    );
                }
                if (record.purchase) {
                    return (
                        <Space direction="vertical" size={0}>
                            <Text style={{ fontSize: '12px' }}>Purchase: {record.purchase.invoiceNumber}</Text>
                            <Text type="secondary" style={{ fontSize: '12px' }}>Supplier: {record.purchase.supplier?.name}</Text>
                        </Space>
                    );
                }
                return '-';
            }
        },
        {
            title: 'Taxable Base',
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
            title: 'Retained Amount',
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
            title: 'Actions',
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
                <Title level={2}>Tax Retentions Control</Title>
                <Space>
                    <DatePicker.RangePicker onChange={setDateRange} />
                    <Button 
                        icon={<ExportOutlined />} 
                        onClick={handleExportTxt}
                        disabled={isLoading}
                    >
                        SENIAT TXT
                    </Button>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Refresh</Button>
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
