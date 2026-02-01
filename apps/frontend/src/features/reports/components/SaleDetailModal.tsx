import { Modal, Descriptions, Table, Tag, Typography, Divider } from 'antd';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface SaleDetailModalProps {
    open: boolean;
    sale: any;
    onCancel: () => void;
}

export const SaleDetailModal = ({ open, sale, onCancel }: SaleDetailModalProps) => {
    if (!sale) return null;

    // Calculate payment method tags
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

    // Calculate product columns for items table
    const itemColumns = [
        {
            title: 'Producto',
            dataIndex: 'product',
            key: 'product',
            render: (product: any) => product.name
        },
        {
            title: 'Cantidad',
            dataIndex: 'quantity',
            key: 'quantity',
            align: 'right' as const
        },
        {
            title: 'Precio Unitario',
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
            title={`Detalle de Venta - Factura: ${sale.invoiceNumber}`}
            open={open}
            onCancel={onCancel}
            footer={null}
            width={800}
        >
            <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Fecha">
                    {dayjs(sale.date).format('DD/MM/YYYY HH:mm:ss')}
                </Descriptions.Item>
                <Descriptions.Item label="Factura">
                    <Text strong style={{ color: '#1890ff' }}>{sale.invoiceNumber}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Cliente">
                    {sale.client?.name || 'Cliente General'}
                </Descriptions.Item>
                <Descriptions.Item label="Forma de Pago">
                    {getPaymentMethodTag(sale.paymentMethod)}
                </Descriptions.Item>
                <Descriptions.Item label="Subtotal">
                    {formatVenezuelanPrice(sale.subtotal)}
                </Descriptions.Item>
                <Descriptions.Item label="Descuento">
                    <Text type={sale.discount > 0 ? 'danger' : 'secondary'}>
                        {sale.discount > 0 ? `-${formatVenezuelanPrice(sale.discount)}` : '-'}
                    </Text>
                </Descriptions.Item>
                <Descriptions.Item label="Tasa Histórica">
                    <Text type="secondary">{Number(sale.exchangeRate || 1).toFixed(2)} Bs/$</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Monto Pagado (Nominal)">
                    <Text strong>{formatVenezuelanPrice(sale.total)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Total Ajustado (Inflación)" span={2}>
                    <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                        {formatVenezuelanPrice(sale.revaluedTotal ?? sale.total)}
                    </Title>
                </Descriptions.Item>
                <Descriptions.Item label="Items">
                    <Tag color="blue">{sale.items?.length || 0}</Tag>
                </Descriptions.Item>
            </Descriptions>

            <Divider>Productos Vendidos</Divider>

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
                <Descriptions.Item label="Monto Recibido">
                    {formatVenezuelanPrice(sale.tendered || 0)}
                </Descriptions.Item>
                <Descriptions.Item label="Cambio">
                    {formatVenezuelanPrice(sale.change || 0)}
                </Descriptions.Item>
            </Descriptions>
        </Modal>
    );
};