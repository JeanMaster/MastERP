
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
        if (!purchase || !paymentCurrency) return;

        if (paymentCurrency === purchase.currencyCode) {
            form.setFieldsValue({ exchangeRate: 1, paymentAmount: purchase.balance });
            setEquivalentAmount(purchase.balance);
            return;
        }

        // Find relevant rates
        const targetCurrency = currencies.find(c => c.code === paymentCurrency);
        const invoiceCurrencyObj = currencies.find(c => c.code === purchase.currencyCode);

        let newRate = 0;
        // Case A: Paying in primary (VES) for a Foreign invoice (USD, EUR, etc.)
        if (paymentCurrency === 'VES' && purchase.currencyCode !== 'VES') {
            newRate = invoiceCurrencyObj?.exchangeRate || 0;
        }
        // Case B: Paying in Foreign for a primary (VES) invoice
        else if (paymentCurrency !== 'VES' && purchase.currencyCode === 'VES') {
            newRate = targetCurrency?.exchangeRate || 0;
        }

        form.setFieldsValue({ exchangeRate: newRate });

        // Auto-calculate full payment amount
        let newAmount = purchase.balance;
        if (paymentCurrency === 'VES') newAmount = purchase.balance * newRate;
        else if (purchase.currencyCode === 'VES') newAmount = purchase.balance / newRate;
        else newAmount = purchase.balance * newRate;

        form.setFieldsValue({ paymentAmount: newAmount });
        setEquivalentAmount(purchase.balance); // The equivalent is always the original balance when auto-filled

    }, [paymentCurrency, purchase, currencies, form]);

    const handleRateChange = (value: number | null) => {
        const rate = value || 0;
        let newAmount = purchase?.balance || 0;
        
        if (purchase && paymentCurrency !== purchase.currencyCode) {
            if (paymentCurrency === 'VES') newAmount = purchase.balance * rate;
            else if (purchase.currencyCode === 'VES') newAmount = purchase.balance / rate;
            else newAmount = purchase.balance * rate;
        }
        
        form.setFieldsValue({ paymentAmount: newAmount });
        
        // Update the equivalent alert directly
        setEquivalentAmount(purchase?.balance || 0);
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
        if (!rate) return 0;

        // General logic for VES / Foreign conversions
        // We assume 'rate' is always "VES per 1 Foreign Unit" (e.g. 50 VES/USD or 55 VES/EUR)

        if (payCurr === 'VES' && invCurr !== 'VES') {
            // Case: Paying in VES for a Foreign invoice. Equivalent_Foreign = Amount_VES / Rate
            return payAmount / rate;
        }
        if (payCurr !== 'VES' && invCurr === 'VES') {
            // Case: Paying in Foreign for a VES invoice. Equivalent_VES = Amount_Foreign * Rate
            return payAmount * rate;
        }

        // Fallback: assume direct multiplier if neither is VES (less common)
        return payAmount * rate;
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
                    if (bank.currency.isPrimary) {
                        amountToDeductFromBank = values.paymentAmount * values.exchangeRate;
                    } else {
                        amountToDeductFromBank = values.paymentAmount / values.exchangeRate;
                    }
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
                        const rate = form.getFieldValue('exchangeRate') || 1;

                        if (paymentCurrency !== purchase.currencyCode) {
                            if (paymentCurrency === 'VES') {
                                amount = purchase.balance * rate;
                            } else if (purchase.currencyCode === 'VES') {
                                amount = purchase.balance / rate;
                            }
                        }

                        form.setFieldsValue({ paymentAmount: amount });
                        updateEquivalent();
                    }}
                >
                    Pagar Total: {purchase.currencyCode === 'VES' ? 'Bs' : (currencies.find(c => c.code === purchase.currencyCode)?.symbol || '')} {formatVenezuelanNumber(purchase.balance)}
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

                {paymentCurrency !== purchase.currencyCode && (
                    <Form.Item
                        label={`Tasa de Cambio (${purchase.currencyCode === 'VES' ? `${paymentCurrency}/VES` : `VES/${purchase.currencyCode}`})`}
                        name="exchangeRate"
                        rules={[{ required: true, message: 'Requerido' }]}
                        help={`Ingrese la tasa de cambio actual para ${purchase.currencyCode === 'VES' ? paymentCurrency : purchase.currencyCode}`}
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
                            if (paymentCurrency !== bank.currency.code) {
                                if (bank.currency.isPrimary) deduction *= (watchRate || 1);
                                else deduction /= (watchRate || 1);
                            }
                            return bank.balance < deduction ? 'error' : 'success';
                        })()}
                        message={(() => {
                            const bank = banks.find((b: any) => b.id === watchBankId);
                            if (!bank) return '';
                            let deduction = watchAmount || 0;
                            let currencyMsg = '';
                            if (paymentCurrency !== bank.currency.code) {
                                if (bank.currency.isPrimary) deduction *= (watchRate || 1);
                                else deduction /= (watchRate || 1);
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
