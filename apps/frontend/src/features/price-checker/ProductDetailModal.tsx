import React from 'react';
import { Modal, Typography, Row, Col, Descriptions, Button, Tag, Image, Divider } from 'antd';
import type { Product } from '../../services/productsApi';
import { formatVenezuelanPrice } from '../../utils/formatters';
import { getRoundedPrice } from '../../utils/rounding';

const { Title, Text } = Typography;

interface ProductDetailModalProps {
    visible: boolean;
    onClose: () => void;
    product: Product | null;
    companySettings?: any;
}

/**
 * ProductDetailModal Component
 * Immersive detailed view for a single product. 
 * Shows large price highlights, stock status, and category metadata.
 */
export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ visible, onClose, product, companySettings }) => {
    if (!product) return null;

    /**
     * Re-calculates finalized prices for the detailed view.
     */
    const getDualPrices = () => {
        const primarySymbol = 'Bs';
        const secondarySymbol = companySettings?.preferredSecondaryCurrency?.symbol || '$';
        const secondaryRate = Number(companySettings?.preferredSecondaryCurrency?.exchangeRate) || 0;

        let priceInPrimary = product.salePrice;

        // 1. Currency Conversion
        if (product.currency && !product.currency.isPrimary) {
            const prodRate = Number(product.currency.exchangeRate) || 1;
            priceInPrimary = product.salePrice * prodRate;
        }

        // 2. Tax Application
        if (companySettings?.taxEnabled && !product.isTaxExempt) {
            const taxRate = Number(companySettings.taxRate) || 16;
            priceInPrimary = priceInPrimary * (1 + taxRate / 100);
        }

        // 3. POS Rounding
        const roundingEnabled = companySettings?.roundingEnabled !== undefined ? companySettings.roundingEnabled : true;
        const roundingFactor = companySettings?.roundingFactor || 10;
        priceInPrimary = getRoundedPrice(priceInPrimary, roundingFactor, roundingEnabled);

        // 4. Secondary View
        let priceInSecondary = 0;
        if (secondaryRate > 0) {
            priceInSecondary = priceInPrimary / secondaryRate;
        }

        return {
            primary: priceInPrimary,
            primarySymbol,
            secondary: priceInSecondary,
            secondarySymbol
        };
    };

    const { primary, primarySymbol, secondary, secondarySymbol } = getDualPrices();

    return (
        <Modal
            open={visible}
            onCancel={onClose}
            footer={[
                <Button key="close" type="primary" size="large" onClick={onClose} style={{ width: '100%', height: '60px', fontSize: '20px', borderRadius: '12px' }}>
                    Close Details
                </Button>
            ]}
            width={850}
            centered
            className="price-checker-modal"
            styles={{ body: { padding: '32px' } }}
        >
            <Row gutter={[32, 32]} align="middle">
                <Col xs={24} md={12} style={{ textAlign: 'center' }}>
                    <Image
                        width="100%"
                        src={(product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/450x450?text=No+Image+Available'}
                        alt={product.name}
                        style={{ objectFit: 'contain', maxHeight: '420px', borderRadius: '16px', border: '1px solid #f1f5f9' }}
                        fallback="https://via.placeholder.com/450x450?text=Error+Loading+Image"
                    />
                </Col>
                <Col xs={24} md={12}>
                    <Title level={2} style={{ marginBottom: 4, lineHeight: 1.1, fontWeight: 800 }}>{product.name}</Title>
                    <Text type="secondary" style={{ fontSize: '18px', fontWeight: 500 }}>SKU: {product.sku}</Text>

                    <Divider style={{ margin: '20px 0' }} />

                    <div style={{ marginBottom: 24, textAlign: 'center', background: '#f0fdf4', padding: '24px', borderRadius: '20px', border: '1px solid #dcfce7' }}>
                        <Text strong style={{ fontSize: '16px', display: 'block', color: '#16a34a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '1px' }}>Retail Price</Text>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            {/* Main Price Tag */}
                            <Title level={1} style={{ margin: 0, color: '#15803d', fontSize: '56px', fontWeight: 900 }}>
                                {formatVenezuelanPrice(primary, primarySymbol)}
                            </Title>
                            
                            {companySettings?.taxEnabled && (
                                <Tag color={product.isTaxExempt ? 'default' : 'success'} style={{ fontSize: '15px', padding: '2px 12px', borderRadius: '6px' }}>
                                    {product.isTaxExempt ? 'TAX EXEMPT' : 'VAT INCLUDED'}
                                </Tag>
                            )}

                            {secondary > 0 && (
                                <Text style={{ fontSize: '24px', color: '#64748b', marginTop: 8, fontWeight: 600 }}>
                                    Reference: {secondarySymbol} {secondary.toFixed(2)}
                                </Text>
                            )}
                        </div>
                    </div>

                    <Descriptions column={1} size="large" bordered style={{ borderRadius: '12px', overflow: 'hidden' }}>
                        <Descriptions.Item label="Category" labelStyle={{ fontWeight: 600, width: '120px' }}>
                            {product.category?.name || 'Uncategorized'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Availability" labelStyle={{ fontWeight: 600 }}>
                            {product.stock > 0 ? (
                                <Tag color="success" style={{ fontSize: '16px', padding: '4px 12px', borderRadius: '6px' }}>
                                    In Stock ({product.stock})
                                </Tag>
                            ) : (
                                <Tag color="error" style={{ fontSize: '16px', padding: '4px 12px', borderRadius: '6px' }}>Out of Stock</Tag>
                            )}
                        </Descriptions.Item>
                        {product.description && (
                            <Descriptions.Item label="Details" labelStyle={{ fontWeight: 600 }}>
                                {product.description}
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                </Col>
            </Row>
        </Modal>
    );
};
