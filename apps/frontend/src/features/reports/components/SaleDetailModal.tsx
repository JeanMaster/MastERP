import { Modal, Descriptions, Table, Tag, Typography, Divider } from 'antd';
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
            title: 'Product',
            dataIndex: 'product',
            key: 'product',
            render: (product: any) => product.name
        },
        {
            title: 'Qty',
            dataIndex: 'quantity',
            key: 'quantity',
            align: 'right' as const
        },
        {
            title: 'Unit Price',
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            align: 'right' as const,
            render: (value: number) => formatVenezuelanPrice(value)
        },
        {
            title: 'Total',
            dataIndex: 'total',
            key: 'total',
            align: 'right' as const,
            render: (value: number) => formatVenezuelanPrice(value)
        }
    ];

    return (
        <Modal
            title={`Sale Detail - Invoice: ${sale.invoiceNumber}`}
            open={open}
            onCancel={onCancel}
            footer={null}
            width={800}
        >
            <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Date">
                    {dayjs(sale.date).format('MM/DD/YYYY HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="Invoice #">
                    <Text strong style={{ color: '#1890ff' }}>{sale.invoiceNumber}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Customer">
                    {sale.client?.name || 'Walk-in Customer'}
                </Descriptions.Item>
                <Descriptions.Item label="Payment Method">
                    {getPaymentMethodTag(sale.paymentMethod)}
                </Descriptions.Item>
                <Descriptions.Item label="Subtotal">
                    {formatVenezuelanPrice(sale.subtotal)}
                </Descriptions.Item>
                <Descriptions.Item label="Discount">
                    <Text type={sale.discount > 0 ? 'danger' : 'secondary'}>
                        {sale.discount > 0 ? `-${formatVenezuelanPrice(sale.discount)}` : '-'}
                    </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Historical Rate">
                    <Text type="secondary">{Number(sale.exchangeRate || 1).toFixed(2)} Bs/$</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Amount Paid (Nominal)">
                    <Text strong>{formatVenezuelanPrice(sale.total)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Inflation Adjusted Total" span={2}>
                    <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                        {formatVenezuelanPrice(sale.revaluedTotal ?? sale.total)}
                    </Title>
                </Descriptions.Item>
                <Descriptions.Item label="Items Count">
                    <Tag color="blue">{sale.items?.length || 0}</Tag>
                </Descriptions.Item>
            </Descriptions>

            <Divider orientation={"left" as any}>Sold Products</Divider>

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
                <Descriptions.Item label="Tendered Amount">
                    {formatVenezuelanPrice(sale.tendered || 0)}
                </Descriptions.Item>
                <Descriptions.Item label="Change Provided">
                    {formatVenezuelanPrice(sale.change || 0)}
                </Descriptions.Item>
            </Descriptions>
        </Modal>
    );
};