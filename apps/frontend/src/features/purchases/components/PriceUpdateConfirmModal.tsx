import React, { useState, useEffect } from 'react';
import { Modal, Table, Typography, Space, Tag, Alert, Checkbox } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

export interface ProductWithCostChange {
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
    currencyId: string;
    currencyName?: string;
    oldCurrencyId: string;
    oldCurrencyName?: string;
}

export interface PriceUpdateSelection {
    productId: string;
    updateCost: boolean;
    updatePrice: boolean;
    updateCurrency: boolean;
}

interface PriceUpdateConfirmModalProps {
    visible: boolean;
    products: ProductWithCostChange[];
    currencySymbol: string;
    onConfirm: (selections: PriceUpdateSelection[]) => void;
    onCancel: () => void;
    loading?: boolean;
}

/**
 * PriceUpdateConfirmModal Component
 * Alerts the user when a purchase invoice contains cost changes for existing products.
 * Allows granular selection of Cost and Sale Price updates per product.
 */
export const PriceUpdateConfirmModal: React.FC<PriceUpdateConfirmModalProps> = ({
    visible,
    products,
    currencySymbol,
    onConfirm,
    onCancel,
    loading,
}) => {
    const { t } = useTranslation();
    const [selectedUpdates, setSelectedUpdates] = useState<Record<string, { updateCost: boolean, updatePrice: boolean, updateCurrency: boolean }>>({});

    // Initialize selections when modal opens
    useEffect(() => {
        if (visible && products.length > 0) {
            const initial: Record<string, { updateCost: boolean, updatePrice: boolean, updateCurrency: boolean }> = {};
            products.forEach(p => {
                const hasCurrencyChange = p.oldCurrencyId !== p.currencyId;
                initial[p.productId] = { 
                    updateCost: true, 
                    updatePrice: true, 
                    updateCurrency: hasCurrencyChange 
                };
            });
            setSelectedUpdates(initial);
        }
    }, [visible, products]);

    const handleToggle = (productId: string, field: 'updateCost' | 'updatePrice' | 'updateCurrency', checked: boolean) => {
        setSelectedUpdates(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [field]: checked
            }
        }));
    };

    const handleConfirm = () => {
        const selections = products.map(p => ({
            productId: p.productId,
            updateCost: selectedUpdates[p.productId]?.updateCost ?? false,
            updatePrice: selectedUpdates[p.productId]?.updatePrice ?? false,
            updateCurrency: selectedUpdates[p.productId]?.updateCurrency ?? false,
        }));
        onConfirm(selections);
    };

    const columns = [
        {
            title: t('common.product'),
            dataIndex: 'productName',
            key: 'name',
            width: '20%',
        },
        {
            title: t('common.currency', { defaultValue: 'Currency' }),
            key: 'currency',
            width: '15%',
            render: (_: any, record: ProductWithCostChange) => {
                const hasChange = record.oldCurrencyId !== record.currencyId;
                if (!hasChange) return <Text type="secondary">{record.currencyName}</Text>;
                
                return (
                    <Space direction="vertical" size={0}>
                        <Checkbox 
                            checked={selectedUpdates[record.productId]?.updateCurrency}
                            onChange={(e) => handleToggle(record.productId, 'updateCurrency', e.target.checked)}
                        >
                            <Text strong color={selectedUpdates[record.productId]?.updateCurrency ? '#1890ff' : 'inherit'}>
                                {record.currencyName}
                            </Text>
                        </Checkbox>
                        <div style={{ paddingLeft: 24 }}>
                            <Text delete type="secondary" style={{ fontSize: 11 }}>
                                {record.oldCurrencyName}
                            </Text>
                        </div>
                    </Space>
                );
            }
        },
        {
            title: t('common.cost'),
            key: 'cost',
            width: '18%',
            render: (_: any, record: ProductWithCostChange) => (
                <Space direction="vertical" size={0}>
                    <Checkbox 
                        checked={selectedUpdates[record.productId]?.updateCost}
                        onChange={(e) => handleToggle(record.productId, 'updateCost', e.target.checked)}
                    >
                        <Text strong style={{ color: selectedUpdates[record.productId]?.updateCost ? '#1890ff' : 'inherit' }}>
                            {currencySymbol} {record.newCost.toFixed(2)}
                        </Text>
                    </Checkbox>
                    <div style={{ paddingLeft: 24 }}>
                        <Text delete type="secondary" style={{ fontSize: 11 }}>
                            {currencySymbol} {record.oldCost.toFixed(2)}
                        </Text>
                        <br />
                        <Tag color={record.newCost > record.oldCost ? 'red' : 'green'} style={{ fontSize: 10, marginTop: 4 }}>
                            {record.newCost > record.oldCost ? '+' : ''}
                            {(((record.newCost - record.oldCost) / (record.oldCost || 1)) * 100).toFixed(1)}%
                        </Tag>
                    </div>
                </Space>
            ),
        },
        {
            title: t('common.sale_price'),
            key: 'salePrice',
            width: '16%',
            render: (_: any, record: ProductWithCostChange) => (
                <Space direction="vertical" size={0}>
                    <Checkbox 
                        checked={selectedUpdates[record.productId]?.updatePrice}
                        onChange={(e) => handleToggle(record.productId, 'updatePrice', e.target.checked)}
                    >
                        <Text strong style={{ color: selectedUpdates[record.productId]?.updatePrice ? '#52c41a' : 'inherit' }}>
                            {currencySymbol} {record.suggestedSalePrice.toFixed(2)}
                        </Text>
                    </Checkbox>
                    <div style={{ paddingLeft: 24 }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {currencySymbol} {record.currentSalePrice.toFixed(2)}
                        </Text>
                        <br />
                        <Tag color="blue" style={{ fontSize: 10, marginTop: 4 }}>
                            {record.salePriceMargin.toFixed(0)}% {t('common.margin')}
                        </Tag>
                    </div>
                </Space>
            ),
        },
        {
            title: t('products.finished.offer'),
            key: 'offerPrice',
            width: '15%',
            render: (_: any, record: ProductWithCostChange) => {
                if (!record.currentOfferPrice) return <Text type="secondary">-</Text>;
                return (
                    <Space direction="vertical" size={0} style={{ paddingLeft: 24 }}>
                        <Text strong style={{ color: selectedUpdates[record.productId]?.updatePrice ? '#52c41a' : 'inherit' }}>
                            {currencySymbol} {record.suggestedOfferPrice?.toFixed(2)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {currencySymbol} {record.currentOfferPrice.toFixed(2)}
                        </Text>
                        <Tag color="blue" style={{ fontSize: 10 }}>
                            {record.offerPriceMargin?.toFixed(0)}% {t('common.margin')}
                        </Tag>
                    </Space>
                );
            },
        },
        {
            title: t('products.finished.wholesale'),
            key: 'wholesalePrice',
            width: '16%',
            render: (_: any, record: ProductWithCostChange) => {
                if (!record.currentWholesalePrice) return <Text type="secondary">-</Text>;
                return (
                    <Space direction="vertical" size={0} style={{ paddingLeft: 24 }}>
                        <Text strong style={{ color: selectedUpdates[record.productId]?.updatePrice ? '#52c41a' : 'inherit' }}>
                            {currencySymbol} {record.suggestedWholesalePrice?.toFixed(2)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                            {currencySymbol} {record.currentWholesalePrice.toFixed(2)}
                        </Text>
                        <Tag color="blue" style={{ fontSize: 10 }}>
                            {record.wholesalePriceMargin?.toFixed(0)}% {t('common.margin')}
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
                        {t('purchases.price_change_modal.title', { defaultValue: 'Price Change Detected' })}
                    </Title>
                </Space>
            }
            open={visible}
            onOk={handleConfirm}
            onCancel={onCancel}
            okText={t('purchases.price_change_modal.ok_text', { defaultValue: 'Update Selected' })}
            cancelText={t('purchases.price_change_modal.cancel_text', { defaultValue: 'Discard Changes' })}
            width={1050}
            confirmLoading={loading}
        >
            <Alert
                message={t('purchases.price_change_modal.alert_message', { defaultValue: 'Cost price changes detected for the following products' })}
                description={t('purchases.price_change_modal.alert_desc', { defaultValue: 'Select which updates you would like to apply. Suggested prices maintain the existing profit margin percentage.' })}
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
                    <strong>{t('common.notes')}:</strong> {t('purchases.price_change_modal.note', { defaultValue: 'If you update the cost but not the sale price, the profit margin will decrease. If you update the sale price, it will be adjusted based on the new cost to maintain the margin percentage.' })}
                </Text>
            </div>
        </Modal>
    );
};

