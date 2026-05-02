import React from 'react';
import { Modal, Descriptions, Table, Tag, Typography, Divider, Button } from 'antd';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();

    if (!order) return null;

    const statusMap: Record<string, { color: string; label: string }> = {
        COMPLETED: { color: 'green', label: t('purchase_orders.status_received') },
        CANCELLED: { color: 'red',   label: t('purchase_orders.status_cancelled') },
        PENDING:   { color: 'blue',   label: t('purchase_orders.status_pending') },
    };
    const statusInfo = statusMap[order.status] || { color: 'orange', label: order.status };

    const columns = [
        { title: t('common.product'), dataIndex: ['product', 'name'], key: 'product' },
        { title: t('common.sku'), dataIndex: ['product', 'sku'], key: 'sku' },
        { title: t('common.quantity'), dataIndex: 'quantity', key: 'quantity' },
        {
            title: t('purchase_orders.est_cost'),
            dataIndex: 'cost',
            key: 'cost',
            render: (cost: number) => `${order.currencyCode} ${Number(cost).toFixed(2)}`
        },
        {
            title: t('common.total'),
            dataIndex: 'total',
            key: 'total',
            render: (total: number) => `${order.currencyCode} ${Number(total).toFixed(2)}`
        },
    ];

    return (
        <Modal
            title={`${t('purchase_orders.details_title')} #${order.id.slice(0, 8)}`}
            open={visible}
            onCancel={onClose}
            width={800}
            footer={[
                <Button key="close" onClick={onClose}>{t('common.close')}</Button>
            ]}
        >
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label={t('common.supplier')}>{order.supplier.comercialName}</Descriptions.Item>
                <Descriptions.Item label={t('common.rif')}>{order.supplier.rif || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label={t('common.order_date')}>{dayjs(order.orderDate).format('DD/MM/YYYY')}</Descriptions.Item>
                <Descriptions.Item label={t('purchase_orders.est_delivery')}>{order.expectedDate ? dayjs(order.expectedDate).format('DD/MM/YYYY') : 'N/A'}</Descriptions.Item>
                <Descriptions.Item label={t('common.status')}>
                    <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('common.currency')}>{order.currencyCode}</Descriptions.Item>
                <Descriptions.Item label={t('common.notes')} span={2}>{order.notes || t('purchase_orders.no_notes')}</Descriptions.Item>
            </Descriptions>

            <Divider orientation={"left" as any}>{t('common.items')}</Divider>

            <Table
                dataSource={order.items}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                summary={() => (
                    <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={4} align="right">
                            <Typography.Text strong>{t('common.total').toUpperCase()}</Typography.Text>
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
