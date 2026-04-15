
import { Modal, Form, Input, InputNumber, Select, message, Divider, Alert, Button } from 'antd';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { purchasesApi } from '../../../services/purchasesApi';
import type { Purchase } from '../../../services/purchasesApi';
import { currenciesApi } from '../../../services/currenciesApi';
import { banksApi } from '../../../services/banksApi';
import { companySettingsApi } from '../../../services/companySettingsApi';
import { formatVenezuelanNumber, formatVenezuelanPrice } from '../../../utils/formatters';

interface RegisterPurchasePaymentModalProps {
    open: boolean;
    purchase: Purchase | null;
    onClose: () => void;
}

export const RegisterPurchasePaymentModal = ({ open, purchase, onClose }: RegisterPurchasePaymentModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const [paymentCurrency, setPaymentCurrency] = useState<string>('');
    const [equivalentAmount, setEquivalentAmount] = useState<number>(0);

    const { data: currencies = [] } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
        enabled: open
    });

    const { data: banks = [] } = useQuery<any[]>({
        queryKey: ['banks'],
        queryFn: () => banksApi.getAll(),
        enabled: open
    });

    const { data: settings } = useQuery({
        queryKey: ['company-settings'],
        queryFn: companySettingsApi.getSettings,
        enabled: open
    });

    const watchBankId = Form.useWatch('bankAccountId', form);
    const watchAmount = Form.useWatch('paymentAmount', form);
    const watchRate = Form.useWatch('exchangeRate', form);
    const watchPaymentMethod = Form.useWatch('paymentMethod', form);

    const primaryCurrency = currencies.find(c => c.isPrimary);
    const primaryCode = primaryCurrency?.code || 'VES';

    useEffect(() => {
        if (open && purchase) {
            form.resetFields();
            // Default payment currency to match invoice currency initially
            setPaymentCurrency(purchase.currencyCode);
            setEquivalentAmount(purchase.balance); // Initial assumption
            form.setFieldsValue({
                paymentAmount: purchase.balance,
                exchangeRate: purchase.exchangeRate || 1
            });
        }
    }, [open, purchase, form]);

    // Update exchange rate and auto-fill paymentAmount when currency changes
    useEffect(() => {
        if (!purchase || !paymentCurrency || currencies.length === 0) return;

        // 1. Identify Currencies and Primary Currency
        const targetCurrency = currencies.find(c => c.code === paymentCurrency);
        const invoiceCurrencyObj = currencies.find(c => c.code === purchase.currencyCode);
        const primaryCurrency = currencies.find(c => c.isPrimary);
        
        if (!primaryCurrency) return;

        const primaryCode = primaryCurrency.code;
        const targetRate = Number(targetCurrency?.exchangeRate || 1);
        const invoiceRate = Number(invoiceCurrencyObj?.exchangeRate || purchase.exchangeRate || 1);

        // Always use Target/Primary rate as the reference for the form
        // (Unless it's the primary itself, then it's 1)
        const newRate = targetRate;
        let newAmount = purchase.balance;

        // If currencies are different, calculate the suggested amount
        if (paymentCurrency !== purchase.currencyCode) {
            // Formula: Amount_Target = (Amount_Invoice * Rate_Invoice) / Rate_Target
            // Both rates are relative to Primary.
            // If invoice is Primary, its rate is 1. If payment is Primary, its rate is 1.
            const invRateForCalc = purchase.currencyCode === primaryCode ? 1 : invoiceRate;
            const payRateForCalc = paymentCurrency === primaryCode ? 1 : targetRate;

            newAmount = payRateForCalc > 0 ? (purchase.balance * invRateForCalc) / payRateForCalc : 0;
        }

        form.setFieldsValue({ exchangeRate: newRate, paymentAmount: newAmount });
        setEquivalentAmount(purchase.balance);

    }, [paymentCurrency, purchase, currencies, form]);

    const handleRateChange = (value: number | null) => {
        const rate = value || 0;
        if (!purchase || !paymentCurrency || currencies.length === 0) return;

        const primaryCurrency = currencies.find(c => c.isPrimary);
        const primaryCode = primaryCurrency?.code || 'VES';

        // Recalculate equivalent payment amount
        const invoiceCurrencyObj = currencies.find(c => c.code === purchase.currencyCode);
        const invoiceRate = Number(invoiceCurrencyObj?.exchangeRate || purchase.exchangeRate || 1);
        const invRateForCalc = purchase.currencyCode === primaryCode ? 1 : invoiceRate;

        // The 'rate' is always Payment/Primary.
        // Amount_Pay = (Balance_Inv * Rate_Inv) / rate
        const newAmount = rate > 0 ? (purchase.balance * invRateForCalc) / rate : 0;

        form.setFieldsValue({ paymentAmount: newAmount });
        setEquivalentAmount(purchase.balance);
    };


    const registerPaymentMutation = useMutation({
        mutationFn: purchasesApi.registerPayment,
        onSuccess: () => {
            message.success('Pago registrado exitosamente');
            queryClient.invalidateQueries({ queryKey: ['purchases'] });
            onClose();
            form.resetFields();
        },
        onError: (error: any) => {
            message.error(error.response?.data?.message || 'Error al registrar pago');
        },
    });

    const calculateEquivalent = (payAmount: number, rate: number, payCurr: string, invCurr: string): number => {
        if (payCurr === invCurr) return payAmount;
        if (!rate || currencies.length === 0) return 0;

        const primaryCurrency = currencies.find(c => c.isPrimary);
        const primaryCode = primaryCurrency?.code || 'VES';
        const invoiceCurrencyObj = currencies.find(c => c.code === invCurr);
        const invoiceRate = Number(invoiceCurrencyObj?.exchangeRate || purchase?.exchangeRate || 1);

        const invRateForCalc = invCurr === primaryCode ? 1 : invoiceRate;
        const payRateForCalc = payCurr === primaryCode ? 1 : rate;

        // Bridge Logic: (Amount_Pay * Rate_Pay) / Rate_Inv
        return (payAmount * payRateForCalc) / invRateForCalc;
    };

    const handleSubmit = async () => {
        if (!purchase) return;
        try {
            const values = await form.validateFields();

            // If paying in same currency, strict equality
            let finalAmountInPurchaseCurrency = values.paymentAmount;

            if (paymentCurrency !== purchase?.currencyCode) {
                finalAmountInPurchaseCurrency = calculateEquivalent(
                    values.paymentAmount,
                    values.exchangeRate,
                    paymentCurrency,
                    purchase?.currencyCode || ''
                );

                if (finalAmountInPurchaseCurrency === 0) {
                    message.error('Error calculando la conversión. Verifique la tasa.');
                    return;
                }
            }

            // Calculate bank deduction for validation
            let amountToDeductFromBank = values.paymentAmount;
            if (values.bankAccountId) {
                const bank = banks.find(b => b.id === values.bankAccountId);
                if (bank && paymentCurrency !== bank.currency.code) {
                    const primaryCurrency = currencies.find(c => c.isPrimary);
                    const primaryCode = primaryCurrency?.code || 'VES';

                    // Standard conversion rates relative to Primary
                    const payRateForCalc = paymentCurrency === primaryCode ? 1 : (values.exchangeRate || 1);
                    const bankRateForCalc = bank.currency.code === primaryCode ? 1 : Number(bank.currency.exchangeRate || 1);

                    // Multi-currency rule: (Amount_Pay * Rate_Pay) / Rate_Bank
                    amountToDeductFromBank = (values.paymentAmount * payRateForCalc) / bankRateForCalc;
                } else if (bank && paymentCurrency === bank.currency.code) {
                    // DIRECT DEDUCTION RULE: 1:1 if currencies match
                    amountToDeductFromBank = values.paymentAmount;
                }

                if (bank && bank.balance < amountToDeductFromBank) {
                    message.error(`Saldo insuficiente en ${bank.bankName}. Disponible: ${formatVenezuelanPrice(bank.balance, bank.currency.symbol)}`);
                    return;
                }
            }

            registerPaymentMutation.mutate({
                purchaseId: purchase.id,
                amount: finalAmountInPurchaseCurrency,
                paymentAmount: values.paymentAmount,
                currencyCode: paymentCurrency,
                exchangeRate: values.exchangeRate || 1,
                paymentMethod: values.paymentMethod,
                bankAccountId: values.bankAccountId,
                reference: values.reference,
                notes: values.notes,
            });
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    // Triggered when Amount or Rate changes
    const updateEquivalent = () => {
        const amount = form.getFieldValue('paymentAmount') || 0;
        const rate = form.getFieldValue('exchangeRate') || 0;

        if (purchase) {
            const equiv = calculateEquivalent(amount, rate, paymentCurrency, purchase.currencyCode);
            setEquivalentAmount(equiv);
        }
    };

    if (!purchase) return null;

    return (
        <Modal
            title="Registrar Pago a Proveedor"
            open={open}
            onOk={handleSubmit}
            onCancel={onClose}
            confirmLoading={registerPaymentMutation.isPending}
            okText="Registrar Pago"
            cancelText="Cancelar"
        >
            <div style={{ marginBottom: 16 }}>
                <p><strong>Proveedor:</strong> {purchase.supplier.comercialName}</p>
                <p><strong>Factura:</strong> {purchase.invoiceNumber || 'N/A'}</p>
                <p>
                    <strong>Saldo Pendiente:</strong>
                    <span style={{ color: 'red', marginLeft: 8, fontSize: '16px', fontWeight: 'bold' }}>
                        {currencies.find(c => c.code === purchase.currencyCode)?.symbol || ''} {formatVenezuelanNumber(purchase.balance)}
                    </span>
                </p>
            </div>

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <Button
                    size="small"
                    type="dashed"
                    onClick={() => {
                        let amount = purchase.balance;
                        const primaryCurrency = currencies.find(c => c.isPrimary);
                        const primaryCode = primaryCurrency?.code || 'VES';

                        if (paymentCurrency !== purchase.currencyCode) {
                            const invoiceCurrencyObj = currencies.find(c => c.code === purchase.currencyCode);
                            const invoiceRate = Number(invoiceCurrencyObj?.exchangeRate || purchase.exchangeRate || 1);
                            
                            const invRateForCalc = purchase.currencyCode === primaryCode ? 1 : invoiceRate;
                            const payRateForCalc = paymentCurrency === primaryCode ? 1 : (form.getFieldValue('exchangeRate') || 1);

                            amount = (purchase.balance * invRateForCalc) / payRateForCalc;
                        }

                        form.setFieldsValue({ paymentAmount: amount });
                        updateEquivalent();
                    }}
                >
                    Pagar Total: {purchase.currencyCode === primaryCode ? 'Bs.' : (currencies.find(c => c.code === purchase.currencyCode)?.symbol || '')} {formatVenezuelanNumber(purchase.balance)}
                </Button>
            </div>

            <Form form={form} layout="vertical">
                <Form.Item label="Moneda de Pago">
                    <Select
                        value={paymentCurrency}
                        onChange={setPaymentCurrency}
                        options={currencies.map((c: any) => ({
                            value: c.code,
                            label: `${c.name} (${c.symbol})`
                        }))}
                    />
                </Form.Item>

                {paymentCurrency !== (currencies.find(c => c.isPrimary)?.code || 'VES') && (
                    <Form.Item
                        label={`Tasa Pactada (BS / ${paymentCurrency})`}
                        name="exchangeRate"
                        rules={[{ required: true, message: 'Requerido' }]}
                        help={`Valor de 1 ${paymentCurrency} acordado para este pago`}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            precision={4}
                            onChange={handleRateChange}
                        />
                    </Form.Item>
                )}

                <Form.Item
                    label={`Monto a Pagar (${paymentCurrency})`}
                    name="paymentAmount"
                    rules={[
                        { required: true, message: 'Requerido' },
                        { type: 'number', min: 0.01, message: 'Debe ser mayor a 0' },
                    ]}
                >
                    <InputNumber
                        style={{ width: '100%' }}
                        precision={2}
                        prefix={currencies.find(c => c.code === paymentCurrency)?.symbol || ''}
                        onChange={updateEquivalent}
                    />
                </Form.Item>

                {paymentCurrency !== purchase.currencyCode && (
                    <Alert
                        message={
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>Equivalente en factura:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                                    {currencies.find(c => c.code === purchase.currencyCode)?.symbol || ''} {formatVenezuelanNumber(equivalentAmount)}
                                </span>
                            </div>
                        }
                        type="info"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Form.Item
                    label="Método de Pago"
                    name="paymentMethod"
                    rules={[{ required: true, message: 'Requerido' }]}
                    initialValue="TRANSFER"
                >
                    <Select
                        onChange={() => form.setFieldValue('bankAccountId', undefined)}
                        options={[
                            { value: 'CASH', label: 'Efectivo' },
                            { value: 'TRANSFER', label: 'Transferencia' },
                            { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
                            { value: 'ZELLE', label: 'Zelle' },
                            { value: 'USDT', label: 'USDT (Binance)' },
                        ]}
                    />
                </Form.Item>

                {['TRANSFER', 'PAGO_MOVIL', 'ZELLE', 'USDT'].includes(watchPaymentMethod) && (
                    <Form.Item
                        label="Cuenta Bancaria / Tesorería"
                        name="bankAccountId"
                        rules={[{ required: settings?.requireBankAccountForPayments !== false, message: 'Seleccione una cuenta' }]}
                    >
                        <Select
                            placeholder="Seleccione cuenta"
                            options={banks.map((b: any) => ({
                                value: b.id,
                                label: `${b.bankName} (${b.currency.code}) - Saldo: ${formatVenezuelanPrice(b.balance, b.currency.symbol)}`
                            }))}
                        />
                    </Form.Item>
                )}

                {watchBankId && (
                    <Alert
                        style={{ marginBottom: 16 }}
                        type={(() => {
                            const bank = banks.find((b: any) => b.id === watchBankId);
                            if (!bank) return 'info';

                            let deduction = watchAmount || 0;
                            const isDirectDeduction = bank.currency.code === paymentCurrency;

                            if (!isDirectDeduction) {
                                const primaryCurrency = currencies.find(c => c.isPrimary);
                                const primaryCode = primaryCurrency?.code || 'VES';
                                const bankRate = Number(bank.currency.exchangeRate || 1); 

                                const payRateForCalc = paymentCurrency === primaryCode ? 1 : (watchRate || 1);
                                const bankRateForCalc = bank.currency.code === primaryCode ? 1 : bankRate;

                                // Deduct = (Amount * Rate_Pay) / Rate_Bank
                                deduction = (deduction * payRateForCalc) / bankRateForCalc;
                            }
                            return bank.balance < deduction ? 'error' : 'success';
                        })()}
                        message={(() => {
                            const bank = banks.find((b: any) => b.id === watchBankId);
                            if (!bank) return '';
                            let deduction = watchAmount || 0;
                            let currencyMsg = '';
                            const isDirectDeduction = bank.currency.code === paymentCurrency;

                            if (!isDirectDeduction) {
                                const primaryCurrency = currencies.find(c => c.isPrimary);
                                const primaryCode = primaryCurrency?.code || 'VES';
                                const bankRate = Number(bank.currency.exchangeRate || 1);

                                const payRateForCalc = paymentCurrency === primaryCode ? 1 : (watchRate || 1);
                                const bankRateForCalc = bank.currency.code === primaryCode ? 1 : bankRate;

                                deduction = (deduction * payRateForCalc) / bankRateForCalc;
                                currencyMsg = ` (Conv. a ${bank.currency.code})`;
                            }
                            return (
                                <div>
                                    <div>Saldo en cuenta: <strong>{formatVenezuelanPrice(bank.balance, bank.currency.symbol)}</strong></div>
                                    <div>A descontar: <strong>{formatVenezuelanPrice(deduction, bank.currency.symbol)}</strong>{currencyMsg}</div>
                                </div>
                            );
                        })()}
                        showIcon
                    />
                )}

                <Form.Item label="Referencia / Comprobante" name="reference">
                    <Input placeholder="Ej: 123456" />
                </Form.Item>

                <Form.Item label="Notas" name="notes">
                    <Input.TextArea rows={2} />
                </Form.Item>
            </Form>
        </Modal>
    );
};
