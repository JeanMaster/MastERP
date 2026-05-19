import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Checkbox, message, Alert, Select } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { currenciesApi } from '../../services/currenciesApi';
import type { Currency, CreateCurrencyDto, UpdateCurrencyDto } from '../../services/currenciesApi';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();

    // Create mutation
    const createMutation = useMutation({
        mutationFn: currenciesApi.create,
        onSuccess: () => {
            message.success(t('currencies.success_create', { defaultValue: 'Currency created successfully' }));
            queryClient.invalidateQueries({ queryKey: ['currencies'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('common.error'));
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, dto }: { id: string; dto: UpdateCurrencyDto }) =>
            currenciesApi.update(id, dto),
        onSuccess: () => {
            message.success(t('currencies.success_update', { defaultValue: 'Currency updated successfully' }));
            queryClient.invalidateQueries({ queryKey: ['currencies'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || t('common.error'));
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
            title={currency ? t('currencies.edit') : t('currencies.new')}
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={createMutation.isPending || updateMutation.isPending}
            okText={currency ? `${t('common.save')} (F9)` : `${t('common.add')} (F9)`}
            cancelText={t('common.cancel')}
            width={600}
            forceRender
        >
            <Form form={form} layout="vertical" style={{ marginTop: 20 }}>
                <Form.Item
                    label={t('currencies.form.name')}
                    name="name"
                    rules={[{ required: true, message: t('common.error') }]}
                >
                    <Input placeholder={t('currencies.form.name_placeholder')} />
                </Form.Item>

                <Form.Item
                    label={t('currencies.form.code')}
                    name="code"
                    rules={[{ required: true, message: t('common.error') }]}
                >
                    <Input placeholder={t('currencies.form.code_help')} maxLength={3} style={{ textTransform: 'uppercase' }} />
                </Form.Item>

                <Form.Item
                    label={t('currencies.form.symbol')}
                    name="symbol"
                    rules={[{ required: true, message: t('common.error') }]}
                >
                    <Input placeholder={t('currencies.form.symbol_placeholder')} maxLength={5} />
                </Form.Item>

                <Form.Item name="isPrimary" valuePropName="checked">
                    <Checkbox>
                        <strong>{t('currencies.form.is_primary')}</strong>
                        <div style={{ fontSize: 12, color: '#888' }}>
                            {t('currencies.form.is_primary_desc')}
                        </div>
                    </Checkbox>
                </Form.Item>

                {isPrimary && (
                    <Alert
                        message={t('currencies.form.is_primary_alert')}
                        description={t('currencies.form.is_primary_alert_desc')}
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                {!isPrimary && (
                    <>
                        <Form.Item name="isAutomatic" valuePropName="checked">
                            <Checkbox>
                                <strong>{t('currencies.form.is_automatic')}</strong>
                            </Checkbox>
                        </Form.Item>

                        <Form.Item
                            noStyle
                            shouldUpdate={(prev, current) => prev.isAutomatic !== current.isAutomatic}
                        >
                            {({ getFieldValue }) =>
                                getFieldValue('isAutomatic') ? (
                                    <Form.Item
                                        label={t('currencies.form.data_source')}
                                        name="apiSymbol"
                                        rules={[{ required: true, message: t('common.select_source') }]}
                                    >
                                        <Select placeholder={t('common.select_source')}>
                                            <Select.Option value="binance_p2p">Binance P2P (USDT)</Select.Option>
                                            <Select.Option value="bcv">Central Bank of Venezuela (BCV)</Select.Option>
                                            <Select.Option value="enparalelo">EnParaleloVzla</Select.Option>
                                        </Select>
                                    </Form.Item>
                                ) : (
                                    <Form.Item
                                        label={t('currencies.rate')}
                                        name="exchangeRate"
                                        rules={[
                                            { required: !isPrimary, message: t('currencies.form.rate_error') },
                                            { type: 'number', min: 0.0001, message: t('currencies.form.rate_error') },
                                        ]}
                                        help={t('currencies.form.rate_help')}
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
