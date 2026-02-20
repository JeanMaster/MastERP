import React from 'react';
import { Modal, Typography, Row, Col, Descriptions, Button, Tag, Image, Divider } from 'antd';
import type { Product } from '../../services/productsApi';
import { formatVenezuelanPrice } from '../../utils/formatters';

const { Title, Text } = Typography;

interface ProductDetailModalProps {
    visible: boolean;
    onClose: () => void;
    product: Product | null;
    companySettings?: any;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ visible, onClose, product, companySettings }) => {
    if (!product) return null;

    // Price Logic (Duplicated from Page for simplicity, updated to handle offer)
    const getDualPrices = () => {
        const primarySymbol = 'Bs';
        const secondarySymbol = companySettings?.preferredSecondaryCurrency?.symbol || '$';
        const secondaryRate = Number(companySettings?.preferredSecondaryCurrency?.exchangeRate) || 0;

        let priceInPrimary = product.salePrice;

        // Convert to Primary if stored in foreign (e.g. USDT -> Bs)
        if (product.currency && !product.currency.isPrimary) {
            const prodRate = Number(product.currency.exchangeRate) || 1;
            priceInPrimary = product.salePrice * prodRate;
        }

        // Apply POS Rounding Logic: Ceil to nearest 10
        priceInPrimary = Math.ceil(priceInPrimary / 10) * 10;

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
                <Button key="close" type="primary" size="large" onClick={onClose} style={{ width: '100%', height: '50px', fontSize: '18px' }}>
                    Cerrar
                </Button>
            ]}
            width={800}
            centered
            className="price-checker-modal"
            styles={{ body: { padding: '24px' } }}
        >
            <Row gutter={[24, 24]} align="middle">
                <Col xs={24} md={12} style={{ textAlign: 'center' }}>
                    <Image
                        width="100%"
                        src={(product.images && product.images.length > 0) ? product.images[0] : 'https://via.placeholder.com/400x400?text=Sin+Imagen'}
                        alt={product.name}
                        style={{ objectFit: 'contain', maxHeight: '400px', borderRadius: '8px' }}
                        fallback="https://via.placeholder.com/400x400?text=Error+Carga"
                    />
                </Col>
                <Col xs={24} md={12}>
                    <Title level={2} style={{ marginBottom: 8, lineHeight: 1.2 }}>{product.name}</Title>
                    <Text type="secondary" style={{ fontSize: '18px' }}>SKU: {product.sku}</Text>

                    <Divider />

                    <div style={{ marginBottom: 24, textAlign: 'center', background: '#f6ffed', padding: '20px', borderRadius: '12px', border: '1px solid #b7eb8f' }}>
                        <Text style={{ fontSize: '18px', display: 'block', color: '#52c41a', marginBottom: 4 }}>Precio</Text>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            {/* Primary Price */}
                            <Title level={1} style={{ margin: 0, color: '#389e0d', fontSize: '48px' }}>
                                {formatVenezuelanPrice(primary, primarySymbol)}
                            </Title>

                            {secondary > 0 && (
                                <Text style={{ fontSize: '22px', color: '#8c8c8c', marginTop: 4, fontWeight: 500 }}>
                                    Equivalente: {secondarySymbol} {secondary.toFixed(2)}
                                </Text>
                            )}
                        </div>
                    </div>

                    <Descriptions column={1} size="middle" bordered>
                        <Descriptions.Item label="Categoría">
                            {product.category?.name || 'N/A'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Disponibilidad">
                            {product.stock > 0 ? (
                                <Tag color="success" style={{ fontSize: '16px', padding: '4px 10px' }}>
                                    En Stock ({product.stock})
                                </Tag>
                            ) : (
                                <Tag color="error" style={{ fontSize: '16px', padding: '4px 10px' }}>Agotado</Tag>
                            )}
                        </Descriptions.Item>
                        {product.description && (
                            <Descriptions.Item label="Detalles">
                                {product.description}
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                </Col>
            </Row>
        </Modal>
    );
};
