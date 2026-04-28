import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, App, Row, Col, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Invoice } from '../../../services/invoicesApi';
import { paymentsApi } from '../../../services/paymentsApi';
import { usePOSStore } from '../../../store/posStore';
import { formatVenezuelanPrice } from '../../../utils/formatters';

const { Text } = Typography;

interface RegisterPaymentModalProps {
    visible: boolean;
    invoice: Invoice | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const RegisterPaymentModal: React.FC<RegisterPaymentModalProps> = ({
    visible,
    invoice,
    onClose,
    onSuccess,
}) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const { message } = App.useApp();
    const [paymentAmount, setPaymentAmount] = useState<number | null>(null);

    // Get currencies from POS store
    const { currencies, primaryCurrency } = usePOSStore();
    const foreignCurrencies = currencies.filter(c => !c.isPrimary && c.active);

    useEffect(() => {
        if (visible && invoice) {
            setPaymentAmount(Number(invoice.balance));
            form.resetFields();
        }
    }, [visible, invoice, form]);

    const handlePayment = async (method: string, currencyCode?: string) => {
        if (!invoice || !paymentAmount || paymentAmount <= 0) {
            message.error(t('accounts_receivable.messages.invalid_amount'));
            return;
        }

        if (paymentAmount > Number(invoice.balance)) {
            message.error(t('accounts_receivable.messages.exceeds_balance'));
            return;
        }

        try {
            // Build payment method string (like POS does)
            let paymentMethodStr = method;
            if (currencyCode) {
                paymentMethodStr = `CURRENCY_${currencyCode}`;
            }

            await paymentsApi.createPayment({
                invoiceId: invoice.id,
                amount: paymentAmount,
                paymentMethod: paymentMethodStr,
                reference: form.getFieldValue('reference'),
                notes: form.getFieldValue('notes'),
            });

            message.success(t('accounts_receivable.messages.success'));
            form.resetFields();
            setPaymentAmount(null);
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || t('accounts_receivable.messages.error'));
        }
    };

    const bsPaymentMethods = [
        { key: 'CASH', label: t('pos.checkout.cash'), emoji: '💵' },
        { key: 'DEBIT', label: t('pos.checkout.debit_card'), emoji: '💳' },
        { key: 'CARD_CREDIT', label: t('pos.checkout.credit_card'), emoji: '💳' },
        { key: 'MOBILE', label: t('pos.checkout.mobile_pay'), emoji: '📱' },
        { key: 'TRANSFER', label: t('pos.checkout.transfer'), emoji: '🏦' },
    ];

    return (
        <Modal
            title={t('accounts_receivable.register_payment')}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={700}
        >
            {invoice && (
                <>
                    {/* Invoice Summary */}
                    <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                        <p style={{ margin: 0 }}><strong>{t('common.customer') || 'Customer'}:</strong> {invoice.client?.name}</p>
                        <p style={{ margin: 0 }}><strong>{t('common.invoice')}:</strong> {invoice.number}</p>
                        <p style={{ margin: 0 }}><strong>{t('common.total')}:</strong> {invoice.currencyCode === 'VES' ? 'Bs' : invoice.currencyCode}. {Number(invoice.total).toFixed(2)}</p>
                        <p style={{ margin: 0 }}><strong>{t('common.paid') || 'Paid'}:</strong> {invoice.currencyCode === 'VES' ? 'Bs' : invoice.currencyCode}. {Number(invoice.paidAmount).toFixed(2)}</p>
                        <p style={{ margin: 0, color: '#ff4d4f', fontSize: 16 }}>
                            <strong>{t('common.balance')}:</strong> {invoice.currencyCode === 'VES' ? 'Bs' : invoice.currencyCode}. {Number(invoice.balance).toFixed(2)}
                        </p>
                    </div>

                    <Form form={form} layout="vertical">
                        {/* Amount Input */}
                            <Form.Item label={`${t('accounts_receivable.amount_to_pay')} (${invoice.currencyCode})`}>
                            <InputNumber
                                style={{ width: '100%' }}
                                size="large"
                                value={paymentAmount}
                                onChange={setPaymentAmount}
                                min={0}
                                max={Number(invoice.balance)}
                                precision={2}
                                prefix={invoice.currencyCode === 'VES' ? 'Bs' : invoice.currencyCode}
                                placeholder="0.00"
                            />
                            {invoice.currencyCode !== 'VES' && (
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {t('accounts_receivable.frozen_rate')}: {formatVenezuelanPrice(invoice.exchangeRate)} Bs/USD
                                </Text>
                            )}
                        </Form.Item>

                        {/* Bs Payment Methods */}
                        <div style={{ marginBottom: 16 }}>
                            <Text strong>{t('accounts_receivable.payments_in', { currency: primaryCurrency?.name || 'Bolívares' })}</Text>
                            <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                                {bsPaymentMethods.map(method => (
                                    <Col span={8} key={method.key}>
                                        <Button
                                            block
                                            size="large"
                                            onClick={() => handlePayment(method.key)}
                                            disabled={!paymentAmount || paymentAmount <= 0}
                                            style={{
                                                height: 70,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <div style={{ fontSize: 24 }}>{method.emoji}</div>
                                            <div style={{ fontSize: 12 }}>{method.label}</div>
                                        </Button>
                                    </Col>
                                ))}
                            </Row>
                        </div>

                        {/* Foreign Currency Payments */}
                        {foreignCurrencies.length > 0 && (
                            <div style={{ marginBottom: 16 }}>
                                <Text strong>{t('accounts_receivable.foreign_currency_payments')}</Text>
                                <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                                    {foreignCurrencies.map(currency => (
                                        <Col span={8} key={currency.id}>
                                            <Button
                                                block
                                                size="large"
                                                onClick={() => handlePayment('CURRENCY', currency.code)}
                                                disabled={!paymentAmount || paymentAmount <= 0}
                                                style={{
                                                    height: 70,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <div style={{ fontSize: 24 }}>{currency.symbol}</div>
                                                <div style={{ fontSize: 12 }}>{currency.name}</div>
                                            </Button>
                                        </Col>
                                    ))}
                                </Row>
                            </div>
                        )}

                        {/* Reference and Notes */}
                        <Form.Item label={t('common.reference')} name="reference">
                            <Input placeholder="Ej: Ref. 123456789" />
                        </Form.Item>

                        <Form.Item label={t('common.notes')} name="notes">
                            <Input.TextArea rows={2} placeholder="Notas adicionales (opcional)" />
                        </Form.Item>
                    </Form>
                </>
            )}
        </Modal>
    );
};
