import { Modal, Card, Row, Col, Typography, Button, Space, Divider, Tag, Descriptions, message } from 'antd';
import { WhatsAppOutlined, MailOutlined, PrinterOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { Sale } from '../../../services/salesApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { usePOSStore } from '../../../store/posStore';

const { Title, Text } = Typography;

interface InvoiceModalProps {
    open: boolean;
    sale: Sale | null;
    onClose: () => void;
}

/**
 * InvoiceModal Component
 * Post-sale receipt management.
 * Provides options to print the fiscal receipt (SENIAT format) or send it via WhatsApp/Email.
 */
export const InvoiceModal = ({ open, sale, onClose }: InvoiceModalProps) => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language || 'es';
    if (!sale) {
        return (
            <Modal
                open={open}
                onCancel={onClose}
                footer={null}
                destroyOnClose
            >
                <div style={{ textAlign: 'center', padding: 20 }}>
                    {t('common.loading_invoice_data', { defaultValue: 'Loading invoice data...' })}
                </div>
            </Modal>
        );
    }

    const clientName = sale.client?.name || t('common.cash_customer', { defaultValue: 'CASH CUSTOMER' });
    const clientPhone = (sale.client as any)?.phone || null;
    const { companyInfo } = usePOSStore();
    const clientEmail = (sale.client as any)?.email || null;
    const hasWhatsapp = (sale.client as any)?.hasWhatsapp || false;

    /**
     * Formats a rich WhatsApp message with sale details.
     */
    const formatWhatsAppUrl = (phone: string) => {
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('04')) {
            cleanPhone = '58' + cleanPhone.substring(1);
        } else if (!cleanPhone.startsWith('58') && cleanPhone.length === 10) {
            cleanPhone = '58' + cleanPhone;
        }

        const itemsList = sale.items?.map(item =>
            `   • ${item.quantity}x ${item.product?.name || 'Product'} - ${formatVenezuelanPrice(item.total)}`
        ).join('\n') || '';

        const invoiceMessage = encodeURIComponent(
            `🏢 *${companyInfo?.name || 'MastERP'}*\n` +
            `Tax ID (RIF): ${companyInfo?.rif || 'J-00000000-0'}\n` +
            `━━━━━━━━━━━━━━━━\n\n` +
            `🧾 *${t('common.invoice_caps', { defaultValue: 'INVOICE' })} ${sale.invoiceNumber}*\n\n` +
            `${t('pos.wa_hello', { defaultValue: 'Hello' })} ${clientName}, ${t('pos.wa_details_prefix', { defaultValue: 'here are your purchase details' })}:\n\n` +
            `📅 *${t('common.date')}:* ${new Date(sale.date).toLocaleDateString(currentLang === 'es' ? 'es-VE' : 'en-US')}\n` +
            `🕐 *${t('common.time', { defaultValue: 'Time' })}:* ${new Date(sale.date).toLocaleTimeString(currentLang === 'es' ? 'es-VE' : 'en-US')}\n\n` +
            `📦 *${t('common.items')}:*\n${itemsList}\n\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `💵 ${t('common.subtotal')}: ${formatVenezuelanPrice(sale.subtotal)}\n` +
            (sale.discount > 0 ? `🏷️ ${t('common.discount')}: -${formatVenezuelanPrice(sale.discount)}\n` : '') +
            `💰 *TOTAL: ${formatVenezuelanPrice(sale.total)}*\n\n` +
            `💳 ${t('common.payment_method')}: ${sale.paymentMethod}\n\n` +
            `${t('pos.wa_thank_you', { defaultValue: 'Thank you for your purchase!' })} 🙏\n` +
            `_${companyInfo?.name || 'MastERP'}_`
        );
        return `https://wa.me/${cleanPhone}?text=${invoiceMessage}`;
    };

    const handleWhatsApp = () => {
        if (clientPhone && hasWhatsapp) {
            window.open(formatWhatsAppUrl(clientPhone), '_blank');
            message.success(t('pos.opening_whatsapp', { defaultValue: 'Opening WhatsApp...' }));
            onClose();
        } else {
            message.warning(t('pos.no_whatsapp_registered', { defaultValue: 'Customer does not have WhatsApp registered' }));
        }
    };

    const handleEmail = () => {
        if (clientEmail) {
            const subject = encodeURIComponent(`${t('common.invoice')} ${sale.invoiceNumber} - ${companyInfo?.name || 'MastERP'}`);
            const body = encodeURIComponent(
                `${t('pos.email_dear', { defaultValue: 'Dear' })} ${clientName},\n\n` +
                `${t('pos.email_details_prefix', { defaultValue: 'Please find the details of your invoice below' })}:\n\n` +
                `${t('common.invoice_number', { defaultValue: 'Invoice Number' })}: ${sale.invoiceNumber}\n` +
                `${t('common.date')}: ${new Date(sale.date).toLocaleDateString(currentLang === 'es' ? 'es-VE' : 'en-US')}\n` +
                `${t('common.total')}: ${formatVenezuelanPrice(sale.total)}\n\n` +
                `${t('pos.wa_thank_you')}!\n\n${companyInfo?.name || 'MastERP'}`
            );
            window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`, '_blank');
            message.success(t('pos.opening_email_client', { defaultValue: 'Opening email client...' }));
            onClose();
        } else {
            message.warning(t('pos.no_email_registered', { defaultValue: 'Customer does not have an email registered' }));
        }
    };

    /**
     * Generates a printable HTML version of the invoice following SENIAT (Venezuelan Tax) standards.
     */
    const handlePrint = () => {
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>${t('common.invoice')} ${sale.invoiceNumber}</title>
                <style>
                    body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
                    .header { text-align: center; margin-bottom: 20px; }
                    .company-name { font-size: 18px; font-weight: bold; }
                    .invoice-title { font-size: 16px; margin-top: 10px; }
                    .fiscal-info { font-size: 10px; margin-top: 5px; color: #666; }
                    .info-section { margin: 15px 0; }
                    .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
                    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f5f5f5; }
                    .totals { text-align: right; margin-top: 15px; }
                    .total-row { margin: 5px 0; }
                    .grand-total { font-size: 16px; font-weight: bold; }
                    .footer { text-align: center; margin-top: 30px; font-size: 10px; color: #666; }
                    .seniat-notice { border: 1px solid #000; padding: 10px; margin-top: 20px; font-size: 9px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="company-name">${companyInfo?.name || 'MastERP'}</div>
                    <div class="fiscal-info">${t('common.tax_id_rif', { defaultValue: 'Tax ID (RIF)' })}: ${companyInfo?.rif || 'J-00000000-0'}</div>
                    <div class="fiscal-info">${t('common.fiscal_address', { defaultValue: 'Fiscal Address' })}: Venezuela</div>
                    <div class="invoice-title">${t('common.invoice_caps')}</div>
                    <div style="font-size: 14px; margin-top: 5px;">${sale.invoiceNumber}</div>
                </div>
                
                <div class="info-section">
                    <div class="info-row">
                        <span><strong>${t('common.date')}:</strong> ${new Date(sale.date).toLocaleDateString(currentLang === 'es' ? 'es-VE' : 'en-US')}</span>
                        <span><strong>${t('common.time')}:</strong> ${new Date(sale.date).toLocaleTimeString(currentLang === 'es' ? 'es-VE' : 'en-US')}</span>
                    </div>
                    <div class="info-row">
                        <span><strong>${t('common.customer')}:</strong> ${clientName}</span>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>${t('common.qty_short')}</th>
                            <th>${t('common.description', { defaultValue: 'Description' })}</th>
                            <th>${t('common.unit_price')}</th>
                            <th>${t('common.total')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sale.items?.map(item => `
                            <tr>
                                <td>${item.quantity}</td>
                                <td>${item.product?.name || 'Product'}</td>
                                <td>${formatVenezuelanPrice(item.unitPrice)}</td>
                                <td>${formatVenezuelanPrice(item.total)}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="4">No items</td></tr>'}
                    </tbody>
                </table>
                
                <div class="totals">
                    <div class="total-row">${t('common.subtotal')}: ${formatVenezuelanPrice(sale.subtotal)}</div>
                    ${sale.discount > 0 ? `<div class="total-row">${t('common.discount')}: -${formatVenezuelanPrice(sale.discount)}</div>` : ''}
                    ${sale.tax > 0 ? `<div class="total-row">${t('common.vat_16')}: ${formatVenezuelanPrice(sale.tax)}</div>` : ''}
                    <div class="total-row grand-total">TOTAL: ${formatVenezuelanPrice(sale.total)}</div>
                </div>
                
                <div class="info-section">
                    <div><strong>${t('common.payment_method')}:</strong> ${sale.paymentMethod}</div>
                    ${sale.tendered ? `<div><strong>${t('pos.paid_with', { defaultValue: 'Paid with' })}:</strong> ${formatVenezuelanPrice(sale.tendered)}</div>` : ''}
                    ${sale.change ? `<div><strong>${t('pos.change', { defaultValue: 'Change' })}:</strong> ${formatVenezuelanPrice(sale.change)}</div>` : ''}
                </div>
                
                <div class="seniat-notice">
                    <strong>${t('pos.note_caps', { defaultValue: 'NOTE' })}:</strong> ${t('pos.seniat_notice', { defaultValue: 'This invoice complies with SENIAT regulations. Valid document for fiscal purposes according to current legislation.' })}
                </div>
                
                <div class="footer">
                    ${t('pos.wa_thank_you')}<br>
                    ${t('pos.generated_by', { defaultValue: 'Generated by' })} ${companyInfo?.name || 'MastERP'}
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
        message.success(t('pos.preparing_print_view', { defaultValue: 'Preparing print view...' }));
        onClose();
    };

    const handleSkip = () => {
        onClose();
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width={600}
            centered
            destroyOnClose
            maskClosable={false}
            title={
                <div style={{ textAlign: 'center' }}>
                    <Title level={4} style={{ margin: 0 }}>
                        🧾 {t('pos.sale_completed', { defaultValue: 'Sale Completed' })}
                    </Title>
                </div>
            }
        >
            <Card style={{ marginBottom: 16 }}>
                <Descriptions column={2} size="small">
                    <Descriptions.Item label={t('common.invoice')} span={2}>
                        <Tag color="blue" style={{ fontSize: 16 }}>{sale.invoiceNumber}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('common.date')}>
                        {new Date(sale.date).toLocaleDateString(currentLang === 'es' ? 'es-VE' : 'en-US')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('common.time')}>
                        {new Date(sale.date).toLocaleTimeString(currentLang === 'es' ? 'es-VE' : 'en-US')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('common.customer')} span={2}>
                        <Text strong>{clientName}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('common.products')}>
                        {sale.items?.length || 0} {t('common.items')}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('common.payment_method')}>
                        {sale.paymentMethod}
                    </Descriptions.Item>
                </Descriptions>

                <Divider style={{ margin: '12px 0' }} />

                <Row justify="space-between" align="middle">
                    <Col>
                        <Text type="secondary">{t('pos.sale_total', { defaultValue: 'Sale Total' })}</Text>
                    </Col>
                    <Col>
                        <Title level={2} style={{ margin: 0, color: '#52c41a' }}>
                            {formatVenezuelanPrice(sale.total)}
                        </Title>
                    </Col>
                </Row>
            </Card>

            <Divider>{t('pos.how_receive_invoice', { defaultValue: 'How would you like to receive the invoice?' })}</Divider>

            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Button
                    type="primary"
                    icon={<WhatsAppOutlined />}
                    size="large"
                    block
                    style={{ background: '#25D366', borderColor: '#25D366' }}
                    onClick={handleWhatsApp}
                    disabled={!clientPhone || !hasWhatsapp}
                >
                    {t('pos.send_via_whatsapp', { defaultValue: 'Send via WhatsApp' })}
                    {(!clientPhone || !hasWhatsapp) && <Text type="secondary" style={{ marginLeft: 8 }}>({t('common.unavailable', { defaultValue: 'Unavailable' })})</Text>}
                </Button>

                <Button
                    type="primary"
                    icon={<MailOutlined />}
                    size="large"
                    block
                    style={{ background: '#1890ff' }}
                    onClick={handleEmail}
                    disabled={!clientEmail}
                >
                    {t('pos.send_via_email', { defaultValue: 'Send via Email' })}
                    {!clientEmail && <Text type="secondary" style={{ marginLeft: 8 }}>({t('common.unavailable')})</Text>}
                </Button>

                <Button
                    type="default"
                    icon={<PrinterOutlined />}
                    size="large"
                    block
                    onClick={handlePrint}
                >
                    {t('pos.print_invoice_seniat', { defaultValue: 'Print Invoice (SENIAT)' })}
                </Button>

                <Divider style={{ margin: '8px 0' }} />

                <Button
                    type="text"
                    icon={<CloseOutlined />}
                    size="large"
                    block
                    onClick={handleSkip}
                >
                    {t('pos.dont_print_now', { defaultValue: "Don't print now" })}
                </Button>
            </Space>
        </Modal>
    );
};
