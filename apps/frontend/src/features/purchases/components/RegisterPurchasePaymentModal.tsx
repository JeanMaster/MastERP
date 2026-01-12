
import { Modal, Form, Input, InputNumber, Select, message, Divider, Alert } from 'antd';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { purchasesApi } from '../../../services/purchasesApi';
import type { Purchase } from '../../../services/purchasesApi';
import { currenciesApi } from '../../../services/currenciesApi';
import { formatVenezuelanNumber } from '../../../utils/formatters';

interface RegisterPurchasePaymentModalProps {
    open: boolean;
    purchase: Purchase | null;
    onClose: () => void;
}

export const RegisterPurchasePaymentModal = ({ open, purchase, onClose }: RegisterPurchasePaymentModalProps) => {
    const [form] = Form.useForm();
    const queryClient = useQueryClient();
    const [paymentCurrency, setPaymentCurrency] = useState<string>('');
    const [exchangeRate, setExchangeRate] = useState<number>(0);
    const [equivalentAmount, setEquivalentAmount] = useState<number>(0);

    const { data: currencies = [] } = useQuery({
        queryKey: ['currencies'],
        queryFn: currenciesApi.getAll,
        enabled: open
    });

    useEffect(() => {
        if (open && purchase) {
            form.resetFields();
            // Default payment currency to match invoice currency initially
            setPaymentCurrency(purchase.currencyCode);
            setEquivalentAmount(purchase.balance); // Initial assumption
        }
    }, [open, purchase, form]);

    // Update exchange rate when payment currency changes
    useEffect(() => {
        if (!purchase || !paymentCurrency) return;

        if (paymentCurrency === purchase.currencyCode) {
            setExchangeRate(1);
            return;
        }

        // Find relevant rates
        // Assumption 1: purchase.exchangeRate is the rate of the invoice at created time? Or current? 
        // We generally want CURRENT market rate for payment.

        // Let's rely on the `currencies` list which has current rates.
        const targetCurrency = currencies.find(c => c.code === paymentCurrency);
        const invoiceCurrencyObj = currencies.find(c => c.code === purchase.currencyCode);

        // Case A: Paying in VES for a USD invoice
        if (paymentCurrency === 'VES' && purchase.currencyCode === 'USD') {
            // Rate should be the VES rate (e.g. 50 VES/USD)
            const vesRate = targetCurrency?.exchangeRate || 0;
            setExchangeRate(vesRate);
        }
        // Case B: Paying in USD for a VES invoice (unusual but possible)
        else if (paymentCurrency === 'USD' && purchase.currencyCode === 'VES') {
            // We need USD/VES rate. If VES rate is 50, USD/VES is 1/50 = 0.02
            const vesRate = invoiceCurrencyObj?.exchangeRate || 1;
            setExchangeRate(1 / vesRate);
        }
        // Case C: Other combinations (e.g. EUR to USD) - For now keep simple
        else {
            // Fallback: If both have rates relative to base (USD), calculate cross rate
            // For now, if we can't determine, set to 1 or 0 to force user input
            // Ideally we just default to invoice currency rate if available
            setExchangeRate(0);
        }

    }, [paymentCurrency, purchase, currencies]);


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

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            // The amount we send to backend MUST be in the Purchase Currency
            // If paying in same currency, it's values.paymentAmount
            // If paying in different currency, we rely on our calculator logic
            // BUT for validation and safety, let's recalculate or use `equivalentAmount` logic

            let finalAmountInPurchaseCurrency = 0;

            if (paymentCurrency === purchase?.currencyCode) {
                finalAmountInPurchaseCurrency = values.paymentAmount;
            } else {
                // Calculator:
                // If I pay X PaymentCurrency, how much is that in InvoiceCurrency?
                // Example: Invoice USD. Paying VES. Rate = 50.
                // Paid 500 VES. 
                // Equivalent USD = 500 / 50 = 10 USD.

                // Formula depends on direction.
                if (purchase?.currencyCode === 'USD' && paymentCurrency === 'VES') {
                    finalAmountInPurchaseCurrency = values.paymentAmount / values.exchangeRate;
                } else if (purchase?.currencyCode === 'VES' && paymentCurrency === 'USD') {
                    finalAmountInPurchaseCurrency = values.paymentAmount * values.exchangeRate; // Wait.
                    // Invoice 500 VES. I pay 10 USD. Rate 50.
                    // 10 * 50 = 500 VES. Correct.
                } else {
                    // For conversion safety fallback
                    message.error('Conversión de moneda no soportada automáticamente. Verifique montos.');
                    return;
                }
            }

            if (purchase) {
                registerPaymentMutation.mutate({
                    purchaseId: purchase.id,
                    amount: finalAmountInPurchaseCurrency,
                    paymentMethod: values.paymentMethod,
                    reference: values.reference,
                    notes: values.notes ? `${values.notes} (Pagado: ${values.paymentAmount} ${paymentCurrency} Tasa: ${values.exchangeRate})` : `Pagado: ${values.paymentAmount} ${paymentCurrency} Tasa: ${values.exchangeRate}`,
                });
            }
        } catch (error) {
            console.error('Validation failed:', error);
        }
    };

    // Calculate equivalent when input changes
    const handleAmountChange = (val: number | null) => {
        const amount = val || 0;
        const rate = form.getFieldValue('exchangeRate') || 1;

        let equiv = 0;
        if (paymentCurrency === purchase?.currencyCode) {
            equiv = amount;
        } else if (purchase?.currencyCode === 'USD' && paymentCurrency === 'VES') {
            equiv = amount / rate;
        } else if (purchase?.currencyCode === 'VES' && paymentCurrency === 'USD') {
            equiv = amount * rate;
        }
        setEquivalentAmount(equiv);
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
                        {purchase.currencyCode === 'VES' ? 'Bs.' : '$'} {formatVenezuelanNumber(purchase.balance)}
                    </span>
                </p>
            </div>

            <Divider />

            <Form form={form} layout="vertical">
                <Form.Item label="Moneda de Pago">
                    <Select
                        value={paymentCurrency}
                        onChange={setPaymentCurrency}
                        options={[
                            { value: 'USD', label: 'USD ($)' },
                            { value: 'VES', label: 'Bolívares (Bs.)' },
                            // Add others if needed
                        ]}
                    />
                </Form.Item>

                {paymentCurrency !== purchase.currencyCode && (
                    <Form.Item
                        label={`Tasa de Cambio (${paymentCurrency}/${purchase.currencyCode})`}
                        name="exchangeRate"
                        initialValue={exchangeRate}
                        rules={[{ required: true, message: 'Requerido' }]}
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            precision={4}
                            onChange={() => handleAmountChange(form.getFieldValue('paymentAmount'))}
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
                        prefix={paymentCurrency === 'USD' ? '$' : (paymentCurrency === 'VES' ? 'Bs' : '')}
                        onChange={handleAmountChange}
                    />
                </Form.Item>

                {paymentCurrency !== purchase.currencyCode && (
                    <Alert
                        message={`Equivalente a abonar: ${purchase.currencyCode === 'VES' ? 'Bs.' : '$'} ${formatVenezuelanNumber(equivalentAmount)}`}
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
                        options={[
                            { value: 'CASH', label: 'Efectivo' },
                            { value: 'TRANSFER', label: 'Transferencia' },
                            { value: 'PAGO_MOVIL', label: 'Pago Móvil' },
                            { value: 'ZELLE', label: 'Zelle' },
                            { value: 'USDT', label: 'USDT (Binance)' },
                        ]}
                    />
                </Form.Item>

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
