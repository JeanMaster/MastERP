import { useState, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Button, App, Select, Divider, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Invoice } from '../../../services/invoicesApi';
import { taxRetentionsApi } from '../../../services/taxRetentionsApi';

const { Text, Title } = Typography;

interface RegisterRetentionModalProps {
    visible: boolean;
    invoice: Invoice | null;
    onClose: () => void;
    onSuccess: () => void;
}

export const RegisterRetentionModal: React.FC<RegisterRetentionModalProps> = ({
    visible,
    invoice,
    onClose,
    onSuccess,
}) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const { message } = App.useApp();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (visible && invoice) {
            // Initial calculation for IVA retention (75%)
            const taxAmount = Number(invoice.tax || 0);
            const initialRetention = taxAmount * 0.75;

            form.setFieldsValue({
                type: 'IVA',
                voucherDate: new Date(),
                baseAmount: Number(invoice.subtotal),
                retentionPercent: 75,
                amount: initialRetention,
            });
        }
    }, [visible, invoice, form]);

    const handleCalculateAmount = () => {
        const values = form.getFieldsValue();
        const type = values.type;
        const base = values.baseAmount || 0;
        const percent = values.retentionPercent || 0;

        if (type === 'IVA') {
            // Amount = (Base * 0.16) * (Percent / 100)
            const tax = base * 0.16;
            form.setFieldValue('amount', Number((tax * (percent / 100)).toFixed(2)));
        } else if (type === 'ISLR') {
            // Amount = Base * (Percent / 100)
            form.setFieldValue('amount', Number((base * (percent / 100)).toFixed(2)));
        }
    };

    const onFinish = async (values: any) => {
        if (!invoice) return;

        if (values.amount > Number(invoice.balance)) {
            message.warning(t('tax_retention.messages.exceeds_balance'));
        }

        try {
            setIsSubmitting(true);
            await taxRetentionsApi.create({
                ...values,
                invoiceId: invoice.id,
                voucherDate: new Date(values.voucherDate),
            });

            message.success(t('tax_retention.messages.success'));
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || t('tax_retention.messages.error'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            title={t('tax_retention.modal_title')}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={600}
            forceRender
        >
            {invoice && (
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    onValuesChange={handleCalculateAmount}
                >
                    <div style={{ marginBottom: 24, padding: 16, border: '1px solid #d9d9d9', borderRadius: 8, backgroundColor: '#fafafa' }}>
                        <Title level={5} style={{ marginTop: 0 }}>{t('tax_retention.invoice_summary')}</Title>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <Text type="secondary">{t('common.invoice')}:</Text>
                            <Text strong>{invoice.number}</Text>
                            
                            <Text type="secondary">{t('common.taxable_base')}:</Text>
                            <Text>Bs. {Number(invoice.subtotal).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</Text>
                            
                            <Text type="secondary">{t('common.tax')}:</Text>
                            <Text>Bs. {Number(invoice.tax).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</Text>
                            
                            <Text type="secondary">{t('common.balance') || 'Pending Balance'}:</Text>
                            <Text style={{ color: '#ff4d4f' }}>Bs. {Number(invoice.balance).toLocaleString('de-DE', { minimumFractionDigits: 2 })}</Text>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <Form.Item
                            name="type"
                            label={t('tax_retention.type')}
                            rules={[{ required: true }]}
                        >
                            <Select>
                                <Select.Option value="IVA">IVA (Ventas)</Select.Option>
                                <Select.Option value="ISLR">ISLR (Renta)</Select.Option>
                                <Select.Option value="MUNICIPAL">Municipal</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="voucherNumber"
                            label={t('tax_retention.voucher_number')}
                            rules={[{ required: true, message: t('common.required') }]}
                        >
                            <Input placeholder="YYYYMMXXXXXXXX" />
                        </Form.Item>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                        <Form.Item
                            name="baseAmount"
                            label={t('common.taxable_base')}
                            rules={[{ required: true }]}
                        >
                            <InputNumber style={{ width: '100%' }} precision={2} />
                        </Form.Item>

                        <Form.Item
                            name="retentionPercent"
                            label={t('tax_retention.percent')}
                            rules={[{ required: true }]}
                        >
                            <Select>
                                <Select.Option value={75}>75% (IVA)</Select.Option>
                                <Select.Option value={100}>100% (IVA)</Select.Option>
                                <Select.Option value={1}>1% (ISLR)</Select.Option>
                                <Select.Option value={2}>2% (ISLR)</Select.Option>
                                <Select.Option value={3}>3% (ISLR)</Select.Option>
                                <Select.Option value={5}>5% (ISLR)</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="amount"
                            label={t('tax_retention.retained_amount')}
                            rules={[{ required: true }]}
                        >
                            <InputNumber 
                                style={{ width: '100%', backgroundColor: '#e6f7ff' }} 
                                precision={2}
                                readOnly
                            />
                        </Form.Item>
                    </div>

                    <Divider style={{ margin: '12px 0' }} />
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={onClose}>{t('common.cancel')}</Button>
                        <Button type="primary" htmlType="submit" loading={isSubmitting}>
                            {t('tax_retention.register_voucher')}
                        </Button>
                    </div>
                </Form>
            )}
        </Modal>
    );
};
