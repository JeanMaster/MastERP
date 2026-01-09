import React from 'react';
import { Modal, Table, Typography, Space, Tag, Alert } from 'antd';
import { WarningOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface ProductWithCostChange {
    productId: string;
    productName: string;
    oldCost: number;
    newCost: number;
    currentSalePrice: number;
    currentOfferPrice?: number | null;
    currentWholesalePrice?: number | null;
    salePriceMargin: number;
    offerPriceMargin?: number | null;
    wholesalePriceMargin?: number | null;
    suggestedSalePrice: number;
    suggestedOfferPrice?: number | null;
    suggestedWholesalePrice?: number | null;
}

interface PriceUpdateConfirmModalProps {
    visible: boolean;
    products: ProductWithCostChange[];
    currencySymbol: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
}

export const PriceUpdateConfirmModal: React.FC<PriceUpdateConfirmModalProps> = ({
    visible,
    products,
    currencySymbol,
    onConfirm,
    onCancel,
    loading,
}) => {
    const columns = [
        {
            title: 'Producto',
            dataIndex: 'productName',
            key: 'name',
            width: '25%',
        },
        {
            title: 'Costo',
            key: 'cost',
            width: '20%',
            render: (_: any, record: ProductWithCostChange) => (
                <Space direction="vertical" size={0}>
                    <Text delete type="secondary" style={{ fontSize: 11 }}>
                        {currencySymbol} {record.oldCost.toFixed(2)}
                    </Text>
                    <Text strong style={{ color: '#1890ff' }}>
                        {currencySymbol} {record.newCost.toFixed(2)}
                    </Text>
                    <Tag color={record.newCost > record.oldCost ? 'red' : 'green'} style={{ fontSize: 10 }}>
                        {record.newCost > record.oldCost ? '+' : ''}
                        {(((record.newCost - record.oldCost) / record.oldCost) * 100).toFixed(1)}%
                    </Tag>
                </Space>
            ),
        },
        {
            title: 'Precio Normal',
            key: 'salePrice',
            width: '18%',
            render: (_: any, record: ProductWithCostChange) => (
                <Space direction="vertical" size={0}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                        {currencySymbol} {record.currentSalePrice.toFixed(2)}
                    </Text>
                    <Text strong style={{ color: '#52c41a' }}>
                        {currencySymbol} {record.suggestedSalePrice.toFixed(2)}
                    </Text>
                    <Tag color="blue" style={{ fontSize: 10 }}>
                        {record.salePriceMargin.toFixed(0)}%
                    </Tag>
                </Space>
            ),
        },
        {
            title: 'Precio Oferta',
            key: 'offerPrice',
            width: '18%',
            render: (_: any, record: ProductWithCostChange) => {
                if (!record.currentOfferPrice) return <Text type="secondary">-</Text>;
                return (
                    <Space direction="vertical" size={0}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {currencySymbol} {record.currentOfferPrice.toFixed(2)}
                        </Text>
                        <Text strong style={{ color: '#52c41a' }}>
                            {currencySymbol} {record.suggestedOfferPrice?.toFixed(2)}
                        </Text>
                        <Tag color="blue" style={{ fontSize: 10 }}>
                            {record.offerPriceMargin?.toFixed(0)}%
                        </Tag>
                    </Space>
                );
            },
        },
        {
            title: 'Precio Mayorista',
            key: 'wholesalePrice',
            width: '19%',
            render: (_: any, record: ProductWithCostChange) => {
                if (!record.currentWholesalePrice) return <Text type="secondary">-</Text>;
                return (
                    <Space direction="vertical" size={0}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {currencySymbol} {record.currentWholesalePrice.toFixed(2)}
                        </Text>
                        <Text strong style={{ color: '#52c41a' }}>
                            {currencySymbol} {record.suggestedWholesalePrice?.toFixed(2)}
                        </Text>
                        <Tag color="blue" style={{ fontSize: 10 }}>
                            {record.wholesalePriceMargin?.toFixed(0)}%
                        </Tag>
                    </Space>
                );
            },
        },
    ];

    return (
        <Modal
            title={
                <Space>
                    <WarningOutlined style={{ color: '#faad14', fontSize: 20 }} />
                    <Title level={4} style={{ margin: 0 }}>
                        Cambio de Precio Detectado
                    </Title>
                </Space>
            }
            open={visible}
            onOk={onConfirm}
            onCancel={onCancel}
            okText="Sí, actualizar precios"
            cancelText="No, mantener precios actuales"
            width={900}
            confirmLoading={loading}
        >
            <Alert
                message="Los siguientes productos tuvieron un cambio en su precio de costo"
                description="¿Desea actualizar automáticamente los precios de venta usando los mismos márgenes de ganancia?"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
            />

            <Table
                columns={columns}
                dataSource={products}
                rowKey="productId"
                pagination={false}
                size="small"
                scroll={{ y: 400 }}
            />

            <div style={{ marginTop: 16, padding: 12, background: '#f0f2f5', borderRadius: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    <strong>Nota:</strong> Los precios sugeridos mantienen el mismo porcentaje de margen que tenían anteriormente.
                    Si selecciona "No", los precios de venta permanecerán sin cambios.
                </Text>
            </div>
        </Modal>
    );
};
