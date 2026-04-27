import React from 'react';
import { Modal, Descriptions, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import type { Purchase } from '../../../services/purchasesApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';

interface PurchaseDetailsModalProps {
    visible: boolean;
    purchase: Purchase | null;
    onClose: () => void;
}

/**
 * PurchaseDetailsModal Component
 * Displays a detailed read-only view of a completed inventory purchase (Inbound Invoice).
 * Shows supplier info, financial summary, and an itemized list of products received.
 */
export const PurchaseDetailsModal: React.FC<PurchaseDetailsModalProps> = ({
    visible,
    purchase,
    onClose
}) => {
    if (!purchase) return null;

    const columns = [
        {
            title: 'Product',
            dataIndex: ['product', 'name'],
            key: 'product',
        },
        {
            title: 'Quantity',
            dataIndex: 'quantity',
            key: 'quantity',
            align: 'right' as const,
        },
        {
            title: 'Unit Cost',
            dataIndex: 'cost',
            key: 'cost',
            align: 'right' as const,
            render: (cost: number) => `${purchase.currencyCode} ${formatVenezuelanPrice(cost)}`,
        },
        {
            title: 'Total',
            dataIndex: 'total',
            key: 'total',
            align: 'right' as const,
            render: (total: number) => `${purchase.currencyCode} ${formatVenezuelanPrice(total)}`,
        },
    ];

    return (
        <Modal
            title={`Purchase Details - Invoice #${purchase.invoiceNumber || 'N/A'}`}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={800}
        >
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="Invoice Date">
                    {dayjs(purchase.invoiceDate).format('MM/DD/YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label="Supplier">
                    {purchase.supplier?.comercialName || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                    <Tag color={purchase.status === 'COMPLETED' ? 'green' : 'orange'}>
                        {purchase.status === 'COMPLETED' ? 'Completed' : purchase.status}
                    </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Currency">
                    {purchase.currencyCode} (Rate: {purchase.exchangeRate})
                </Descriptions.Item>
                <Descriptions.Item label="Grand Total" span={2}>
                    <strong>{purchase.currencyCode} {formatVenezuelanPrice(Number(purchase.total))}</strong>
                </Descriptions.Item>
            </Descriptions>

            <h3 style={{ marginTop: 24, marginBottom: 16 }}>Received Items</h3>
            <Table
                dataSource={purchase.items}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
            />
        </Modal>
    );
};
