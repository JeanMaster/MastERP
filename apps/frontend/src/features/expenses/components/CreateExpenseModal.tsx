import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, App, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { expensesApi, type UpdateExpenseDto, type Expense } from '../../../services/expensesApi';
import { currenciesApi } from '../../../services/currenciesApi';
import { banksApi } from '../../../services/banksApi';
import { companySettingsApi } from '../../../services/companySettingsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';

interface CreateExpenseModalProps {
    open: boolean;
    onCancel: () => void;
    expense?: Expense | null; // Expense to edit
}

const EXPENSE_CATEGORIES = [
    'SERVICES',
    'PAYROLL',
    'MAINTENANCE',
    'RENT',
    'SUPPLIERS',
    'TRANSPORTATION',
    'MARKETING',
    'TAXES',
    'OTHERS'
];

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'TRANSFER', label: 'Transfer' },
    { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
    { value: 'DEBIT', label: 'Debit Card' },
    { value: 'CREDIT', label: 'Credit Card' },
    { value: 'ZELLE', label: 'Zelle' },
    { value: 'USDT', label: 'USDT (Binance)' },
];

/**
 * CreateExpenseModal Component
 * Modal to create or edit an operative expense record.
 */
export const CreateExpenseModal = ({ open, onCancel, expense }: CreateExpenseModalProps) => {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);

    // Watch fields for calculations
    const selectedCurrencyId = Form.useWatch('currencyId', form);
    const amount = Form.useWatch('amount', form);
    const exchangeRate = Form.useWatch('exchangeRate', form);
    const selectedBankId = Form.useWatch('bankAccountId', form);

    // Fetch currencies
    const { data: currencies = [] } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
    });

    // Fetch banks
    const { data: banks = [] } = useQuery({
        queryKey: ['banks'],
        queryFn: () => banksApi.getAll(),
    });

    const { data: settings } = useQuery({
        queryKey: ['company-settings'],
        queryFn: companySettingsApi.getSettings,
        enabled: open
    });

    // Set initial values when modal opens
    useEffect(() => {
        if (open) {
            if (expense) {
                // Edit Mode: Populate fields
                const currency = currencies.find(c => c.code === expense.currencyCode);
                form.setFieldsValue({
                    description: expense.description,
                    amount: expense.amount,
                    currencyId: currency?.id,
                    exchangeRate: expense.exchangeRate,
                    date: dayjs(expense.date),
                    category: expense.category,
                    paymentMethod: expense.paymentMethod,
                    reference: expense.reference,
                    notes: expense.notes,
                    bankAccountId: expense.bankAccountId,
                    isTaxable: expense.isTaxable || false,
                    taxAmount: expense.taxAmount || 0,
                });
            } else if (currencies.length > 0) {
                // Create Mode: Set Defaults
                form.resetFields();

                // Default to Primary or USD
                const primary = currencies.find(c => c.isPrimary);
                const usd = currencies.find(c => c.code === 'USD');
                const defaultCurrency = usd || primary || currencies[0];

                form.setFieldValue('currencyId', defaultCurrency.id);

                // Set Exchange Rate: Attempt to set the current system rate
                if (usd) {
                    form.setFieldValue('exchangeRate', usd.exchangeRate || 1);
                } else {
                    form.setFieldValue('exchangeRate', 1);
                }

                // Set other defaults
                form.setFieldsValue({
                    date: dayjs(),
                    paymentMethod: 'CASH',
                    category: 'OTHERS'
                });
            }
        }
    }, [open, expense, currencies, form]);

    const handleCurrencyChange = () => {
        // Exchange rate logic can be added here if needed to auto-update rate on currency change
    };

    const createExpenseMutation = useMutation({
        mutationFn: expensesApi.create,
        onSuccess: () => {
            message.success(t('expenses.messages.success_register'));
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            form.resetFields();
            onCancel();
        },
        onError: (error) => {
            message.error(t('expenses.messages.error_register'));
            console.error(error);
        }
    });

    const updateExpenseMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateExpenseDto }) => expensesApi.update(id, data),
        onSuccess: () => {
            message.success(t('expenses.messages.success_update'));
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            form.resetFields();
            onCancel();
        },
        onError: (error) => {
            message.error(t('expenses.messages.error_update'));
            console.error(error);
        }
    });

    const handleSubmit = async (values: any) => {
        setLoading(true);
        try {
            const selectedCurrency = currencies.find(c => c.id === values.currencyId);

            const commonData = {
                description: values.description,
                amount: Number(values.amount),
                currencyCode: selectedCurrency?.code || 'VES',
                exchangeRate: Number(values.exchangeRate),
                date: values.date ? values.date.toISOString() : undefined,
                category: values.category,
                paymentMethod: values.paymentMethod,
                reference: values.reference,
                notes: values.notes,
                bankAccountId: values.bankAccountId,
                taxAmount: values.taxAmount || 0,
                isTaxable: values.isTaxable || false,
                invoiceNumber: values.isTaxable ? values.invoiceNumber : undefined,
                invoiceControlNumber: values.isTaxable ? values.invoiceControlNumber : undefined,
            };

            if (expense) {
                await updateExpenseMutation.mutateAsync({ id: expense.id, data: commonData });
            } else {
                await createExpenseMutation.mutateAsync(commonData);
            }
        } finally {
            setLoading(false);
        }
    };

    // F9 Keyboard Shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === 'F9') {
                e.preventDefault();
                e.stopPropagation();
                form.submit();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [open, form]);

    // Calculate equivalent for preview
    const selectedCurrencyObj = currencies.find(c => c.id === selectedCurrencyId);
    let conversionPreview = null;

    if (selectedCurrencyObj && amount && exchangeRate) {
        if (selectedCurrencyObj.isPrimary) {
            const secondary = currencies.find(c => !c.isPrimary);
            if (secondary) {
                const usdAmount = amount / exchangeRate;
                conversionPreview = t('expenses.conversion.equivalent_divisa', { amount: formatVenezuelanPrice(usdAmount, '$') });
            }
        } else {
            const vesAmount = amount * exchangeRate;
            conversionPreview = t('expenses.conversion.equivalent_ves', { amount: formatVenezuelanPrice(vesAmount, 'Bs.') });
        }
    }

    // Calculate bank deduction preview
    const selectedBank = banks.find(b => b.id === selectedBankId);
    let bankDeductionPreview = null;
    if (selectedBank && amount && exchangeRate) {
        let deductionAmount = amount;
        if (selectedCurrencyObj?.code !== selectedBank.currency.code) {
            if (selectedBank.currency.isPrimary) {
                deductionAmount = amount * exchangeRate;
            } else {
                deductionAmount = amount / exchangeRate;
            }
        }
        bankDeductionPreview = t('expenses.conversion.bank_deduction', { amount: formatVenezuelanPrice(deductionAmount, selectedBank.currency.symbol) });
    }

    return (
        <Modal
            title={expense ? t('expenses.edit_expense') : t('expenses.register_new')}
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={loading}
            okText={expense ? t('expenses.save_changes') : t('expenses.register')}
            cancelText={t('common.cancel')}
            width={600}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
            >
                <Form.Item
                    name="description"
                    label={t('expenses.description')}
                    rules={[{ required: true, message: t('expenses.description_req') }]}
                >
                    <Input placeholder={t('expenses.description_placeholder')} autoFocus />
                </Form.Item>

                <Space style={{ display: 'flex', marginBottom: 16 }} align="start" size={16}>
                    <Form.Item
                        name="isTaxable"
                        label={t('expenses.is_taxable')}
                        valuePropName="checked"
                    >
                        <Select
                            placeholder={t('expenses.fiscal_placeholder')}
                            style={{ width: '150px' }}
                            onChange={(val) => {
                                if (!val) form.setFieldValue('taxAmount', 0);
                                else {
                                    // Default to 16% of amount
                                    const amountVal = form.getFieldValue('amount') || 0;
                                    form.setFieldValue('taxAmount', amountVal * 0.16);
                                }
                            }}
                            options={[
                                { value: true, label: t('expenses.yes_with_invoice') },
                                { value: false, label: t('expenses.no_formal_note') }
                            ]}
                        />
                    </Form.Item>

                    <Form.Item
                        name="taxAmount"
                        label={t('expenses.vat_amount')}
                        dependencies={['isTaxable']}
                    >
                        <InputNumber
                            style={{ width: '150px' }}
                            min={0}
                            precision={2}
                            disabled={!form.getFieldValue('isTaxable')}
                        />
                    </Form.Item>
                    
                    <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) => prevValues.isTaxable !== currentValues.isTaxable}
                    >
                        {({ getFieldValue }) =>
                            getFieldValue('isTaxable') ? (
                                <>
                                    <Form.Item
                                        name="invoiceNumber"
                                        label={t('expenses.invoice_number')}
                                        rules={[{ required: true, message: t('expenses.required') }]}
                                    >
                                        <Input placeholder="e.g., 00123" />
                                    </Form.Item>
                                    <Form.Item
                                        name="invoiceControlNumber"
                                        label={t('expenses.control_number')}
                                        rules={[{ required: true, message: t('expenses.required') }]}
                                    >
                                        <Input placeholder="e.g., 00-00123" />
                                    </Form.Item>
                                </>
                            ) : null
                        }
                    </Form.Item>
                </Space>

                <Space style={{ display: 'flex', marginBottom: 0 }} align="start" size={16}>
                    <Form.Item
                        name="currencyId"
                        label={t('expenses.payment_currency')}
                        rules={[{ required: true }]}
                        style={{ width: '140px' }}
                    >
                        <Select
                            options={currencies.map(c => ({
                                value: c.id,
                                label: c.code
                            }))}
                            onChange={handleCurrencyChange}
                        />
                    </Form.Item>

                    <Form.Item
                        name="amount"
                        label={t('expenses.amount')}
                        rules={[{ required: true, message: t('expenses.required') }]}
                        style={{ width: '140px' }}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0.01}
                            precision={2}
                        />
                    </Form.Item>

                    <Form.Item
                        name="exchangeRate"
                        label={t('expenses.exchange_rate')}
                        rules={[{ required: true, message: t('expenses.required') }]}
                        style={{ width: '140px' }}
                        help={conversionPreview}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            min={0.0001}
                            precision={4}
                        />
                    </Form.Item>
                </Space>

                <Form.Item
                    name="date"
                    label={t('expenses.date')}
                    rules={[{ required: true, message: t('expenses.date_req') }]}
                >
                    <DatePicker style={{ width: '100%' }} />
                </Form.Item>

                <Space style={{ display: 'flex' }} align="start" size={16}>
                    <Form.Item
                        name="category"
                        label={t('expenses.category')}
                        rules={[{ required: true }]}
                        style={{ width: '220px' }}
                    >
                        <Select
                            options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: t(`expenses.categories.${c}`) }))}
                            showSearch
                        />
                    </Form.Item>

                    <Form.Item
                        name="paymentMethod"
                        label={t('expenses.payment_method')}
                        rules={[{ required: true }]}
                        style={{ width: '220px' }}
                    >
                        <Select options={PAYMENT_METHODS.map(m => ({ value: m.value, label: t(`expenses.payment_methods.${m.value}`) }))} />
                    </Form.Item>
                </Space>

                <Form.Item
                    name="bankAccountId"
                    label={settings?.requireBankAccountForPayments ? t('expenses.bank_account') : t('expenses.bank_account_optional')}
                    rules={[{ required: settings?.requireBankAccountForPayments !== false, message: t('expenses.bank_account_req') }]}
                    help={bankDeductionPreview}
                >
                    <Select
                        placeholder={t('expenses.bank_account_placeholder')}
                        allowClear
                        options={banks.map(b => ({
                            value: b.id,
                            label: `${b.bankName} - ${b.currency.code} (${b.accountNumber})`
                        }))}
                    />
                </Form.Item>

                <Form.Item
                    name="reference"
                    label={t('expenses.reference_optional')}
                >
                    <Input placeholder={t('expenses.reference_placeholder')} />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label={t('expenses.additional_notes')}
                >
                    <Input.TextArea rows={2} />
                </Form.Item>
            </Form>
        </Modal>
    );
};
