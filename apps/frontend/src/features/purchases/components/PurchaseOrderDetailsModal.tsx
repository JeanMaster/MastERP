import React from 'react';
import { Modal, Descriptions, Table, Tag, Typography, Divider, Button } from 'antd';
import dayjs from 'dayjs';
import type { PurchaseOrder } from '../../../services/purchaseOrdersApi';

interface PurchaseOrderDetailsModalProps {
    visible: boolean;
    order: PurchaseOrder | null;
    onClose: () => void;
}

export const PurchaseOrderDetailsModal: React.FC<PurchaseOrderDetailsModalProps> = ({ visible, order, onClose }) => {
    if (!order) return null;

    const columns = [
        { title: 'Producto', dataIndex: ['product', 'name'], key: 'product' },
        { title: 'SKU', dataIndex: ['product', 'sku'], key: 'sku' },
        { title: 'Cantidad', dataIndex: 'quantity', key: 'quantity' },
        {
            title: 'Costo Est.',
            dataIndex: 'cost',
            key: 'cost',
            render: (cost: number) => `${order.currencyCode} ${Number(cost).toFixed(2)}`
        },
        {
            title: 'Total',
            dataIndex: 'total',
            key: 'total',
            render: (total: number) => `${order.currencyCode} ${Number(total).toFixed(2)}`
        },
    ];

    return (
        <Modal
            title={`Detalles del Pedido #${order.id.slice(0, 8)}`}
            open={visible}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="close" onClick={onClose}>Cerrar</Button>
            ]}
        >
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="Proveedor">{order.supplier.comercialName}</Descriptions.Item>
                <Descriptions.Item label="RIF">{order.supplier.rif || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Fecha">{dayjs(order.orderDate).format('DD/MM/YYYY')}</Descriptions.Item>
                <Descriptions.Item label="Entrega Est.">{order.expectedDate ? dayjs(order.expectedDate).format('DD/MM/YYYY') : 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Estado">
                    <Tag color={order.status === 'COMPLETED' ? 'green' : 'orange'}>{order.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Moneda">{order.currencyCode}</Descriptions.Item>
                <Descriptions.Item label="Notas" span={2}>{order.notes || 'Sin notas'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation={"left" as any}>Artículos</Divider>

            <Table
                dataSource={order.items}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                summary={() => (
                    <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={4} align="right">
                            <Typography.Text strong>TOTAL</Typography.Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1}>
                            <Typography.Text strong>{order.currencyCode} {Number(order.total).toFixed(2)}</Typography.Text>
                        </Table.Summary.Cell>
                    </Table.Summary.Row>
                )}
            />
        </Modal>
    );
};
