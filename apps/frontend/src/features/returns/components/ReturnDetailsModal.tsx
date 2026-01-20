import { Modal, Descriptions, Table, Tag, Typography, Divider } from 'antd';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Text } = Typography;

interface ReturnDetailsModalProps {
    open: boolean;
    onClose: () => void;
    record: any;
}

export const ReturnDetailsModal = ({ open, onClose, record }: ReturnDetailsModalProps) => {
    if (!record) return null;

    const getTypeTag = (type: string) => {
        const labels: Record<string, string> = {
            REFUND: 'Reembolso',
            EXCHANGE_SAME: 'Cambio Mismo Producto',
            EXCHANGE_DIFFERENT: 'Cambio Producto Diferente'
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
            PENDING: 'Pendiente',
            APPROVED: 'Aprobada',
            REJECTED: 'Rechazada',
            COMPLETED: 'Completada'
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
            title: 'Producto',
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
            title: 'Cant.',
            dataIndex: 'quantity',
            key: 'quantity',
            width: 80,
            render: (qty: any) => Number(qty)
        },
        {
            title: 'Precio Unit.',
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
        {
            title: 'Producto',
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
            title: 'Cant.',
            dataIndex: 'quantity',
            key: 'quantity',
            width: 80,
            render: (qty: any) => Number(qty)
        },
        {
            title: 'Precio (Bs)',
            dataIndex: 'unitPrice', // This is the converted price
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

    const totalDevuelto = record.items?.reduce((sum: number, i: any) => sum + Number(i.total), 0) || 0;
    const totalCambio = record.replacementItems?.reduce((sum: number, i: any) => sum + Number(i.total), 0) || 0;
    const difference = totalDevuelto - totalCambio;

    return (
        <Modal
            title={`Detalle de Devolución: ${record.creditNoteNumber}`}
            open={open}
            onCancel={onClose}
            footer={null}
            width={800}
        >
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="Factura Original">{record.originalSale?.invoiceNumber}</Descriptions.Item>
                <Descriptions.Item label="Fecha">{dayjs(record.createdAt).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
                <Descriptions.Item label="Cliente">{record.originalSale?.client?.name || 'General'}</Descriptions.Item>
                <Descriptions.Item label="Tipo">{getTypeTag(record.returnType)}</Descriptions.Item>
                <Descriptions.Item label="Estado">{getStatusTag(record.status)}</Descriptions.Item>
                <Descriptions.Item label="Creado por">{record.requestedBy || '-'}</Descriptions.Item>
                <Descriptions.Item label="Razón" span={2}>
                    {record.reason} - {record.notes || 'Sin notas adicionales'}
                </Descriptions.Item>
            </Descriptions>

            <Divider>Items Devueltos</Divider>
            <Table
                dataSource={record.items || []}
                columns={itemsColumns}
                rowKey="id"
                pagination={false}
                size="small"
                summary={() => (
                    <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={3} align="right"><strong>Total Devuelto:</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right"><strong>{formatVenezuelanPrice(totalDevuelto)}</strong></Table.Summary.Cell>
                    </Table.Summary.Row>
                )}
            />

            {record.replacementItems && record.replacementItems.length > 0 && (
                <>
                    <Divider>Items de Reemplazo (Cambio)</Divider>
                    <Table
                        dataSource={record.replacementItems}
                        columns={replacementColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                        summary={() => (
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={3} align="right"><strong>Total Cambio:</strong></Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right"><strong>{formatVenezuelanPrice(totalCambio)}</strong></Table.Summary.Cell>
                            </Table.Summary.Row>
                        )}
                    />

                    <div style={{ marginTop: 16, textAlign: 'right', padding: '12px', background: '#f5f5f5', borderRadius: 6 }}>
                        {difference > 0 ? (
                            <Text type="success" strong style={{ fontSize: 16 }}>
                                A favor del cliente: {formatVenezuelanPrice(difference)}
                            </Text>
                        ) : difference < 0 ? (
                            <Text type="danger" strong style={{ fontSize: 16 }}>
                                Cliente paga diferencia: {formatVenezuelanPrice(Math.abs(difference))}
                            </Text>
                        ) : (
                            <Text type="secondary" strong style={{ fontSize: 16 }}>Cambio sin diferencia (0.00 Bs)</Text>
                        )}
                    </div>
                </>
            )}

            {record.returnType === 'REFUND' && (
                <div style={{ marginTop: 16, textAlign: 'right', padding: '12px', background: '#f5f5f5', borderRadius: 6 }}>
                    <Text strong>Monto Reembolsado: {formatVenezuelanPrice(Number(record.refundAmount))}</Text>
                    <br />
                    <Text type="secondary">Método: {record.refundMethod}</Text>
                </div>
            )}
        </Modal>
    );
};
