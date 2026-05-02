import React from 'react';
import { Modal, Descriptions, Table, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    if (!purchase) return null;

    const columns = [
        {
            title: t('purchases.details.product'),
            dataIndex: ['product', 'name'],
            key: 'product',
        },
        {
            title: t('purchases.details.quantity'),
            dataIndex: 'quantity',
            key: 'quantity',
            align: 'right' as const,
        },
        {
            title: t('purchases.details.unit_cost'),
            dataIndex: 'cost',
            key: 'cost',
            align: 'right' as const,
            render: (cost: number) => `${purchase.currencyCode} ${formatVenezuelanPrice(cost)}`,
        },
        {
            title: t('purchases.details.total'),
            dataIndex: 'total',
            key: 'total',
            align: 'right' as const,
            render: (total: number) => `${purchase.currencyCode} ${formatVenezuelanPrice(total)}`,
        },
    ];

    return (
        <Modal
            title={t('purchases.details.title', { number: purchase.invoiceNumber || 'N/A' })}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={800}
        >
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label={t('purchases.details.invoice_date')}>
                    {dayjs(purchase.invoiceDate).format('MM/DD/YYYY')}
                </Descriptions.Item>
                <Descriptions.Item label={t('purchases.details.supplier')}>
                    {purchase.supplier?.comercialName || 'N/A'}
                </Descriptions.Item>
                <Descriptions.Item label={t('purchases.details.status')}>
                    <Tag color={purchase.status === 'COMPLETED' ? 'green' : 'orange'}>
                        {purchase.status === 'COMPLETED' ? t('purchases.completed') : purchase.status}
                    </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('purchases.details.currency')}>
                    {purchase.currencyCode} (Rate: {purchase.exchangeRate})
                </Descriptions.Item>
                <Descriptions.Item label={t('purchases.details.grand_total')} span={2}>
                    <strong>{purchase.currencyCode} {formatVenezuelanPrice(Number(purchase.total))}</strong>
                </Descriptions.Item>
            </Descriptions>

            <h3 style={{ marginTop: 24, marginBottom: 16 }}>{t('purchases.details.received_items')}</h3>
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
