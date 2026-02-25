import { Modal, Radio, Button, Select, type RadioChangeEvent } from 'antd';
import { useEffect, useState } from 'react';
import { CalculatorInput } from '../../../components/common/CalculatorInput';
import { usePOSStore, type CartItem } from '../../../store/posStore';
import { formatVenezuelanPrice } from '../../../utils/formatters';

interface PriceModalProps {
    open: boolean;
    cartItem: CartItem;
    onOk: (price: number) => void;
    onCancel: () => void;
}

export const PriceModal = ({ open, cartItem, onOk, onCancel }: PriceModalProps) => {
    const { primaryCurrency, currencies } = usePOSStore();
    const [selectedTier, setSelectedTier] = useState<'normal' | 'offer' | 'wholesale' | 'custom'>('normal');
    const [customPrice, setCustomPrice] = useState<number>(0);
    const [customPriceError, setCustomPriceError] = useState<string | null>(null);

    // Multi-currency support for custom price
    const [customCurrencyCode, setCustomCurrencyCode] = useState<string>(primaryCurrency?.code || 'VES');
    const [customInputValue, setCustomInputValue] = useState<number>(0);

    // Calculate prices in Primary Currency
    // Note: calculatePriceInPrimary uses 'salePrice' or 'secondarySalePrice' depending on unit.
    // We need to manually calculate offer/wholesale/cost based on the Unit logic inside calculatePriceInPrimary...
    // But calculatePriceInPrimary is hardcoded to use salePrice.
    // We should probably replicate the conversion logic or extract a 'convertAmount' helper.
    // For now, let's replicate the conversion logic safely using the helper's pattern if possible, 
    // or better yet, let's just make a 'convert' function locally using the same store data.

    // Actually, I can use calculatePriceInPrimary logic pattern:
    // It finds the rate and multiplies. 

    const { product, isSecondaryUnit } = cartItem;

    const getConvertedPrice = (priceVal: number | undefined) => {
        if (!priceVal) return 0;

        // Same logic as store
        if (product.currencyId === primaryCurrency?.id) return priceVal;

        const productCurrency = currencies.find(c => c.id === product.currencyId);
        if (productCurrency && (productCurrency.exchangeRate || 0) > 0) {
            return priceVal * Number(productCurrency.exchangeRate);
        }
        return priceVal;
    };

    const roundPrice = (price: number) => Math.ceil(price / 10) * 10;

    const costInPrimary = getConvertedPrice(isSecondaryUnit ? product.secondaryCostPrice : product.costPrice);
    const normalPrice = roundPrice(getConvertedPrice(isSecondaryUnit ? product.secondarySalePrice : product.salePrice));
    const offerPrice = roundPrice(getConvertedPrice(isSecondaryUnit ? product.secondaryOfferPrice : product.offerPrice));
    const wholesalePrice = roundPrice(getConvertedPrice(isSecondaryUnit ? product.secondaryWholesalePrice : product.wholesalePrice));

    // Calculate current BS price based on custom currency input
    useEffect(() => {
        if (selectedTier !== 'custom') return;

        let baseInBS = customInputValue;
        if (customCurrencyCode !== primaryCurrency?.code) {
            const selectedCurr = currencies.find(c => c.code === customCurrencyCode);
            if (selectedCurr && (selectedCurr.exchangeRate || 0) > 0) {
                baseInBS = customInputValue * Number(selectedCurr.exchangeRate);
            }
        }
        setCustomPrice(baseInBS);
    }, [customInputValue, customCurrencyCode, primaryCurrency, currencies, selectedTier]);

    // Validate BS price against cost
    useEffect(() => {
        if (selectedTier === 'custom') {
            setCustomPriceError(validateCustomPrice(customPrice));
        }
    }, [customPrice, selectedTier]);

    const validateCustomPrice = (price: number | null): string | null => {
        if (price === null || price <= 0) return null;

        // Calculate effective price after existing discount
        const discountPercent = cartItem.discountPercent || 0;
        const discountAmount = price * (discountPercent / 100);
        const effectivePrice = price - discountAmount;

        if (effectivePrice < costInPrimary) {
            return `Precio final (${effectivePrice.toFixed(2)}) menor al costo (${costInPrimary.toFixed(2)})`;
        }

        return null;
    };

    // Keyboard listener for F9
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (open && e.key === 'F9') {
                e.stopPropagation();
                e.preventDefault();
                handleSubmit();
            }
        };

        if (open) {
            window.addEventListener('keydown', handleGlobalKeyDown, true);
        }

        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown, true);
        };
    }, [open, cartItem, normalPrice, offerPrice, wholesalePrice, selectedTier, customPrice, customPriceError]);

    useEffect(() => {
        if (open) {
            setSelectedTier('normal');
            setCustomPrice(0);
            setCustomInputValue(0);
            setCustomCurrencyCode(primaryCurrency?.code || 'VES');
            setCustomPriceError(null);

            if (Math.abs(cartItem.price - normalPrice) < 0.01) setSelectedTier('normal');
            else if (offerPrice && Math.abs(cartItem.price - offerPrice) < 0.01) setSelectedTier('offer');
            else if (wholesalePrice && Math.abs(cartItem.price - wholesalePrice) < 0.01) setSelectedTier('wholesale');
            else {
                setSelectedTier('custom');
                setCustomInputValue(cartItem.price); // Set current BS price as input value initially
                setCustomPrice(cartItem.price);
            }
        }
    }, [open, cartItem, normalPrice, offerPrice, wholesalePrice, primaryCurrency]);

    const handleSubmit = () => {
        // Check for custom price validation errors first
        if (selectedTier === 'custom' && customPriceError) {
            Modal.error({
                title: 'Precio Inválido',
                content: customPriceError
            });
            return;
        }

        let finalPrice = normalPrice;
        if (selectedTier === 'offer') finalPrice = offerPrice;
        if (selectedTier === 'wholesale') finalPrice = wholesalePrice;
        if (selectedTier === 'custom') {
            finalPrice = customPrice || 0;
        }

        // Additional validation for non-custom prices (shouldn't happen but safety check)
        const discountPercent = cartItem.discountPercent || 0;
        const discountAmount = finalPrice * (discountPercent / 100);
        const effectivePrice = finalPrice - discountAmount;

        if (effectivePrice < costInPrimary) {
            let errorMsg = `El precio final (${effectivePrice.toFixed(2)}) no puede ser menor al costo (${costInPrimary.toFixed(2)}).`;

            if (discountPercent > 0) {
                errorMsg += ` El producto tiene un descuento activo del ${discountPercent}%.`;
            }

            Modal.error({
                title: 'Operación Inválida',
                content: errorMsg
            });
            return;
        }

        onOk(finalPrice);
    };

    const currencySymbol = primaryCurrency?.symbol || 'Bs';

    return (
        <Modal
            title="Seleccionar Precio"
            open={open}
            onOk={handleSubmit}
            onCancel={onCancel}
            width={400}
            footer={[
                <Button key="back" onClick={onCancel}>Cancelar</Button>,
                <Button key="submit" type="primary" onClick={handleSubmit}>Aceptar (F9)</Button>
            ]}
            centered
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                <div style={{ fontWeight: 'bold', fontSize: 14 }}>{product.name}</div>

                <Radio.Group
                    value={selectedTier}
                    onChange={(e: RadioChangeEvent) => {
                        setSelectedTier(e.target.value);
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                    <Radio value="normal" style={{ fontSize: 16 }}>
                        Normal: <strong>{currencySymbol} {normalPrice.toFixed(2)}</strong>
                    </Radio>

                    {offerPrice > 0 && (
                        <Radio value="offer" style={{ fontSize: 16 }}>
                            Oferta: <strong>{currencySymbol} {offerPrice.toFixed(2)}</strong>
                        </Radio>
                    )}

                    {wholesalePrice > 0 && (
                        <Radio value="wholesale" style={{ fontSize: 16 }}>
                            Mayor: <strong>{currencySymbol} {wholesalePrice.toFixed(2)}</strong>
                        </Radio>
                    )}

                    <Radio value="custom" style={{ fontSize: 16 }}>
                        Personalizado
                    </Radio>
                </Radio.Group>

                {selectedTier === 'custom' && (
                    <div style={{ marginLeft: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Select
                                value={customCurrencyCode}
                                onChange={setCustomCurrencyCode}
                                options={currencies.map(c => ({ label: c.symbol, value: c.code }))}
                                style={{ width: 80 }}
                            />
                            <CalculatorInput
                                value={customInputValue}
                                onChange={setCustomInputValue}
                                style={{ width: 150 }}
                                onPressEnter={handleSubmit}
                                status={customPriceError ? 'error' : ''}
                                autoFocus
                            />
                        </div>

                        {customPriceError && (
                            <div style={{ fontSize: 11, color: '#ff4d4f' }}>
                                {customPriceError}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 13, color: '#1890ff', fontWeight: 'bold' }}>
                                Total BS: {formatVenezuelanPrice(customPrice, currencySymbol)}
                            </div>
                            <div style={{ fontSize: 11, color: '#888' }}>
                                Costo: {currencySymbol} {costInPrimary.toFixed(2)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
