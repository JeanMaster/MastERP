import { Modal, Form, Radio, InputNumber, Select, Input, message, Statistic, Alert } from 'antd';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { inventoryAdjustmentsApi, type CreateAdjustmentDto } from '../../../services/inventoryAdjustmentsApi';
import { productsApi } from '../../../services/productsApi';

const { TextArea } = Input;

interface CreateAdjustmentModalProps {
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

const reasonLabels: Record<string, string> = {
    DAMAGE: '🔨 Damage/Defect',
    LOSS: '📉 Loss/Theft',
    ERROR: '❌ Counting Correction',
    INITIAL: '📦 Initial Inventory',
    RETURN: '↩️ Return to Stock',
    TRANSFER: '↔️ Transfer',
    OTHER: '📝 Other'
};

/**
 * CreateAdjustmentModal Component
 * Workflow for recording manual inventory stock changes.
 * Supports increases and decreases, providing real-time stock projections and validation to prevent negative inventory.
 */
export const CreateAdjustmentModal = ({ open, onCancel, onSuccess }: CreateAdjustmentModalProps) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [adjustmentType, setAdjustmentType] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
    const [quantity, setQuantity] = useState<number>(0);

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
            message.success('Adjustment recorded successfully');
            form.resetFields();
            setSelectedProduct(null);
            setQuantity(0);
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error creating adjustment');
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
            title="New Inventory Adjustment"
            open={open}
            onCancel={handleCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
            okText="Confirm Adjustment (F9)"
            cancelText="Cancel"
            width={600}
        >
            <Form
                form={form}
                layout="vertical"
                style={{ marginTop: 20 }}
                initialValues={{ type: 'INCREASE', performedBy: 'User' }}
            >
                <Form.Item
                    name="productId"
                    label="Product"
                    rules={[{ required: true, message: 'Please select a product' }]}
                >
                    <Select
                        showSearch
                        placeholder="Search product..."
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
                                title="Current Stock"
                                value={selectedProduct.stock}
                                suffix="units"
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
                    label="Adjustment Type"
                    rules={[{ required: true }]}
                >
                    <Radio.Group
                        buttonStyle="solid"
                        size="large"
                        onChange={(e) => handleTypeChange(e.target.value)}
                    >
                        <Radio.Button value="INCREASE" style={{ width: 275 }}>
                            ↑ Increase (+)
                        </Radio.Button>
                        <Radio.Button value="DECREASE" style={{ width: 275 }}>
                            ↓ Decrease (-)
                        </Radio.Button>
                    </Radio.Group>
                </Form.Item>

                <Form.Item
                    name="quantity"
                    label="Quantity"
                    rules={[
                        { required: true, message: 'Please enter quantity' },
                        { type: 'number', min: 1, message: 'Must be greater than 0' }
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
                        message="Projected New Stock"
                        description={
                            <div style={{ fontSize: 24, fontWeight: 'bold', color: canDecrease ? '#1890ff' : '#ff4d4f' }}>
                                {newStock} units
                            </div>
                        }
                        type={canDecrease ? 'success' : 'error'}
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                {adjustmentType === 'DECREASE' && !canDecrease && quantity > 0 && (
                    <Alert
                        message="Insufficient Stock"
                        description={`Unable to decrease ${quantity} units. Available stock: ${selectedProduct?.stock || 0}`}
                        type="error"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form.Item
                    name="reason"
                    label="Adjustment Reason"
                    rules={[{ required: true, message: 'Please select a reason' }]}
                >
                    <Select placeholder="Select a reason" size="large">
                        {Object.entries(reasonLabels).map(([key, label]) => (
                            <Select.Option key={key} value={key}>
                                {label}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="performedBy"
                    label="Performed By"
                >
                    <Input placeholder="User name" />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label="Notes (Optional)"
                >
                    <TextArea
                        rows={3}
                        placeholder="Detailed explanation of the adjustment..."
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};
