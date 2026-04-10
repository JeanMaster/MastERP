
import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, Select, message, Space } from 'antd';
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
    'SERVICIOS',
    'NOMINA',
    'MANTENIMIENTO',
    'ALQUILER',
    'PROVEEDORES',
    'TRANSPORTE',
    'MARKETING',
    'IMPUESTOS',
    'OTROS'
];

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Efectivo' },
    { value: 'TRANSFER', label: 'Transferencia' },
    { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
    { value: 'DEBIT', label: 'Tarjeta Débito' },
    { value: 'CREDIT', label: 'Tarjeta Crédito' },
    { value: 'ZELLE', label: 'Zelle' },
    { value: 'USDT', label: 'USDT (Binance)' },
];

export const CreateExpenseModal = ({ open, onCancel, expense }: CreateExpenseModalProps) => {
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

    // Set default values when modal opens
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
                });
            } else if (currencies.length > 0) {
                // Create Mode: Set Defaults
                form.resetFields();

                // Default to USD usually if available, or Primary
                const primary = currencies.find(c => c.isPrimary);

                // Try to set USD as default if primary is VES, because user said options are usually USD
                const usd = currencies.find(c => c.code === 'USD');
                const defaultCurrency = usd || primary || currencies[0];

                form.setFieldValue('currencyId', defaultCurrency.id);

                // Set Exchange Rate: Always attempt to set the USD Rate (Secondary)
                const usdCurrency = currencies.find(c => c.code === 'USD');
                if (usdCurrency) {
                    form.setFieldValue('exchangeRate', usdCurrency.exchangeRate || 1);
                } else {
                    form.setFieldValue('exchangeRate', 1);
                }

                // Set other defaults
                form.setFieldsValue({
                    date: dayjs(),
                    paymentMethod: 'CASH',
                    category: 'OTROS'
                });
            }
        }
    }, [open, expense, currencies, form]);

    const handleCurrencyChange = () => {
        // Do nothing to the rate. Preserve the manually entered or default system rate.
    };

    const createExpenseMutation = useMutation({
        mutationFn: expensesApi.create,
        onSuccess: () => {
            message.success('Gasto registrado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            form.resetFields();
            onCancel();
        },
        onError: (error) => {
            message.error('Error al registrar el gasto');
            console.error(error);
        }
    });

    const updateExpenseMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateExpenseDto }) => expensesApi.update(id, data),
        onSuccess: () => {
            message.success('Gasto actualizado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['expenses'] });
            form.resetFields();
            onCancel();
        },
        onError: (error) => {
            message.error('Error al actualizar el gasto');
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

    // Calculate equivalent
    const selectedCurrencyObj = currencies.find(c => c.id === selectedCurrencyId);
    let conversionPreview = null;

    if (selectedCurrencyObj && amount && exchangeRate) {
        if (selectedCurrencyObj.isPrimary) {
            const secondary = currencies.find(c => !c.isPrimary);
            if (secondary) {
                const usdAmount = amount / exchangeRate;
                conversionPreview = `Equivalente en Divisa: ${formatVenezuelanPrice(usdAmount, '$')}`;
            }
        } else {
            const vesAmount = amount * exchangeRate;
            conversionPreview = `Equivalente en Bs: ${formatVenezuelanPrice(vesAmount, 'Bs.')}`;
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
        bankDeductionPreview = `Se descontarán ${formatVenezuelanPrice(deductionAmount, selectedBank.currency.symbol)} de la cuenta.`;
    }

    return (
        <Modal
            title={expense ? "Editar Gasto" : "Registrar Nuevo Gasto"}
            open={open}
            onCancel={onCancel}
            onOk={() => form.submit()}
            confirmLoading={loading}
            okText={expense ? "Guardar Cambios" : "Registrar"}
            cancelText="Cancelar"
            width={600}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
            >
                <Form.Item
                    name="description"
                    label="Descripción del Gasto"
                    rules={[{ required: true, message: 'La descripción es obligatoria' }]}
                >
                    <Input placeholder="Ej. Pago servicio internet" autoFocus />
                </Form.Item>

                <Space style={{ display: 'flex', marginBottom: 16 }} align="start" size={16}>
                    <Form.Item
                        name="isTaxable"
                        label="¿Es Gasto Fiscal (IVA)?"
                        valuePropName="checked"
                    >
                        <Select
                            placeholder="Fiscal?"
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
                                { value: true, label: 'Sí (Con Factura)' },
                                { value: false, label: 'No (Formal/Nota)' }
                            ]}
                        />
                    </Form.Item>

                    <Form.Item
                        name="taxAmount"
                        label="Monto del IVA"
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
                                        label="Número Factura"
                                        rules={[{ required: true, message: 'Requerido' }]}
                                    >
                                        <Input placeholder="Ej. 00123" />
                                    </Form.Item>
                                    <Form.Item
                                        name="invoiceControlNumber"
                                        label="Número Control"
                                        rules={[{ required: true, message: 'Requerido' }]}
                                    >
                                        <Input placeholder="Ej. 00-00123" />
                                    </Form.Item>
                                </>
                            ) : null
                        }
                    </Form.Item>
                </Space>

                <Space style={{ display: 'flex', marginBottom: 0 }} align="start" size={16}>
                    <Form.Item
                        name="currencyId"
                        label="Moneda de Pago"
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
                        label="Monto"
                        rules={[{ required: true, message: 'Requerido' }]}
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
                        label="Tasa de Cambio"
                        rules={[{ required: true, message: 'Requerido' }]}
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
                    label="Fecha"
                    rules={[{ required: true, message: 'Seleccione la fecha' }]}
                >
                    <DatePicker style={{ width: '100%' }} />
                </Form.Item>

                <Space style={{ display: 'flex' }} align="start" size={16}>
                    <Form.Item
                        name="category"
                        label="Categoría"
                        rules={[{ required: true }]}
                        style={{ width: '220px' }}
                    >
                        <Select
                            options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
                            showSearch
                        />
                    </Form.Item>

                    <Form.Item
                        name="paymentMethod"
                        label="Método de Pago"
                        rules={[{ required: true }]}
                        style={{ width: '220px' }}
                    >
                        <Select options={PAYMENT_METHODS} />
                    </Form.Item>
                </Space>

                <Form.Item
                    name="bankAccountId"
                    label={settings?.requireBankAccountForPayments ? "Cuenta Bancaria / Tesorería" : "Cuenta Bancaria / Tesorería (Opcional)"}
                    rules={[{ required: settings?.requireBankAccountForPayments !== false, message: 'Seleccione una cuenta' }]}
                    help={bankDeductionPreview}
                >
                    <Select
                        placeholder="Seleccione cuenta bancaria (Transferencias, Pago Móvil, etc.)"
                        allowClear
                        options={banks.map(b => ({
                            value: b.id,
                            label: `${b.bankName} - ${b.currency.code} (${b.accountNumber})`
                        }))}
                    />
                </Form.Item>

                <Form.Item
                    name="reference"
                    label="Número de Referencia (Opcional)"
                >
                    <Input placeholder="Ej. 12345678" />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label="Notas Adicionales"
                >
                    <Input.TextArea rows={2} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

