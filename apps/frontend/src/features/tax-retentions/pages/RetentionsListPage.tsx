import { useState } from 'react';
import { Card, Table, Tag, Button, App, Space, Typography, DatePicker, Grid, List } from 'antd';
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
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;

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
        <div style={{ padding: isMobile ? '12px' : '24px 32px', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between', 
                alignItems: isMobile ? 'flex-start' : 'center', 
                marginBottom: 24,
                gap: 16
            }}>
                <Title level={isMobile ? 3 : 2} style={{ margin: 0, fontWeight: 800, color: '#1e293b' }}>
                    {t('tax_retention.list.title')}
                </Title>
                <Space size={isMobile ? "small" : "middle"} wrap={isMobile} style={{ width: isMobile ? '100%' : 'auto' }}>
                    <DatePicker.RangePicker 
                        onChange={setDateRange} 
                        style={{ borderRadius: '8px', width: isMobile ? '100%' : 'auto' }}
                        placeholder={[t('common.date'), t('common.date')]}
                    />
                    <div style={{ display: 'flex', gap: '8px', width: isMobile ? '100%' : 'auto' }}>
                        <Button 
                            icon={<ExportOutlined />} 
                            onClick={handleExportTxt}
                            disabled={isLoading}
                            style={{ borderRadius: '8px', height: '40px', flex: isMobile ? 1 : 'none' }}
                        >
                            SENIAT
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
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                                flex: isMobile ? 1 : 'none'
                            }}
                        >
                            {isMobile ? '' : t('common.refresh')}
                        </Button>
                    </div>
                </Space>
            </div>

            <Card styles={{ body: { padding: isMobile ? 8 : 24 } }} style={{ borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: 'none', overflow: 'hidden' }}>
                {!isMobile ? (
                    <Table
                        dataSource={retentions}
                        columns={columns}
                        rowKey="id"
                        loading={isLoading}
                        pagination={{ pageSize: 15 }}
                        className="premium-table"
                    />
                ) : (
                    <List
                        dataSource={retentions}
                        loading={isLoading}
                        pagination={{ pageSize: 10, size: 'small', simple: true }}
                        renderItem={(item: TaxRetention) => {
                            const colors: any = { IVA: 'blue', ISLR: 'purple', MUNICIPAL: 'orange' };
                            return (
                                <List.Item style={{ padding: '8px 0', border: 'none' }}>
                                    <Card
                                        style={{ 
                                            width: '100%', 
                                            borderRadius: '16px', 
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                            border: '1px solid #f0f0f0'
                                        }}
                                        styles={{ body: { padding: '16px' } }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                            <div>
                                                <Typography.Text strong style={{ fontSize: '16px', display: 'block' }}>
                                                    {item.voucherNumber}
                                                </Typography.Text>
                                                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                                    {dayjs(item.voucherDate).format('DD/MM/YYYY')}
                                                </Typography.Text>
                                            </div>
                                            <Tag color={colors[item.type] || 'default'} style={{ borderRadius: '12px', margin: 0, fontWeight: 600 }}>
                                                {item.type}
                                            </Tag>
                                        </div>

                                        <div style={{ background: '#fafafa', borderRadius: '12px', padding: '12px', marginBottom: 16 }}>
                                            {item.invoice ? (
                                                <Space direction="vertical" size={0}>
                                                    <Typography.Text style={{ fontSize: '13px' }}>Invoice: {item.invoice.number}</Typography.Text>
                                                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>Client: {item.invoice.client?.name}</Typography.Text>
                                                </Space>
                                            ) : item.purchase ? (
                                                <Space direction="vertical" size={0}>
                                                    <Typography.Text style={{ fontSize: '13px' }}>Purchase: {item.purchase.invoiceNumber}</Typography.Text>
                                                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>Supplier: {item.purchase.supplier?.name}</Typography.Text>
                                                </Space>
                                            ) : '-'}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Typography.Text type="secondary">{t('tax_retention.list.taxable_base')}</Typography.Text>
                                            <Typography.Text>Bs. {formatVenezuelanNumber(item.baseAmount)}</Typography.Text>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <Typography.Text type="secondary">{t('tax_retention.retained_amount')} ({item.retentionPercent}%)</Typography.Text>
                                            <Typography.Text strong style={{ color: '#cf1322', fontSize: '16px' }}>
                                                Bs. {formatVenezuelanNumber(item.amount)}
                                            </Typography.Text>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f0f0f0', paddingTop: '12px', marginTop: '12px' }}>
                                            <Button 
                                                danger 
                                                type="text" 
                                                icon={<DeleteOutlined />} 
                                                onClick={() => handleDelete(item.id)}
                                                style={{ borderRadius: '8px' }}
                                            >
                                                {t('common.delete')}
                                            </Button>
                                        </div>
                                    </Card>
                                </List.Item>
                            );
                        }}
                    />
                )}
            </Card>
        </div>
    );
};
