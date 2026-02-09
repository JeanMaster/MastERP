
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
            return;
        }

        // Find relevant rates
        const targetCurrency = currencies.find(c => c.code === paymentCurrency);
        const invoiceCurrencyObj = currencies.find(c => c.code === purchase.currencyCode);

        // Case A: Paying in VES for a USD invoice
        if (paymentCurrency === 'VES' && purchase.currencyCode === 'USD') {
            // Use the VES rate (e.g., 50 VES/USD)
            const vesRate = targetCurrency?.exchangeRate || 0;
            form.setFieldsValue({ exchangeRate: vesRate });
        }
        // Case B: Paying in USD for a VES invoice
        else if (paymentCurrency === 'USD' && purchase.currencyCode === 'VES') {
            // We need USD/VES rate. If VES rate is 50, USD/VES is 1/50 = 0.02
            // However, usually users think in terms of "Rate = 50", so we might want to ask for the VES rate and invert it internally?
            // To keep it standard: Input should be "How many InvoiceUnit per PaymentUnit?" 
            // OR "How many PaymentUnit per InvoiceUnit?".
            // The field says: `Tasa de Cambio (${paymentCurrency}/${purchase.currencyCode})`
            // If Payment=USD, Invoice=VES. Tasa = USD/VES? No, usually VES/USD.
            // Let's stick to the convention: Rate is always expressed as "How many Quote per Base".
            // But here we are simple. 
            // Let's set the Rate to be: "Value of 1 PaymentUnit in terms of InvoiceUnit" *OR* vice versa?

            // Re-reading previous logic:
            // "Invoice USD. Paying VES. Rate = 50. Paid 500 VES. Equivalent = 500 / 50 = 10 USD."
            // Here Rate = VES/USD (Price of 1 USD in VES).

            // New Case: Invoice VES. Paying USD. 
            // If I pay 10 USD. Rate is 50 VES/USD.
            // Equivalent = 10 * 50 = 500 VES.

            // So in both cases, the "Rate" the user usually has in mind is the "VES/USD" rate (e.g. 50) 
            // but apply math differently?

            // However, standard `exchangeRate` field usually implies a multiplier to convert Payment -> Invoice?
            // No, in the previous code:
            // if (purchase?.currencyCode === 'USD' && paymentCurrency === 'VES') { final = amount / rate; }
            // if (purchase?.currencyCode === 'VES' && paymentCurrency === 'USD') { final = amount * rate; }

            // This implies `rate` is ALWAYS "VES per USD" (or the dominant pair rate).

            const vesRate = invoiceCurrencyObj?.exchangeRate || 1;
            // If Invoice is VES, it's the primary/base or has rate? 
            // Actually usually USD is base in this system? 
            // Let's assume `currencies` has the rate relative to USD?
            // If USD is base (rate 1), and VES is quote (rate 50).

            form.setFieldsValue({ exchangeRate: vesRate });
        }
        else {
            form.setFieldsValue({ exchangeRate: 0 });
        }

    }, [paymentCurrency, purchase, currencies, form]);


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

        // Logic based on the standard "VES Rate" (e.g. 50)
        // If dealing with VES and USD:
        if ((payCurr === 'VES' && invCurr === 'USD')) {
            return payAmount / rate;
        }
        if ((payCurr === 'USD' && invCurr === 'VES')) {
            return payAmount * rate;
        }

        // Fallback or other pairs?
        return 0;
    };

    const handleSubmit = async () => {
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

            if (purchase) {
                // Determine the "Rate to store".
                // We want to store the rate that was used. 
                // Ideally we store "1 USD = X VES".

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
                        ]}
                    />
                </Form.Item>

                {paymentCurrency !== purchase.currencyCode && (
                    <Form.Item
                        label="Tasa de Cambio (Bs/USD)"
                        name="exchangeRate"
                        rules={[{ required: true, message: 'Requerido' }]}
                        help="Ingrese la tasa de cambio actual (ej. 50.00)"
                    >
                        <InputNumber
                            style={{ width: '100%' }}
                            precision={4}
                            onChange={updateEquivalent}
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
                        onChange={updateEquivalent}
                    />
                </Form.Item>

                {paymentCurrency !== purchase.currencyCode && (
                    <Alert
                        message={
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span>Equivalente en factura:</span>
                                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>
                                    {purchase.currencyCode === 'VES' ? 'Bs.' : '$'} {formatVenezuelanNumber(equivalentAmount)}
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
