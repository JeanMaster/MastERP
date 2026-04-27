import React from 'react';
import { Modal, Descriptions, Table, Tag, Typography, Divider, Button } from 'antd';
import dayjs from 'dayjs';
import type { PurchaseOrder } from '../../../services/purchaseOrdersApi';

interface PurchaseOrderDetailsModalProps {
    visible: boolean;
    order: PurchaseOrder | null;
    onClose: () => void;
}

/**
 * PurchaseOrderDetailsModal Component
 * Read-only view for a Purchase Order (PO).
 * Displays the list of products requested from a supplier, along with estimated costs and order status.
 */
export const PurchaseOrderDetailsModal: React.FC<PurchaseOrderDetailsModalProps> = ({ visible, order, onClose }) => {
    if (!order) return null;

    const columns = [
        { title: 'Product', dataIndex: ['product', 'name'], key: 'product' },
        { title: 'SKU', dataIndex: ['product', 'sku'], key: 'sku' },
        { title: 'Quantity', dataIndex: 'quantity', key: 'quantity' },
        {
            title: 'Est. Cost',
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
            title={`Purchase Order Details #${order.id.slice(0, 8)}`}
            open={visible}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="close" onClick={onClose}>Close</Button>
            ]}
        >
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="Supplier">{order.supplier.comercialName}</Descriptions.Item>
                <Descriptions.Item label="Tax ID (RIF)">{order.supplier.rif || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Order Date">{dayjs(order.orderDate).format('MM/DD/YYYY')}</Descriptions.Item>
                <Descriptions.Item label="Est. Delivery">{order.expectedDate ? dayjs(order.expectedDate).format('MM/DD/YYYY') : 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={order.status === 'COMPLETED' ? 'green' : 'orange'}>{order.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Currency">{order.currencyCode}</Descriptions.Item>
                <Descriptions.Item label="Notes" span={2}>{order.notes || 'No notes'}</Descriptions.Item>
            </Descriptions>

            <Divider orientation={"left" as any}>Items</Divider>

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
