import { Modal, Descriptions, Table, Tag, Typography, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface SaleDetailModalProps {
    open: boolean;
    sale: any;
    onCancel: () => void;
}

/**
 * SaleDetailModal Component
 * Displays a detailed read-only view of a specific sale record.
 * Shows customer info, payment breakdown, and an itemized list of sold products.
 */
export const SaleDetailModal = ({ open, sale, onCancel }: SaleDetailModalProps) => {
    const { t } = useTranslation();
    if (!sale) return null;

    /**
     * Renders a tag based on the payment method used.
     */
    const getPaymentMethodTag = (method: string) => {
        const colors: { [key: string]: string } = {
            'CASH': 'green',
            'DEBIT': 'blue',
            'CREDIT': 'orange',
            'TRANSFER': 'purple',
            'MOBILE': 'cyan'
        };
        return <Tag color={colors[method] || 'default'}>{method}</Tag>;
    };

    const itemColumns = [
        {
            title: t('sales_history.modal.product'),
            dataIndex: 'product',
            key: 'product',
            render: (product: any) => product.name
        },
        {
            title: t('sales_history.modal.qty'),
            dataIndex: 'quantity',
            key: 'quantity',
            align: 'right' as const
        },
        {
            title: t('sales_history.modal.unit_price'),
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            align: 'right' as const,
            render: (value: number) => formatVenezuelanPrice(value)
        },
        {
            title: t('sales_history.modal.total'),
            dataIndex: 'total',
            key: 'total',
            align: 'right' as const,
            render: (value: number) => formatVenezuelanPrice(value)
        }
    ];

    return (
        <Modal
            title={t('sales_history.modal.detail_title', { invoice: sale.invoiceNumber })}
            open={open}
            onCancel={onCancel}
            footer={null}
            width={800}
        >
            <Descriptions bordered column={2} size="small">
                <Descriptions.Item label={t('sales_history.modal.date')}>
                    {dayjs(sale.date).format('MM/DD/YYYY HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label={t('sales_history.modal.invoice')}>
                    <Text strong style={{ color: '#1890ff' }}>{sale.invoiceNumber}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('sales_history.modal.customer')}>
                    {sale.client?.name || t('sales_history.table.walk_in')}
                </Descriptions.Item>
                <Descriptions.Item label={t('sales_history.modal.payment_method')}>
                    {getPaymentMethodTag(sale.paymentMethod)}
                </Descriptions.Item>
                <Descriptions.Item label={t('sales_history.modal.subtotal')}>
                    {formatVenezuelanPrice(sale.subtotal)}
                </Descriptions.Item>
                <Descriptions.Item label={t('sales_history.modal.discount')}>
                    <Text type={sale.discount > 0 ? 'danger' : 'secondary'}>
                        {sale.discount > 0 ? `-${formatVenezuelanPrice(sale.discount)}` : '-'}
                    </Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('sales_history.modal.historical_rate')}>
                    <Text type="secondary">{Number(sale.exchangeRate || 1).toFixed(2)} Bs/$</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('sales_history.modal.paid_amt')}>
                    <Text strong>{formatVenezuelanPrice(sale.total)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('sales_history.modal.adjusted_total')} span={2}>
                    <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                        {formatVenezuelanPrice(sale.revaluedTotal ?? sale.total)}
                    </Title>
                </Descriptions.Item>
                <Descriptions.Item label={t('sales_history.modal.items_count')}>
                    <Tag color="blue">{sale.items?.length || 0}</Tag>
                </Descriptions.Item>
            </Descriptions>

            <Divider orientation={"left" as any}>{t('sales_history.modal.sold_products')}</Divider>

            <Table
                columns={itemColumns}
                dataSource={sale.items}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ y: 300 }}
            />

            <Divider />

            <Descriptions bordered column={2} size="small">
                <Descriptions.Item label={t('sales_history.modal.tendered')}>
                    {formatVenezuelanPrice(sale.tendered || 0)}
                </Descriptions.Item>
                <Descriptions.Item label={t('sales_history.modal.change')}>
                    {formatVenezuelanPrice(sale.change || 0)}
                </Descriptions.Item>
            </Descriptions>
        </Modal>
    );
};