import { Modal, Descriptions, Table, Tag, Typography, Divider } from 'antd';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Text } = Typography;
import { useTranslation } from 'react-i18next';

interface ReturnDetailsModalProps {
    open: boolean;
    onClose: () => void;
    record: any;
}

/**
 * ReturnDetailsModal Component
 * Displays the full details of a specific return or exchange request.
 * Shows the original invoice reference, returned items, and if applicable, the replacement items and financial balance.
 */
export const ReturnDetailsModal = ({ open, onClose, record }: ReturnDetailsModalProps) => {
    const { t } = useTranslation();
    if (!record) return null;

    const getTypeTag = (type: string) => {
        const labels: Record<string, string> = {
            REFUND: t('returns.type_refund_short'),
            EXCHANGE_SAME: t('returns.type_exchange_same_short'),
            EXCHANGE_DIFFERENT: t('returns.type_exchange_different_short')
        };
        const colors: Record<string, string> = {
            REFUND: 'purple',
            EXCHANGE_SAME: 'cyan',
            EXCHANGE_DIFFERENT: 'geekblue'
        };
        return <Tag color={colors[type]}>{labels[type] || type}</Tag>;
    };

    const getStatusTag = (status: string) => {
        const labels: Record<string, string> = {
            PENDING: t('returns.status_pending'),
            APPROVED: t('returns.status_approved'),
            REJECTED: t('returns.status_rejected'),
            COMPLETED: t('returns.status_completed')
        };
        const colors: Record<string, string> = {
            PENDING: 'orange',
            APPROVED: 'blue',
            REJECTED: 'red',
            COMPLETED: 'green'
        };
        return <Tag color={colors[status]}>{labels[status] || status}</Tag>;
    };

    const itemsColumns = [
        {
            title: t('common.product'),
            key: 'product',
            render: (_: any, r: any) => (
                <div>
                    <Text strong>{r.product?.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>{r.product?.sku}</Text>
                </div>
            )
        },
        {
            title: t('common.qty_short'),
            dataIndex: 'quantity',
            key: 'quantity',
            width: 80,
            render: (qty: any) => Number(qty)
        },
        {
            title: t('common.unit_price'),
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            align: 'right' as const,
            render: (val: any) => formatVenezuelanPrice(Number(val))
        },
        {
            title: t('common.total'),
            dataIndex: 'total',
            key: 'total',
            align: 'right' as const,
            render: (val: any) => formatVenezuelanPrice(Number(val))
        }
    ];

    const replacementColumns = [
        ...itemsColumns.filter(col => col.key !== 'unitPrice'),
        {
            title: t('returns.modal.replacement_items'),
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            align: 'right' as const,
            render: (val: any) => formatVenezuelanPrice(Number(val))
        }
    ];

    const totalDevuelto = record.items?.reduce((sum: number, i: any) => sum + Number(i.total), 0) || 0;
    const totalCambio = record.replacementItems?.reduce((sum: number, i: any) => sum + Number(i.total), 0) || 0;
    const difference = totalDevuelto - totalCambio;

    return (
        <Modal
            title={t('returns.modal.detail_title', { number: record.creditNoteNumber })}
            open={open}
            onCancel={onClose}
            footer={null}
            width={800}
        >
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label={t('returns.table.invoice')}>{record.originalSale?.invoiceNumber}</Descriptions.Item>
                <Descriptions.Item label={t('returns.table.date')}>{dayjs(record.createdAt).format('MM/DD/YYYY HH:mm')}</Descriptions.Item>
                <Descriptions.Item label={t('returns.table.customer')}>{record.originalSale?.client?.name || t('common.walk_in_customer')}</Descriptions.Item>
                <Descriptions.Item label={t('returns.table.type')}>{getTypeTag(record.returnType)}</Descriptions.Item>
                <Descriptions.Item label={t('returns.table.status')}>{getStatusTag(record.status)}</Descriptions.Item>
                <Descriptions.Item label={t('returns.modal.requested_by', { defaultValue: 'Requested By' })}>{record.requestedBy || '-'}</Descriptions.Item>
                <Descriptions.Item label={`${t('returns.modal.reason')} & ${t('common.notes')}`} span={2}>
                    <Tag>{record.reason}</Tag> {record.notes || t('common.no_notes', { defaultValue: 'No additional notes provided' })}
                </Descriptions.Item>
            </Descriptions>

            <Divider orientation={"left" as any}>{t('returns.modal.invoice_items')}</Divider>
            <Table
                dataSource={record.items || []}
                columns={itemsColumns}
                rowKey="id"
                pagination={false}
                size="small"
                summary={() => (
                    <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={3} align="right"><strong>{t('returns.modal.refund_amount')}:</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right"><strong>{formatVenezuelanPrice(totalDevuelto)}</strong></Table.Summary.Cell>
                    </Table.Summary.Row>
                )}
            />

            {record.replacementItems && record.replacementItems.length > 0 && (
                <>
                    <Divider orientation={"left" as any}>{t('returns.modal.selected_replacement')}</Divider>
                    <Table
                        dataSource={record.replacementItems}
                        columns={replacementColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        summary={() => (
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={3} align="right"><strong>{t('returns.modal.replacement_total')}:</strong></Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right"><strong>{formatVenezuelanPrice(totalCambio)}</strong></Table.Summary.Cell>
                            </Table.Summary.Row>
                        )}
                    />

                    <div style={{ marginTop: 16, textAlign: 'right', padding: '12px', background: '#f5f5f5', borderRadius: 6 }}>
                        {difference > 0 ? (
                            <Text type="success" strong style={{ fontSize: 16 }}>
                                {t('returns.modal.balance_favor')} {formatVenezuelanPrice(difference)}
                            </Text>
                        ) : difference < 0 ? (
                            <Text type="danger" strong style={{ fontSize: 16 }}>
                                {t('returns.modal.balance_paid')} {formatVenezuelanPrice(Math.abs(difference))}
                            </Text>
                        ) : (
                            <Text type="secondary" strong style={{ fontSize: 16 }}>{t('returns.modal.even_exchange')}</Text>
                        )}
                    </div>
                </>
            )}

            {record.returnType === 'REFUND' && (
                <div style={{ marginTop: 16, textAlign: 'right', padding: '12px', background: '#f5f5f5', borderRadius: 6 }}>
                    <Text strong>{t('returns.modal.refunded_amount')}: {formatVenezuelanPrice(Number(record.refundAmount))}</Text>
                    <br />
                    <Text type="secondary">{t('returns.modal.method')}: {record.refundMethod}</Text>
                </div>
            )}
        </Modal>
    );
};
