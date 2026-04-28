import { useState } from 'react';
import { Card, Table, Tag, Button, App, Space, Typography, DatePicker } from 'antd';
import { ReloadOutlined, DeleteOutlined, ExportOutlined } from '@ant-design/icons';
import { taxRetentionsApi, type TaxRetention } from '../../../services/taxRetentionsApi';
import { formatVenezuelanNumber } from '../../../utils/formatters';
import dayjs from 'dayjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

/**
 * RetentionsListPage Component
 * Page to list and manage tax retention vouchers (IVA, ISLR).
 * Allows exporting data for SENIAT (Venezuelan tax authority).
 */
export const RetentionsListPage = () => {
    const { t } = useTranslation();
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
            message.loading({ content: t('tax_retention.messages.export_loading'), key: 'exporting' });
            
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

            message.success({ content: t('tax_retention.messages.export_success'), key: 'exporting' });
        } catch (error: any) {
            console.error('Export error:', error);
            message.error({ 
                content: error.response?.data?.message || t('tax_retention.messages.export_error'), 
                key: 'exporting' 
            });
        }
    };

    const deleteMutation = useMutation({
        mutationFn: taxRetentionsApi.remove,
        onSuccess: () => {
            message.success(t('tax_retention.messages.delete_success'));
            queryClient.invalidateQueries({ queryKey: ['tax-retentions'] });
            queryClient.invalidateQueries({ queryKey: ['pending-invoices'] });
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('tax_retention.messages.delete_error'));
        }
    });

    /**
     * Handles voucher deletion confirmation.
     * @param id The retention voucher ID.
     */
    const handleDelete = (id: string) => {
        modal.confirm({
            title: t('tax_retention.list.delete_title'),
            content: t('tax_retention.list.delete_content'),
            okText: t('common.yes'),
            okType: 'danger',
            onOk: () => deleteMutation.mutate(id)
        });
    };

    const columns = [
        {
            title: t('tax_retention.list.voucher'),
            dataIndex: 'voucherNumber',
            key: 'voucherNumber',
            render: (text: string) => <Text strong>{text}</Text>
        },
        {
            title: t('tax_retention.list.date'),
            dataIndex: 'voucherDate',
            key: 'voucherDate',
            render: (date: string) => dayjs(date).format('DD/MM/YYYY')
        },
        {
            title: t('tax_retention.type'),
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => {
                const colors: any = { IVA: 'blue', ISLR: 'purple', MUNICIPAL: 'orange' };
                return <Tag color={colors[type] || 'default'} style={{ borderRadius: '4px', fontWeight: 600 }}>{type}</Tag>;
            }
        },
        {
            title: t('tax_retention.list.reference'),
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
            title: t('tax_retention.list.taxable_base'),
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
            title: t('tax_retention.retained_amount'),
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
            title: t('common.actions'),
            key: 'actions',
            align: 'right' as const,
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
        <div style={{ padding: '24px 32px', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#1e293b' }}>
                    {t('tax_retention.list.title')}
                </Title>
                <Space size="middle">
                    <DatePicker.RangePicker 
                        onChange={setDateRange} 
                        style={{ borderRadius: '8px' }}
                        placeholder={[t('common.date'), t('common.date')]}
                    />
                    <Button 
                        icon={<ExportOutlined />} 
                        onClick={handleExportTxt}
                        disabled={isLoading}
                        style={{ borderRadius: '8px', height: '40px' }}
                    >
                        SENIAT TXT
                    </Button>
                    <Button 
                        type="primary" 
                        icon={<ReloadOutlined />} 
                        onClick={() => refetch()}
                        style={{ 
                            borderRadius: '8px', 
                            height: '40px',
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                        }}
                    >
                        {t('common.refresh')}
                    </Button>
                </Space>
            </div>

            <Card style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', overflow: 'hidden' }}>
                <Table
                    dataSource={retentions}
                    columns={columns}
                    rowKey="id"
                    loading={isLoading}
                    pagination={{ pageSize: 15 }}
                    className="premium-table"
                />
            </Card>
        </div>
    );
};
