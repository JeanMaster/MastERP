import { Modal, Descriptions, Table, Tag, Typography, Divider } from 'antd';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Text } = Typography;

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
    if (!record) return null;

    const getTypeTag = (type: string) => {
        const labels: Record<string, string> = {
            REFUND: 'Refund',
            EXCHANGE_SAME: 'Direct Exchange',
            EXCHANGE_DIFFERENT: 'Product Swap'
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
            PENDING: 'Pending',
            APPROVED: 'Approved',
            REJECTED: 'Rejected',
            COMPLETED: 'Completed'
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
            title: 'Product',
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
            title: 'Qty',
            dataIndex: 'quantity',
            key: 'quantity',
            width: 80,
            render: (qty: any) => Number(qty)
        },
        {
            title: 'Unit Price',
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            align: 'right' as const,
            render: (val: any) => formatVenezuelanPrice(Number(val))
        },
        {
            title: 'Total',
            dataIndex: 'total',
            key: 'total',
            align: 'right' as const,
            render: (val: any) => formatVenezuelanPrice(Number(val))
        }
    ];

    const replacementColumns = [
        ...itemsColumns.filter(col => col.key !== 'unitPrice'),
        {
            title: 'Replacement Price',
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
            title={`Return Details: ${record.creditNoteNumber}`}
            open={open}
            onCancel={onClose}
            footer={null}
            width={800}
        >
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="Original Invoice">{record.originalSale?.invoiceNumber}</Descriptions.Item>
                <Descriptions.Item label="Date Created">{dayjs(record.createdAt).format('MM/DD/YYYY HH:mm')}</Descriptions.Item>
                <Descriptions.Item label="Customer">{record.originalSale?.client?.name || 'Walk-in'}</Descriptions.Item>
                <Descriptions.Item label="Type">{getTypeTag(record.returnType)}</Descriptions.Item>
                <Descriptions.Item label="Status">{getStatusTag(record.status)}</Descriptions.Item>
                <Descriptions.Item label="Requested By">{record.requestedBy || '-'}</Descriptions.Item>
                <Descriptions.Item label="Reason & Notes" span={2}>
                    <Tag>{record.reason}</Tag> {record.notes || 'No additional notes provided'}
                </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Returned Items</Divider>
            <Table
                dataSource={record.items || []}
                columns={itemsColumns}
                rowKey="id"
                pagination={false}
                size="small"
                summary={() => (
                    <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={3} align="right"><strong>Returned Total:</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right"><strong>{formatVenezuelanPrice(totalDevuelto)}</strong></Table.Summary.Cell>
                    </Table.Summary.Row>
                )}
            />

            {record.replacementItems && record.replacementItems.length > 0 && (
                <>
                    <Divider orientation="left">Replacement Items (Exchange)</Divider>
                    <Table
                        dataSource={record.replacementItems}
                        columns={replacementColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        summary={() => (
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={3} align="right"><strong>Replacement Total:</strong></Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right"><strong>{formatVenezuelanPrice(totalCambio)}</strong></Table.Summary.Cell>
                            </Table.Summary.Row>
                        )}
                    />

                    <div style={{ marginTop: 16, textAlign: 'right', padding: '12px', background: '#f5f5f5', borderRadius: 6 }}>
                        {difference > 0 ? (
                            <Text type="success" strong style={{ fontSize: 16 }}>
                                Balance in favor of Customer: {formatVenezuelanPrice(difference)}
                            </Text>
                        ) : difference < 0 ? (
                            <Text type="danger" strong style={{ fontSize: 16 }}>
                                Customer pays difference: {formatVenezuelanPrice(Math.abs(difference))}
                            </Text>
                        ) : (
                            <Text type="secondary" strong style={{ fontSize: 16 }}>Even exchange (0.00 difference)</Text>
                        )}
                    </div>
                </>
            )}

            {record.returnType === 'REFUND' && (
                <div style={{ marginTop: 16, textAlign: 'right', padding: '12px', background: '#f5f5f5', borderRadius: 6 }}>
                    <Text strong>Refunded Amount: {formatVenezuelanPrice(Number(record.refundAmount))}</Text>
                    <br />
                    <Text type="secondary">Method: {record.refundMethod}</Text>
                </div>
            )}
        </Modal>
    );
};
