import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Checkbox, message, Alert, Select } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currenciesApi } from '../../services/currenciesApi';
import type { Currency, CreateCurrencyDto, UpdateCurrencyDto } from '../../services/currenciesApi';

interface CurrencyFormModalProps {
    open: boolean;
    currency: Currency | null;
    onClose: () => void;
}

/**
 * CurrencyFormModal Component
 * Modal to create or edit a currency. Handles primary currency logic and exchange rates.
 */
export const CurrencyFormModal = ({ open, currency, onClose }: CurrencyFormModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // Create mutation
    const createMutation = useMutation({
        mutationFn: currenciesApi.create,
        onSuccess: () => {
            message.success('Currency created successfully');
            queryClient.invalidateQueries({ queryKey: ['currencies'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error creating currency');
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateCurrencyDto }) =>
            currenciesApi.update(id, dto),
        onSuccess: () => {
            message.success('Currency updated successfully');
            queryClient.invalidateQueries({ queryKey: ['currencies'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error updating currency');
        },
    });

    // Load form data when editing
    useEffect(() => {
        if (currency) {
            form.setFieldsValue({
                name: currency.name,
                code: currency.code,
                symbol: currency.symbol,
                isPrimary: currency.isPrimary,
                exchangeRate: currency.exchangeRate,
                isAutomatic: currency.isAutomatic,
                apiSymbol: currency.apiSymbol,
            });
        } else {
            form.resetFields();
            form.setFieldsValue({ isPrimary: false });
        }
    }, [currency, form]);

    // F9 Keyboard Shortcut
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
            const dto: CreateCurrencyDto = {
                name: values.name,
                code: values.code,
                symbol: values.symbol,
                isPrimary: values.isPrimary || false,
                exchangeRate: values.isPrimary ? undefined : values.exchangeRate,
                isAutomatic: values.isAutomatic,
                apiSymbol: values.apiSymbol,
            };

            if (currency) {
                updateMutation.mutate({ id: currency.id, dto });
            } else {
                createMutation.mutate(dto);
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    // Watch isPrimary changes
    const isPrimary = Form.useWatch('isPrimary', form);

    return (
        <Modal
            title={currency ? 'Edit Currency' : 'New Currency'}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={currency ? 'Update (F9)' : 'Create (F9)'}
            cancelText="Cancel"
            width={600}
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Form.Item
                    label="Name"
                    name="name"
                    rules={[{ required: true, message: 'Name is required' }]}
                >
                    <Input placeholder="e.g., US Dollar, Euro, Bolívar" />
                </Form.Item>

                <Form.Item
                    label="Code (ISO 4217)"
                    name="code"
                    rules={[{ required: true, message: 'Code is required' }]}
                >
                    <Input placeholder="e.g., USD, VES, EUR" maxLength={3} style={{ textTransform: 'uppercase' }} />
                </Form.Item>

                <Form.Item
                    label="Symbol"
                    name="symbol"
                    rules={[{ required: true, message: 'Symbol is required' }]}
                >
                    <Input placeholder="e.g., $, Bs, €" maxLength={5} />
                </Form.Item>

                <Form.Item name="isPrimary" valuePropName="checked">
                    <Checkbox>
                        <strong>Is Primary Currency</strong>
                        <div style={{ fontSize: 12, color: '#888' }}>
                            The primary currency serves as the base for all exchange rates
                        </div>
                    </Checkbox>
                </Form.Item>

                {isPrimary && (
                    <Alert
                        message="This currency will be marked as primary"
                        description="If another primary currency exists, it will be automatically unmasked."
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                {!isPrimary && (
                    <>
                        <Form.Item name="isAutomatic" valuePropName="checked">
                            <Checkbox>
                                <strong>Automatic Update</strong>
                            </Checkbox>
                        </Form.Item>

                        <Form.Item
                            noStyle
                            shouldUpdate={(prev, current) => prev.isAutomatic !== current.isAutomatic}
                        >
                            {({ getFieldValue }) =>
                                getFieldValue('isAutomatic') ? (
                                    <Form.Item
                                        label="Data Source"
                                        name="apiSymbol"
                                        rules={[{ required: true, message: 'Please select a source' }]}
                                    >
                                        <Select placeholder="Select external source">
                                            <Select.Option value="binance_p2p">Binance P2P (USDT)</Select.Option>
                                            <Select.Option value="bcv">Central Bank of Venezuela (BCV)</Select.Option>
                                            <Select.Option value="enparalelo">EnParaleloVzla</Select.Option>
                                        </Select>
                                    </Form.Item>
                                ) : (
                                    <Form.Item
                                        label="Exchange Rate"
                                        name="exchangeRate"
                                        rules={[
                                            { required: !isPrimary, message: 'Exchange rate is required for secondary currencies' },
                                            { type: 'number', min: 0.0001, message: 'Rate must be greater than 0' },
                                        ]}
                                        help="How many units of the primary currency equal 1 unit of this currency? e.g., 1 USD = 100 Bs"
                                    >
                                        <InputNumber
                                            placeholder="e.g., 100.00"
                                            style={{ width: '100%' }}
                                            precision={4}
                                            min={0.0001}
                                            onKeyDown={(e) => {
                                                // Support both dot and comma for decimals
                                                if (e.key === ',') {
                                                    e.preventDefault();
                                                    const input = e.target as HTMLInputElement;
                                                    const start = input.selectionStart || 0;
                                                    const end = input.selectionEnd || 0;
                                                    input.setRangeText('.', start, end, 'end');
                                                    const event = new Event('input', { bubbles: true });
                                                    input.dispatchEvent(event);
                                                }
                                            }}
                                        />
                                    </Form.Item>
                                )
                            }
                        </Form.Item>
                    </>
                )}
            </Form>
        </Modal>
    );
};
