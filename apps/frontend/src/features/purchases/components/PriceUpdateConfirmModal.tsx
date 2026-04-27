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

/**
 * PriceUpdateConfirmModal Component
 * Alerts the user when a purchase invoice contains cost changes for existing products.
 * Suggests automatic sale price adjustments based on historical profit margins.
 */
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
            title: 'Product',
            dataIndex: 'productName',
            key: 'name',
            width: '25%',
        },
        {
            title: 'Cost',
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
                        {(((record.newCost - record.oldCost) / (record.oldCost || 1)) * 100).toFixed(1)}%
                    </Tag>
                </Space>
            ),
        },
        {
            title: 'Retail Price',
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
                        {record.salePriceMargin.toFixed(0)}% Margin
                    </Tag>
                </Space>
            ),
        },
        {
            title: 'Offer Price',
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
                            {record.offerPriceMargin?.toFixed(0)}% Margin
                        </Tag>
                    </Space>
                );
            },
        },
        {
            title: 'Wholesale Price',
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
                            {record.wholesalePriceMargin?.toFixed(0)}% Margin
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
                        Price Change Detected
                    </Title>
                </Space>
            }
            open={visible}
            onOk={onConfirm}
            onCancel={onCancel}
            okText="Yes, update prices"
            cancelText="No, keep current prices"
            width={900}
            confirmLoading={loading}
        >
            <Alert
                message="Cost price changes detected for the following products"
                description="Would you like to automatically update sale prices using existing profit margins?"
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
                    <strong>Note:</strong> Suggested prices maintain the same margin percentage. 
                    If you select "No", sale prices will remain unchanged despite the increased cost.
                </Text>
            </div>
        </Modal>
    );
};
