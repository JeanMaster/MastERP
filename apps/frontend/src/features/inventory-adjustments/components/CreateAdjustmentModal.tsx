import { Modal, Form, Radio, InputNumber, Select, Input, message, Statistic, Alert } from 'antd';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { inventoryAdjustmentsApi, type CreateAdjustmentDto } from '../../../services/inventoryAdjustmentsApi';
import { productsApi } from '../../../services/productsApi';

const { TextArea } = Input;

interface CreateAdjustmentModalProps {
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

/**
 * CreateAdjustmentModal Component
 * Workflow for recording manual inventory stock changes.
 * Supports increases and decreases, providing real-time stock projections and validation to prevent negative inventory.
 */
export const CreateAdjustmentModal = ({ open, onCancel, onSuccess }: CreateAdjustmentModalProps) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [adjustmentType, setAdjustmentType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
    const [quantity, setQuantity] = useState<number>(0);

    const reasonLabels: Record<string, string> = {
        DAMAGE: t('adjustments.reasons.DAMAGE'),
        LOSS: t('adjustments.reasons.LOSS'),
        ERROR: t('adjustments.reasons.ERROR'),
        INITIAL: t('adjustments.reasons.INITIAL'),
        RETURN: t('adjustments.reasons.RETURN'),
        TRANSFER: t('adjustments.reasons.TRANSFER'),
        OTHER: t('adjustments.reasons.OTHER')
    };

    const { data: products = [] } = useQuery({
        queryKey: ['products-active'],
        queryFn: () => productsApi.getAll()
    });

    const handleProductSelect = (productId: string) => {
        const product = products.find(p => p.id === productId);
        setSelectedProduct(product);
        form.setFieldValue('quantity', 0);
        setQuantity(0);
    };

    const handleTypeChange = (type: 'INCREASE' | 'DECREASE') => {
        setAdjustmentType(type);
    };

    const handleQuantityChange = (value: number | null) => {
        setQuantity(value || 0);
    };

    const calculateNewStock = () => {
        if (!selectedProduct) return 0;
        const currentStock = selectedProduct.stock;

        if (adjustmentType === 'INCREASE') {
            return currentStock + quantity;
        } else {
            return currentStock - quantity;
        }
    };

    // F9 Keyboard Shortcut for quick submission
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [open]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const dto: CreateAdjustmentDto = {
                productId: values.productId,
                type: values.type,
                quantity: values.quantity,
                reason: values.reason,
                notes: values.notes,
                performedBy: values.performedBy || 'User'
            };

            await inventoryAdjustmentsApi.create(dto);
            message.success(t('adjustments.success_create'));
            form.resetFields();
            setSelectedProduct(null);
            setQuantity(0);
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || t('adjustments.error_create'));
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setSelectedProduct(null);
        setQuantity(0);
        onCancel();
    };

    const newStock = calculateNewStock();
    const canDecrease = selectedProduct && newStock >= 0;

    return (
        <Modal
            title={t('adjustments.new')}
            open={open}
            onCancel={handleCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText={`${t('adjustments.confirm')} (F9)`}
            cancelText={t('common.cancel')}
            width={600}
            forceRender
        >
            <Form
                form={form}
                layout="vertical"
                style={{ marginTop: 20 }}
                initialValues={{ type: 'INCREASE', performedBy: 'User' }}
            >
                <Form.Item
                    name="productId"
                    label={t('adjustments.product')}
                    rules={[{ required: true, message: t('common.error') }]}
                >
                    <Select
                        showSearch
                        placeholder={t('adjustments.search_product')}
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={products.map(p => ({
                            label: `${p.name} (${p.sku})`,
                            value: p.id
                        }))}
                        onChange={handleProductSelect}
                        size="large"
                    />
                </Form.Item>

                {selectedProduct && (
                    <Alert
                        message={
                            <Statistic
                                title={t('adjustments.current_stock')}
                                value={selectedProduct.stock}
                                suffix={t('common.units')}
                                valueStyle={{ fontSize: 20 }}
                                styles={{ content: { fontSize: 20 } }}
                            />
                        }
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form.Item
                    name="type"
                    label={t('adjustments.type')}
                    rules={[{ required: true }]}
                >
                    <Radio.Group
                        buttonStyle="solid"
                        size="large"
                        onChange={(e) => handleTypeChange(e.target.value)}
                    >
                        <Radio.Button value="INCREASE" style={{ width: 275 }}>
                            ↑ {t('adjustments.increase')}
                        </Radio.Button>
                        <Radio.Button value="DECREASE" style={{ width: 275 }}>
                            ↓ {t('adjustments.decrease')}
                        </Radio.Button>
                    </Radio.Group>
                </Form.Item>

                <Form.Item
                    name="quantity"
                    label={t('adjustments.quantity')}
                    rules={[
                        { required: true, message: t('common.error') },
                        { type: 'number', min: 1, message: t('common.error') }
                    ]}
                >
                    <InputNumber
                        style={{ width: '100%' }}
                        placeholder="0"
                        min={1}
                        size="large"
                        onChange={handleQuantityChange}
                    />
                </Form.Item>

                {selectedProduct && quantity > 0 && (
                    <Alert
                        message={t('adjustments.projected_stock')}
                        description={
                            <div style={{ fontSize: 24, fontWeight: 'bold', color: canDecrease ? '#1890ff' : '#ff4d4f' }}>
                                {newStock} {t('common.units')}
                            </div>
                        }
                        type={canDecrease ? 'success' : 'error'}
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                {adjustmentType === 'DECREASE' && !canDecrease && quantity > 0 && (
                    <Alert
                        message={t('adjustments.insufficient_stock')}
                        description={t('adjustments.insufficient_desc', { quantity, stock: selectedProduct?.stock || 0 })}
                        type="error"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form.Item
                    name="reason"
                    label={t('adjustments.reason')}
                    rules={[{ required: true, message: t('common.error') }]}
                >
                    <Select placeholder={t('adjustments.select_reason')} size="large">
                        {Object.entries(reasonLabels).map(([key, label]) => (
                            <Select.Option key={key} value={key}>
                                {label}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="performedBy"
                    label={t('adjustments.performed_by')}
                >
                    <Input placeholder={t('common.username')} />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label={t('adjustments.notes')}
                >
                    <TextArea
                        rows={3}
                        placeholder={t('adjustments.notes') + "..."}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};
