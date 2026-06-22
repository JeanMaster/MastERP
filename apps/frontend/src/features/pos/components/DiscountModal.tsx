import { Modal, Button, Space, Alert, Typography, Segmented } from 'antd';
import { useEffect, useState } from 'react';
import { CalculatorInput } from '../../../components/common/CalculatorInput';
import type { Product } from '../../../services/productsApi';
import { usePOSStore } from '../../../store/posStore';
import { useTranslation } from 'react-i18next';

interface DiscountModalProps {
    open: boolean;
    product: Product | null;
    currentPrice: number;
    isSecondaryUnit: boolean;
    onOk: (percent: number) => void;
    onCancel: () => void;
}

type DiscountMode = 'PERCENT' | 'AMOUNT';

export const DiscountModal = ({ open, product, currentPrice, isSecondaryUnit, onOk, onCancel }: DiscountModalProps) => {
    const { t } = useTranslation();
    const { calculateCostInPrimary } = usePOSStore();
    const [mode, setMode] = useState<DiscountMode>('PERCENT');
    const [inputValue, setInputValue] = useState(0);
    const [error, setError] = useState<string | null>(null);

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
    }, [open, inputValue, mode, error]); // Include dependencies used in handleSubmit/validate indirectly

    // Initialization logic (only when modal opens)
    useEffect(() => {
        if (open) {
            setMode('PERCENT');
            setInputValue(0);
            setError(null);
        }
    }, [open]);

    // Normalize input to percentage for backend/store logic
    const getEquivalentPercent = (val: number, currentMode: DiscountMode) => {
        if (currentMode === 'PERCENT') return val;
        if (currentPrice === 0) return 0;
        return (val / currentPrice) * 100;
    };

    const calculateNewPrice = (val: number, currentMode: DiscountMode) => {
        if (currentMode === 'PERCENT') {
            return currentPrice - (currentPrice * (val / 100));
        } else {
            return currentPrice - val;
        }
    };

    const validate = (val: number, currentMode: DiscountMode): string | null => {
        if (!product) return null;

        const equivPercent = getEquivalentPercent(val, currentMode);

        // 1. Max 30% discount
        if (equivPercent > 30) {
            return t('pos.modals.discount.max_discount');
        }

        // 2. Price cannot go below cost (converted to primary currency)
        const newPrice = calculateNewPrice(val, currentMode);
        const costInPrimary = calculateCostInPrimary(product, isSecondaryUnit);

        if (newPrice < costInPrimary) {
            return t('pos.modals.discount.below_cost', { price: newPrice.toFixed(2), cost: costInPrimary.toFixed(2) });
        }

        if (currentMode === 'AMOUNT' && val > currentPrice) {
            return t('pos.modals.discount.above_price');
        }

        return null;
    };

    const handleSubmit = () => {
        const validationError = validate(inputValue, mode);
        if (validationError) {
            setError(validationError);
            return;
        }

        const finalPercent = getEquivalentPercent(inputValue, mode);
        onOk(finalPercent);
    };

    const handleChange = (val: number | null) => {
        const newVal = val || 0;
        setInputValue(newVal);
        const err = validate(newVal, mode);
        setError(err);
    };

    const handleModeChange = (newMode: any) => {
        // When changing mode, try to keep the same discount value if possible
        // But for simplicity and to avoid confusion, let's reset or convert.
        // Let's reset to avoid accidental over-discounts.
        setMode(newMode as DiscountMode);
        setInputValue(0);
        setError(null);
    };

    return (
        <Modal
            title={t('pos.modals.discount.title')}
            open={open}
            onOk={handleSubmit}
            onCancel={onCancel}
            width={350}
            footer={null}
            centered
        >
            <div style={{ textAlign: 'center' }}>
                <p style={{ marginBottom: 15, fontWeight: 'bold', fontSize: 16 }}>{product?.name}</p>

                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                    <Segmented
                        block
                        value={mode}
                        onChange={handleModeChange}
                        options={[
                            { label: t('pos.modals.discount.percent_tab'), value: 'PERCENT' },
                            { label: t('pos.modals.discount.amount_tab'), value: 'AMOUNT' }
                        ]}
                    />

                    <CalculatorInput
                        value={inputValue}
                        onChange={handleChange}
                        size="large"
                        style={{ width: '100%' }}
                        onPressEnter={handleSubmit}
                        addonAfter={mode === 'PERCENT' ? '%' : 'Bs'}
                        status={error ? 'error' : ''}
                        placeholder={mode === 'PERCENT' ? t('pos.modals.discount.percent_placeholder') : t('pos.modals.discount.amount_placeholder')}
                    />

                    {error && (
                        <Alert
                            message={error}
                            type="error"
                            showIcon
                            style={{ textAlign: 'left', fontSize: 12 }}
                        />
                    )}

                    <div style={{
                        marginTop: 10,
                        background: '#f5f5f5',
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: '1px solid #e8e8e8'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Typography.Text type="secondary">{t('pos.modals.discount.original_price')}</Typography.Text>
                            <Typography.Text style={{ textDecoration: 'line-through' }}>
                                {currentPrice.toFixed(2)} Bs
                            </Typography.Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography.Text strong>{t('pos.modals.discount.final_price')}</Typography.Text>
                            <Typography.Text strong style={{ color: '#1890ff', fontSize: 18 }}>
                                {calculateNewPrice(inputValue, mode).toFixed(2)} Bs
                            </Typography.Text>
                        </div>
                        {mode === 'AMOUNT' && inputValue > 0 && (
                            <div style={{ textAlign: 'right', marginTop: 4 }}>
                                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                    {t('pos.modals.discount.equiv_discount', { percent: getEquivalentPercent(inputValue, mode).toFixed(1) })}
                                </Typography.Text>
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: 15, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        <Button onClick={onCancel} size="large">{t('pos.modals.discount.cancel')}</Button>
                        <Button
                            type="primary"
                            onClick={handleSubmit}
                            disabled={!!error}
                            size="large"
                            style={{ paddingLeft: 30, paddingRight: 30 }}
                        >
                            {t('pos.modals.discount.apply')}
                        </Button>
                    </div>
                </Space>
            </div>
        </Modal>
    );
};
