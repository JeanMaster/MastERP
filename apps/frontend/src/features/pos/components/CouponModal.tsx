import { useState, useEffect } from 'react';
import { Modal, Input, Button, message, Typography, Tag } from 'antd';
import { TagOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { usePOSStore } from '../../../store/posStore';
import { marketingApi } from '../../../services/marketingApi';
import { formatVenezuelanPriceOnly } from '../../../utils/formatters';

const { Text, Title } = Typography;

interface CouponModalProps {
    open: boolean;
    onOk: () => void;
    onCancel: () => void;
}

export const CouponModal = ({ open, onOk, onCancel }: CouponModalProps) => {
    const [code, setCode] = useState('');
    const [verifying, setVerifying] = useState(false);
    
    // Store data
    const { cart, customerId, getNormalizedQuantity, appliedCoupon, applyCoupon, removeCoupon, calculateCostInPrimary } = usePOSStore();

    useEffect(() => {
        if (open) setCode('');
    }, [open]);

    // Handle F9 Keyboard Shortcut within Modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (open && e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                if (code.trim()) {
                    handleApply();
                } else {
                    onCancel(); // Or just ignore
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [open, code]);

    const handleApply = async () => {
        if (!code.trim()) return;

        setVerifying(true);
        try {
            // Transform cart to expected format for validation
            const cartItems = cart.map(item => {
                const qty = getNormalizedQuantity(item.quantity, item.product, item.isSecondaryUnit);
                let price = item.price;
                let itemCost = calculateCostInPrimary(item.product, item.isSecondaryUnit);
                
                if (item.isSecondaryUnit && item.product.unitsPerSecondaryUnit) {
                    const factor = Number(item.product.unitsPerSecondaryUnit);
                    if (item.product.conversionDirection === 'secondary_to_primary') {
                        price = price * factor;
                        itemCost = itemCost * factor;
                    } else {
                        price = price / factor;
                        itemCost = itemCost / factor;
                    }
                }
                
                return {
                    id: item.product.id,
                    categoryId: item.product.categoryId,
                    salePrice: price,
                    costPrice: itemCost,
                    quantity: qty
                };
            });

            const res = await marketingApi.validateCoupon({
                code: code.trim().toUpperCase(),
                clientId: customerId || undefined,
                cartItems
            });

            message.success(res.message || 'Cupón aplicado con éxito');
            applyCoupon({
                id: res.couponId,
                code: res.code,
                discountAmount: res.discountAmount
            });
            onOk();
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.message || 'Error al validar cupón';
            message.error(msg);
        } finally {
            setVerifying(false);
        }
    };

    const handleRemove = () => {
        removeCoupon();
        message.info('Cupón removido');
        onCancel();
    };

    return (
        <Modal
            title={<Title level={4} style={{ margin: 0 }}><TagOutlined /> Código de Descuento</Title>}
            open={open}
            onCancel={onCancel}
            footer={null}
            width={400}
            centered
        >
            <div style={{ marginTop: 20 }}>
                {appliedCoupon ? (
                    <div style={{ background: '#f6ffed', padding: 20, borderRadius: 8, border: '1px solid #b7eb8f', textAlign: 'center' }}>
                        <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a', marginBottom: 10 }} />
                        <Title level={5}>Cupón Activado: <Tag color="green">{appliedCoupon.code}</Tag></Title>
                        <Text style={{ fontSize: 16 }}>Descuento Total: -{formatVenezuelanPriceOnly(appliedCoupon.discountAmount, 2, false)}</Text>
                        
                        <div style={{ marginTop: 20 }}>
                            <Button danger icon={<DeleteOutlined />} onClick={handleRemove} block>
                                Quitar Cupón
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <Input
                            size="large"
                            placeholder="Ingrese código del cupón"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            onPressEnter={handleApply}
                            style={{ textTransform: 'uppercase', textAlign: 'center', fontWeight: 'bold', fontSize: 18, letterSpacing: 2 }}
                            autoFocus
                        />
                        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <Button onClick={onCancel} size="large">Cancelar</Button>
                            <Button 
                                type="primary" 
                                size="large" 
                                onClick={handleApply} 
                                loading={verifying}
                                disabled={!code.trim()}
                            >
                                Aplicar Cupón (F9)
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};
