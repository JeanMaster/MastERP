import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Row, Col, Typography, Table, InputNumber, Space, Card, Divider, Switch, Input } from 'antd';
import {
    DollarOutlined,
    CreditCardOutlined,
    BankOutlined,
    MobileOutlined,
    DeleteOutlined,
    CheckCircleOutlined,
    FileTextOutlined,
    GiftOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { banksApi } from '../../../services/banksApi';
import { usePOSStore } from '../../../store/posStore';
import { formatVenezuelanPrice, formatVenezuelanPriceOnly } from '../../../utils/formatters';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

interface PaymentEntry {
    id: string;
    method: string;
    methodLabel: string;
    amount: number; // Base currency amount
    currencySymbol: string;
    originalAmount?: number;
    originalCurrency?: string;
    originalCurrencyId?: string;
    bankId?: string;
    bankName?: string;
}

interface CheckoutModalProps {
    open: boolean;
    onCancel: () => void;
    onProcess: (paymentData: any) => Promise<void> | void;
}

/**
 * CheckoutModal Component
 * Handles the final step of the sale: selecting payment methods and finalizing the transaction.
 * Supports split payments, foreign currency, loyalty points, and tax retentions.
 */
export const CheckoutModal = ({ open, onCancel, onProcess }: CheckoutModalProps): React.ReactElement => {
    const { t } = useTranslation();
    const {
        totals,
        preferredSecondaryCurrency,
        currencies,
        primaryCurrency,
        activeCustomer,
        customerId,
        nextInvoiceNumber,
        reservedInvoiceNumber,
        taxEnabled,
        taxRate,
        igtfEnabled,
        igtfRate,
        customerPoints,
        customerPointsValueUsd,
        pointsRate
    } = usePOSStore();

    const amountInputRef = useRef<any>(null);

    const [payments, setPayments] = useState<PaymentEntry[]>([]);
    const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
    const [inputAmount, setInputAmount] = useState<number | null>(null);
    const [, setSelectedMethod] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [creditCurrencyId, setCreditCurrencyId] = useState<string | null>(null);
    const [applyIGTF, setApplyIGTF] = useState(true);

    // Calculate IGTF tax (e.g., 3%) based on foreign currency payments
    const totalIGTF = (applyIGTF && igtfEnabled) ? payments.reduce((sum, p) => {
        if (p.originalCurrencyId && p.originalCurrencyId !== primaryCurrency?.id) {
            return sum + (p.amount * (igtfRate / 100));
        }
        return sum;
    }, 0) : 0;

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, (totals.total + totalIGTF) - totalPaid);
    const isFullyPaid = remaining < 0.01;

    useEffect(() => {
        if (open) {
            setPayments([]);
            setSelectedPaymentId(null);
            setInputAmount(totals.total);
            setSelectedMethod(null);
            setCreditCurrencyId(primaryCurrency?.id || null);
            setApplyIGTF(igtfEnabled);
            setRetentionModalOpen(false);
            setRetentionVoucher('');
        }
    }, [open, primaryCurrency, igtfEnabled, totals.total]);

    const { data: banks = [] } = useQuery({
        queryKey: ['banks'],
        queryFn: () => banksApi.getAll(),
        enabled: open
    });

    const mobilePaymentBanks = banks.filter(b => b.active && b.receivesMobilePayment);
    const [bankSelectorOpen, setBankSelectorOpen] = useState(false);
    const [retentionModalOpen, setRetentionModalOpen] = useState(false);
    const [retentionVoucher, setRetentionVoucher] = useState('');

    const foreignCurrencies = currencies.filter(c => !c.isPrimary && c.active);

    useEffect(() => {
        if (open && amountInputRef.current) {
            const timer = setTimeout(() => {
                if (amountInputRef.current && amountInputRef.current.focus) {
                    amountInputRef.current.focus();
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [open]);

    // Keyboard Shortcuts Logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;

            const modalKeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'Escape'];
            const isCtrlFn = e.ctrlKey && ['F9', 'F10', 'F11', 'F12'].includes(e.key);

            if (modalKeys.includes(e.key) || isCtrlFn) {
                e.stopPropagation();
                e.preventDefault();

                if (e.key === 'F1' && inputAmount) {
                    addPayment('CASH', `F1 ${t('pos.checkout.base_currency')} ${t('pos.checkout.cash') || 'Efectivo'}`);
                } else if (e.key === 'F2' && inputAmount) {
                    addPayment('DEBIT', `F2 ${t('pos.checkout.debit') || 'Débito'}`);
                } else if (e.key === 'F3' && inputAmount) {
                    addPayment('CARD_CREDIT', `F3 ${t('pos.checkout.credit') || 'Crédito'}`);
                } else if (e.key === 'F4' && inputAmount) {
                    if (mobilePaymentBanks.length > 0) {
                        setBankSelectorOpen(true);
                    } else {
                        addPayment('MOBILE', `F4 ${t('pos.checkout.mobile_pay') || 'Pago Móvil'}`);
                    }
                } else if (e.key === 'F5' && inputAmount) {
                    addPayment('TRANSFER', `F5 ${t('pos.checkout.transfer') || 'Transferencia'}`);
                } else if (e.key === 'F7' && inputAmount) {
                    handleRetentionClick();
                } else if (e.key === 'F8' && inputAmount) {
                    if (!customerId) return;
                    addPayment('ACCOUNT_CREDIT', `F8 ${t('pos.checkout.store_credit') || 'Crédito Tienda'}`, creditCurrencyId || undefined);
                } else if (e.key === 'F10' && inputAmount) {
                    if (customerPoints > 0) {
                        handlePointsRedeem();
                    }
                } else if (e.key === 'F6' && payments.length > 0) {
                    if (selectedPaymentId) {
                        removePayment(selectedPaymentId);
                    } else {
                        const lastPayment = payments.reduce((latest, current) =>
                            parseInt(current.id) > parseInt(latest.id) ? current : latest
                        );
                        removePayment(lastPayment.id);
                    }
                } else if (e.ctrlKey && e.key === 'F9' && inputAmount && foreignCurrencies.length > 0) {
                    const currency = foreignCurrencies[0];
                    if (currency) addPayment(`CURRENCY_${currency.code}`, `CT+F9 ${currency.name}`, currency.id);
                } else if (e.ctrlKey && e.key === 'F10' && inputAmount && foreignCurrencies.length > 1) {
                    const currency = foreignCurrencies[1];
                    if (currency) addPayment(`CURRENCY_${currency.code}`, `CT+F10 ${currency.name}`, currency.id);
                } else if (e.key === 'F9' && isFullyPaid) {
                    handleProcessSale();
                } else if (e.key === 'Escape') {
                    onCancel();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [open, selectedPaymentId, isFullyPaid, payments, inputAmount, primaryCurrency, currencies, customerId, mobilePaymentBanks, creditCurrencyId, foreignCurrencies, totals.total, onCancel, t]);

    const addPayment = (method: string, methodLabel: string, currencyId?: string, amountOverrideInPrimary?: number, bankData?: { id: string, name: string }) => {
        const rawInput = amountOverrideInPrimary !== undefined ? amountOverrideInPrimary : (inputAmount || 0);
        if (rawInput <= 0 || isFullyPaid) return;

        let amountInBs = 0;
        let originalAmount = 0;
        let originalCurrency = primaryCurrency?.symbol || 'Bs';
        let currencySymbol = primaryCurrency?.symbol || 'Bs';

        const currency = currencyId ? currencies.find(c => c.id === currencyId) : null;
        const isForeign = currency && currency.id !== primaryCurrency?.id;

        if (amountOverrideInPrimary !== undefined) {
            amountInBs = amountOverrideInPrimary;
            originalAmount = amountInBs;
        } else if (isForeign && currency.exchangeRate) {
            if (Math.abs(rawInput - remaining) < 0.01) {
                amountInBs = remaining;
                originalAmount = remaining / currency.exchangeRate;
            } else {
                originalAmount = rawInput;
                amountInBs = rawInput * currency.exchangeRate;
            }
            originalCurrency = currency.symbol;
            currencySymbol = currency.symbol;
        } else {
            amountInBs = rawInput;
            originalAmount = rawInput;
        }

        const isCashMethod = method === 'CASH' || method.startsWith('CURRENCY_');
        if (amountInBs > remaining && !isCashMethod) {
            amountInBs = remaining;
        }

        const newPayment: PaymentEntry = {
            id: Date.now().toString(),
            method: method === 'ACCOUNT_CREDIT' && currencyId && currencyId !== primaryCurrency?.id
                ? `ACCOUNT_CREDIT_${currencies.find(c => c.id === currencyId)?.code}`
                : method,
            methodLabel,
            amount: amountInBs,
            currencySymbol,
            originalAmount: currencyId ? originalAmount : undefined,
            originalCurrency: currencyId ? originalCurrency : undefined,
            originalCurrencyId: currencyId,
            bankId: bankData?.id,
            bankName: bankData?.name
        };

        if (method.startsWith('ACCOUNT_CREDIT') && currencyId && currencyId !== primaryCurrency?.id) {
            const currency = currencies.find(c => c.id === currencyId);
            if (currency) {
                newPayment.method = `ACCOUNT_CREDIT_${currency.code}:${originalAmount}:${currency.exchangeRate}`;
            }
        }

        const newPayments = [...payments, newPayment];
        setPayments(newPayments);

        const newTotalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);
        const newIGTF = (applyIGTF && igtfEnabled) ? newPayments.reduce((sum, p) => {
            if (p.originalCurrencyId && p.originalCurrencyId !== primaryCurrency?.id) {
                return sum + (p.amount * (igtfRate / 100));
            }
            return sum;
        }, 0) : 0;

        const newRemaining = Math.max(0, (totals.total + newIGTF) - newTotalPaid);
        setInputAmount(newRemaining > 0 ? newRemaining : null);
    };

    const handleRetentionClick = () => {
        if (!totals.tax || totals.tax <= 0) return;
        const suggestedAmount = totals.tax * 0.75;
        setInputAmount(suggestedAmount);
        setRetentionModalOpen(true);
    };

    const addRetentionPayment = () => {
        if (!retentionVoucher || !inputAmount) return;
        addPayment(
            `RETENTION_IVA:${inputAmount}:${retentionVoucher}`, 
            `F7 ${t('pos.checkout.tax_retention_voucher')} (#${retentionVoucher})`,
            undefined,
            inputAmount
        );
        setRetentionModalOpen(false);
        setRetentionVoucher('');
    };

    const handlePointsRedeem = () => {
        if (!customerId || customerPoints <= 0 || !pointsRate) return;
        const exchangeRate = usePOSStore.getState().exchangeRate || 1;
        const maxRedemptionPercentage = usePOSStore.getState().maxRedemptionPercentage || 100;
        const bsPerPoint = pointsRate * exchangeRate;
        const maxPointsValueInBs = customerPoints * bsPerPoint;
        const maxAllowedByConfig = (totals.total * maxRedemptionPercentage) / 100;
        const amountToPayInBs = Math.min(remaining, maxPointsValueInBs, maxAllowedByConfig, inputAmount || remaining);
        const pointsUsed = amountToPayInBs / bsPerPoint;

        addPayment(
            `LOYALTY_POINTS:${amountToPayInBs}:${pointsUsed.toFixed(2)}`,
            `F10 ${t('pos.checkout.loyalty_points')} (${pointsUsed.toFixed(0)} ${t('pos.checkout.pts')})`,
            undefined,
            amountToPayInBs
        );
    };

    const removePayment = (id: string) => {
        const newPayments = payments.filter(p => p.id !== id);
        setPayments(newPayments);
        const newTotalPaid = newPayments.reduce((sum, p) => sum + p.amount, 0);
        const newIGTF = (applyIGTF && igtfEnabled) ? newPayments.reduce((sum, p) => {
            if (p.originalCurrencyId && p.originalCurrencyId !== primaryCurrency?.id) {
                return sum + (p.amount * (igtfRate / 100));
            }
            return sum;
        }, 0) : 0;
        const newRemaining = Math.max(0, (totals.total + newIGTF) - newTotalPaid);
        setInputAmount(newRemaining);
        if (selectedPaymentId === id) setSelectedPaymentId(null);
    };

    const handleProcessSale = async () => {
        if (!isFullyPaid || isProcessing) return;
        setIsProcessing(true);
        try {
            const paymentData = {
                payments: payments.map(p => ({
                    method: p.method,
                    amount: p.amount,
                    originalAmount: p.originalAmount,
                    originalCurrency: p.originalCurrency,
                    bankId: p.bankId
                })),
                total: totals.total + totalIGTF,
                igtfAmount: totalIGTF,
                totalPaid,
                change: totalPaid - (totals.total + totalIGTF)
            };
            await onProcess(paymentData);
            setIsProcessing(false);
        } catch (error) {
            console.error("Error processing sale:", error);
            setIsProcessing(false);
        }
    };

    const bsPaymentMethods = [
        { key: 'CASH', label: `F1 ${t('pos.checkout.cash') || 'Efectivo'}`, icon: <DollarOutlined />, shortcut: 'F1' },
        { key: 'DEBIT', label: `F2 ${t('pos.checkout.debit') || 'Débito'}`, icon: <CreditCardOutlined />, shortcut: 'F2' },
        { key: 'CARD_CREDIT', label: `F3 ${t('pos.checkout.credit') || 'Crédito'}`, icon: <CreditCardOutlined />, shortcut: 'F3' },
        { key: 'MOBILE', label: `F4 ${t('pos.checkout.mobile_pay') || 'Pago Móvil'}`, icon: <MobileOutlined />, shortcut: 'F4' },
        { key: 'TRANSFER', label: `F5 ${t('pos.checkout.transfer') || 'Transf.'}`, icon: <BankOutlined />, shortcut: 'F5' },
        { key: 'RETENTION_IVA', label: `F7 ${t('pos.checkout.tax_retention_voucher') || 'Retención'}`, icon: <FileTextOutlined />, shortcut: 'F7' },
        { key: 'ACCOUNT_CREDIT', label: `F8 ${t('pos.checkout.store_credit') || 'Crédito Tienda'}`, icon: <CreditCardOutlined />, shortcut: 'F8' },
        { key: 'LOYALTY_POINTS', label: `F10 ${t('pos.checkout.loyalty_points') || 'Puntos'}`, icon: <GiftOutlined />, shortcut: 'F10' },
    ];

    const columns = [
        { title: t('pos.checkout.payment_methods'), dataIndex: 'methodLabel', key: 'methodLabel' },
        {
            title: t('pos.checkout.amount'),
            dataIndex: 'amount',
            key: 'amount',
            render: (amount: number, record: PaymentEntry) => (
                <div>
                    <div>{formatVenezuelanPrice(amount, primaryCurrency?.symbol)}</div>
                    {record.originalCurrency && record.originalAmount && (
                        <Text type="secondary" style={{ fontSize: '0.85em' }}>
                            ({record.originalCurrency} {formatVenezuelanPriceOnly(record.originalAmount)})
                        </Text>
                    )}
                    {record.bankName && (
                        <div style={{ fontSize: '0.8em', color: '#1890ff' }}>
                            <BankOutlined /> {record.bankName}
                        </div>
                    )}
                </div>
            ),
        },
        {
            title: t('pos.checkout.base_currency'),
            dataIndex: 'amount',
            key: 'converted',
            render: (amount: number) => (
                <Text>{formatVenezuelanPrice(amount, primaryCurrency?.symbol)}</Text>
            ),
        },
    ];

    return (
        <Modal
            title={null}
            open={open}
            onCancel={onCancel}
            footer={null}
            width={1200}
            centered
            maskClosable={false}
            styles={{ body: { padding: 0, overflow: 'hidden' } }}
        >
            {/* Bank Selection Sub-modal */}
            <Modal
                title={t('pos.checkout.select_bank')}
                open={bankSelectorOpen}
                onCancel={() => setBankSelectorOpen(false)}
                footer={null}
                centered
                width={400}
                zIndex={2000}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {mobilePaymentBanks.map(bank => (
                        <Button
                            key={bank.id}
                            size="large"
                            onClick={() => {
                                addPayment('MOBILE', `F4 ${t('pos.checkout.mobile_pay') || 'Pago Móvil'}`, undefined, undefined, { id: bank.id, name: bank.bankName });
                                setBankSelectorOpen(false);
                            }}
                            style={{ height: 'auto', padding: '12px', textAlign: 'left', display: 'block' }}
                        >
                            <div style={{ fontWeight: 'bold' }}>{bank.bankName}</div>
                            <div style={{ fontSize: '0.9em', color: '#666' }}>{bank.holderName}</div>
                            <div style={{ fontSize: '0.8em', color: '#888' }}>{bank.accountNumber}</div>
                        </Button>
                    ))}
                    {mobilePaymentBanks.length === 0 && <Text>{t('pos.checkout.no_banks')}</Text>}
                </div>
            </Modal>

            {/* Retention Sub-modal */}
            <Modal
                title={t('pos.checkout.tax_retention_voucher')}
                open={retentionModalOpen}
                onCancel={() => setRetentionModalOpen(false)}
                onOk={addRetentionPayment}
                okText={t('pos.checkout.add_retention')}
                cancelText={t('pos.checkout.cancel')}
                centered
                width={400}
                zIndex={2000}
            >
                <div style={{ padding: '8px 0' }}>
                    <Text type="secondary">{t('pos.checkout.suggested_retention')}:</Text>
                    <div style={{ marginBottom: 16 }}>
                        <Title level={4} style={{ margin: 0 }}>
                            {formatVenezuelanPrice(totals.tax * 0.75, primaryCurrency?.symbol)}
                        </Title>
                    </div>
                    <Text strong>{t('pos.checkout.amount_to_retain')}:</Text>
                    <InputNumber style={{ width: '100%', marginTop: 8, marginBottom: 16 }} size="large" value={inputAmount} onChange={setInputAmount} />
                    <Text strong>{t('pos.checkout.voucher_number')}:</Text>
                    <Input autoFocus style={{ width: '100%', marginTop: 8 }} size="large" placeholder="e.g., 202404080001" value={retentionVoucher} onChange={(e) => setRetentionVoucher(e.target.value)} onPressEnter={addRetentionPayment} />
                </div>
            </Modal>

            {/* Header */}
            <div style={{ background: '#f0f2f5', padding: '16px 24px', borderBottom: '2px solid #d9d9d9' }}>
                <Row gutter={24}>
                    <Col span={12}>
                        <Text type="secondary">{t('pos.header.customer')}:</Text>
                        <Title level={5} style={{ margin: '4px 0' }}>{activeCustomer}</Title>
                    </Col>
                    <Col span={12} style={{ textAlign: 'right' }}>
                        <Text type="secondary">{t('pos.header.next_invoice')}:</Text>
                        <Title level={5} style={{ margin: '4px 0' }}>{reservedInvoiceNumber || nextInvoiceNumber}</Title>
                    </Col>
                </Row>
            </div>

            <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', paddingBottom: 20 }}>
                {/* Totals Summary */}
                <div style={{ background: '#fff', padding: '20px 24px', borderBottom: '1px solid #f0f0f0' }}>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Card size="small" style={{ background: '#e6f7ff', border: '1px solid #91d5ff' }}>
                                <Text type="secondary">{t('pos.checkout.sale_total')} {taxEnabled && `(${t('pos.header.tax_iva')} Incl.)`}</Text>
                                <Title level={3} style={{ margin: '4px 0', color: '#1890ff' }}>
                                    {formatVenezuelanPrice(totals.total, primaryCurrency?.symbol)}
                                </Title>
                                {preferredSecondaryCurrency && (
                                    <Text type="secondary" style={{ fontSize: '11px' }}>
                                        {formatVenezuelanPrice(totals.totalUsd, preferredSecondaryCurrency.symbol)}
                                    </Text>
                                )}
                            </Card>
                        </Col>
                        <Col span={12}>
                            <Card size="small" style={{
                                background: isFullyPaid ? '#f6ffed' : '#fff2e8',
                                border: isFullyPaid ? '1px solid #b7eb8f' : '1px solid #ffbb96'
                            }}>
                                <Text type="secondary">{t('pos.checkout.change')}</Text>
                                <Title level={3} style={{
                                    margin: '4px 0',
                                    color: isFullyPaid ? '#52c41a' : '#fa8c16'
                                }}>
                                    {formatVenezuelanPrice(remaining, primaryCurrency?.symbol)}
                                </Title>
                                {preferredSecondaryCurrency && (
                                    <Text type="secondary" style={{ fontSize: '11px' }}>
                                        {formatVenezuelanPrice(remaining / (preferredSecondaryCurrency.exchangeRate || 1), preferredSecondaryCurrency.symbol)}
                                    </Text>
                                )}
                            </Card>
                        </Col>
                    </Row>
                </div>

                {/* Body Content */}
                <div style={{ padding: '24px' }}>
                    <Row gutter={32}>
                        <Col span={11}>
                            <Title level={5}>{t('pos.checkout.payment_methods')}</Title>
                            
                            {customerId && customerPoints > 0 && (
                                <Card size="small" style={{ marginBottom: 16, borderLeft: '4px solid #faad14', background: '#fffbe6' }}>
                                    <Space direction="vertical" size={0}>
                                        <Text strong><GiftOutlined style={{ color: '#faad14' }} /> {t('pos.checkout.loyalty_points')}:</Text>
                                        <Title level={4} style={{ margin: 0, color: '#d48806' }}>
                                            {customerPoints.toFixed(0)} <span style={{ fontSize: '0.6em' }}>{t('pos.checkout.pts')}</span>
                                        </Title>
                                        {preferredSecondaryCurrency && (
                                            <Text type="secondary" style={{ fontSize: '11px' }}>
                                                {t('pos.checkout.points_value')}: {formatVenezuelanPrice(customerPointsValueUsd * (usePOSStore.getState().exchangeRate || 1))}
                                            </Text>
                                        )}
                                    </Space>
                                </Card>
                            )}

                            <div style={{ marginBottom: 16 }}>
                                <Text strong>{t('pos.checkout.amount')}:</Text>
                                <InputNumber 
                                    ref={amountInputRef} 
                                    style={{ width: '100%', marginTop: 8 }} 
                                    size="large" 
                                    value={inputAmount} 
                                    onChange={setInputAmount} 
                                    placeholder="0.00" 
                                    disabled={isFullyPaid} 
                                    min={0} 
                                />
                            </div>

                            <div style={{ marginBottom: 16 }}>
                                <Text type="secondary" style={{ fontSize: '0.9em' }}>{t('pos.checkout.base_currency')} ({primaryCurrency?.name || 'VES'})</Text>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                                    {bsPaymentMethods.map(method => {
                                        const isCredit = method.key === 'ACCOUNT_CREDIT';
                                        const isRetention = method.key === 'RETENTION_IVA';
                                        const isPoints = method.key === 'LOYALTY_POINTS';
                                        const isDisabled = isFullyPaid || !inputAmount || inputAmount <= 0 || 
                                            ((isCredit || isRetention || isPoints) && !customerId) ||
                                            (isPoints && customerPoints <= 0);

                                        return (
                                            <div key={method.key}>
                                                <Button
                                                    size="large"
                                                    onClick={() => {
                                                        if (isPoints) { handlePointsRedeem(); return; }
                                                        if (method.key === 'MOBILE' && mobilePaymentBanks.length > 0) { setBankSelectorOpen(true); return; }
                                                        if (method.key === 'RETENTION_IVA') { handleRetentionClick(); return; }
                                                        addPayment(method.key, method.label, isCredit ? creditCurrencyId || undefined : undefined);
                                                    }}
                                                    disabled={isDisabled}
                                                    style={{ height: 80, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                                >
                                                    <Space size={4}>{method.icon}<span>{method.label}</span></Space>
                                                </Button>
                                                {isCredit && (
                                                    <div style={{ marginTop: 4, display: 'flex', gap: 2 }}>
                                                        {currencies.filter(c => c.active).map(curr => (
                                                            <Button key={curr.id} size="small" type={creditCurrencyId === curr.id ? 'primary' : 'default'} onClick={() => setCreditCurrencyId(curr.id)} style={{ fontSize: '9px', padding: '0 2px', flex: 1 }}>{curr.code}</Button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {foreignCurrencies.length > 0 && (
                                <div>
                                    <Text type="secondary" style={{ fontSize: '0.9em' }}>{t('pos.checkout.foreign_currency')}</Text>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                                        {foreignCurrencies.map((currency, index) => {
                                            const currentInput = inputAmount || 0;
                                            const rate = currency.exchangeRate || 1;
                                            let displayValue = (Math.abs(currentInput - remaining) < 0.01) ? remaining / rate : currentInput;

                                            return (
                                                <Button 
                                                    key={currency.id} 
                                                    size="large" 
                                                    onClick={() => addPayment(`CURRENCY_${currency.code}`, `CT+F${index + 9} ${currency.name}`, currency.id)} 
                                                    disabled={isFullyPaid || !inputAmount || inputAmount <= 0} 
                                                    style={{ height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                                                >
                                                    <Space size={4}><DollarOutlined /><span>CT+F{index + 9} {currency.name}</span></Space>
                                                    <Text type="secondary" style={{ fontSize: '10px' }}>{formatVenezuelanPrice(displayValue, currency.symbol)}</Text>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </Col>

                        <Col span={13}>
                            <Title level={5}>{t('pos.checkout.payment_breakdown')}</Title>
                            <Table 
                                dataSource={payments} 
                                columns={columns} 
                                rowKey="id" 
                                pagination={false} 
                                size="small" 
                                rowSelection={{ 
                                    type: 'radio', 
                                    selectedRowKeys: selectedPaymentId ? [selectedPaymentId] : [], 
                                    onChange: (keys) => setSelectedPaymentId(keys[0] as string) 
                                }} 
                                locale={{ emptyText: t('pos.checkout.no_payments') }} 
                                style={{ marginTop: 8 }} 
                            />
                            
                            {selectedPaymentId && (
                                <Button 
                                    danger 
                                    icon={<DeleteOutlined />} 
                                    onClick={() => removePayment(selectedPaymentId)} 
                                    style={{ marginTop: 12, marginBottom: 12 }}
                                >
                                    F6 {t('pos.checkout.remove_payment')}
                                </Button>
                            )}

                            <Card size="small" style={{ background: '#fafafa', marginTop: 16, border: '1px solid #d9d9d9' }}>
                                {taxEnabled && (
                                    <>
                                        <Row><Col span={12}><Text type="secondary">{t('pos.checkout.taxable_base')}:</Text></Col><Col span={12} style={{ textAlign: 'right' }}><Text>{formatVenezuelanPrice(totals.subtotal, primaryCurrency?.symbol)}</Text></Col></Row>
                                        <Row style={{ marginTop: 4 }}><Col span={12}><Text type="secondary">{t('pos.checkout.vat')} ({taxRate}%):</Text></Col><Col span={12} style={{ textAlign: 'right' }}><Text>{formatVenezuelanPrice(totals.tax, primaryCurrency?.symbol)}</Text></Col></Row>
                                        <Divider style={{ margin: '8px 0' }} />
                                    </>
                                )}
                                <Row><Col span={12}><Text strong>{t('pos.checkout.sale_total')}:</Text></Col><Col span={12} style={{ textAlign: 'right' }}><Text strong>{formatVenezuelanPrice(totals.total, primaryCurrency?.symbol)}</Text></Col></Row>
                                {igtfEnabled && (
                                    <Row style={{ marginTop: 8, alignItems: 'center' }}>
                                        <Col span={12}><Space direction="vertical" size={0}><Text strong style={{ color: '#ff4d4f' }}>{t('pos.checkout.igtf_tax')} ({igtfRate}%):</Text><Text type="secondary" style={{ fontSize: '10px' }}>{t('pos.checkout.foreign_surcharge')}</Text></Space></Col>
                                        <Col span={12} style={{ textAlign: 'right' }}><Space><Text strong style={{ color: '#ff4d4f' }}>{formatVenezuelanPrice(totalIGTF, primaryCurrency?.symbol)}</Text><Switch size="small" checked={applyIGTF} onChange={setApplyIGTF} /></Space></Col>
                                    </Row>
                                )}
                                <Divider style={{ margin: '12px 0' }} />
                                <Row><Col span={12}><Title level={4} style={{ margin: 0 }}>{t('pos.checkout.grand_total')}:</Title></Col><Col span={12} style={{ textAlign: 'right' }}><Title level={4} style={{ margin: 0, color: '#1890ff' }}>{formatVenezuelanPrice(totals.total + totalIGTF, primaryCurrency?.symbol)}</Title></Col></Row>
                                <Row style={{ marginTop: 8 }}><Col span={12}><Text strong>{t('pos.checkout.total_paid')}:</Text></Col><Col span={12} style={{ textAlign: 'right' }}><Text strong>{formatVenezuelanPrice(totalPaid, primaryCurrency?.symbol)}</Text></Col></Row>
                                <Row style={{ marginTop: 8 }}>
                                    <Col span={12}><Text strong>{t('pos.checkout.change')}:</Text></Col>
                                    <Col span={12} style={{ textAlign: 'right' }}>
                                        <Text strong style={{ color: totalPaid > (totals.total + totalIGTF) ? '#52c41a' : 'inherit', fontSize: '1.2em' }}>
                                            {formatVenezuelanPrice(Math.max(0, totalPaid - (totals.total + totalIGTF)), primaryCurrency?.symbol)}
                                        </Text>
                                        {preferredSecondaryCurrency && totalPaid > (totals.total + totalIGTF) && (
                                            <Text type="secondary" style={{ color: '#52c41a', fontSize: '11px' }}>
                                                ({formatVenezuelanPrice((totalPaid - (totals.total + totalIGTF)) / (preferredSecondaryCurrency.exchangeRate || 1), preferredSecondaryCurrency.symbol)})
                                            </Text>
                                        )}
                                    </Col>
                                </Row>
                            </Card>
                        </Col>
                    </Row>
                </div>
            </div>

            {/* Sticky Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #d9d9d9', background: '#f0f2f5', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
                <Row gutter={16}>
                    <Col span={12}><Button size="large" block onClick={onCancel}>Esc {t('pos.checkout.cancel')}</Button></Col>
                    <Col span={12}><Button type="primary" size="large" block onClick={handleProcessSale} disabled={!isFullyPaid || isProcessing} loading={isProcessing} icon={<CheckCircleOutlined />}>F9 {t('pos.checkout.register_sale')}</Button></Col>
                </Row>
            </div>
        </Modal>
    );
};
