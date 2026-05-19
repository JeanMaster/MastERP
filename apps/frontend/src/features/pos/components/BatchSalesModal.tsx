import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, DatePicker, Select, Button, Space, Typography, App, InputNumber, Row, Col, Card, Divider, Switch, Tooltip } from 'antd';
import { UserOutlined, PlusOutlined, DeleteOutlined, SaveOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { salesApi } from '../../../services/salesApi';
import { productsApi, type Product } from '../../../services/productsApi';
import { ClientSelectionModal } from './ClientSelectionModal';
import type { Client } from '../../../services/clientsApi';
import { usePOSStore } from '../../../store/posStore';
import { getRoundedPrice } from '../../../utils/rounding';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import dayjs from 'dayjs';
import debounce from 'lodash/debounce';

const { Text, Title } = Typography;

interface BatchSalesModalProps {
    open: boolean;
    onCancel: () => void;
    exchangeRate: number;
    cashSessionId?: string;
}

interface BatchSaleEntry {
    id: string;
    client: Client | null;
    hourBlock: string; // value from HOUR_BLOCKS (e.g. "08", "09")
    items: any[];
    payments: any[];
}

const HOUR_BLOCKS = [
    { label: '08:00 AM - 09:00 AM', value: '08' },
    { label: '09:00 AM - 10:00 AM', value: '09' },
    { label: '10:00 AM - 11:00 AM', value: '10' },
    { label: '11:00 AM - 12:00 PM', value: '11' },
    { label: '12:00 PM - 01:00 PM', value: '12' },
    { label: '01:00 PM - 02:00 PM', value: '13' },
    { label: '02:00 PM - 03:00 PM', value: '14' },
    { label: '03:00 PM - 04:00 PM', value: '15' },
    { label: '04:00 PM - 05:00 PM', value: '16' },
    { label: '05:00 PM - 06:00 PM', value: '17' },
    { label: '06:00 PM - 07:00 PM', value: '18' },
    { label: '07:00 PM - 08:00 PM', value: '19' },
    { label: '08:00 PM - 09:00 PM', value: '20' },
    { label: '09:00 PM - 10:00 PM', value: '21' },
];

export const BatchSalesModal = ({ open, onCancel, exchangeRate, cashSessionId }: BatchSalesModalProps) => {
    const { message } = App.useApp();
    const [form] = Form.useForm();
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { calculatePriceInPrimary, getNormalizedQuantity, taxEnabled, taxRate, primaryCurrency, currencies, roundingEnabled, roundingFactor } = usePOSStore();

    // Product search state
    const [productOptions, setProductOptions] = useState<{ label: string; value: string; product: Product }[]>([]);
    const [searchingProducts, setSearchingProducts] = useState(false);

    // Global Batch States
    const [blackoutDate, setBlackoutDate] = useState<dayjs.Dayjs | null>(dayjs());
    const [salesList, setSalesList] = useState<BatchSaleEntry[]>([
        {
            id: '1',
            client: null,
            hourBlock: '08',
            items: [{}],
            payments: [{ method: 'CASH', amount: 0 }]
        }
    ]);
    const [activeSaleId, setActiveSaleId] = useState<string>('1');

    // Watch items of active sale to calculate totals dynamically
    const formItems = Form.useWatch('items', form) || [];
    const formPayments = Form.useWatch('payments', form) || [];

    useEffect(() => {
        if (open) {
            form.resetFields();
            setSelectedClient(null);
            setBlackoutDate(dayjs());
            setSalesList([
                {
                    id: '1',
                    client: null,
                    hourBlock: '08',
                    items: [{}],
                    payments: [{ method: 'CASH', amount: 0 }]
                }
            ]);
            setActiveSaleId('1');
            form.setFieldsValue({
                hourBlock: '08',
                items: [{}],
                payments: [{ method: 'CASH', amount: 0 }]
            });
            searchProducts('');
        }
    }, [open, form]);

    const searchProducts = async (term: string) => {
        setSearchingProducts(true);
        try {
            const data = await productsApi.getAll({ search: term, active: true, limit: 20 });
            setProductOptions(data.map(p => {
                const priceInBs = calculatePriceInPrimary(p, false);
                const finalPrice = (taxEnabled && !p.isTaxExempt) ? priceInBs * (1 + taxRate / 100) : priceInBs;
                const roundedPrice = getRoundedPrice(finalPrice, roundingFactor, roundingEnabled);

                return {
                    label: `${p.sku} - ${p.name} (Bs. ${roundedPrice.toFixed(2)})`,
                    value: p.id,
                    product: p
                };
            }));
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setSearchingProducts(false);
        }
    };

    const debouncedSearchProducts = debounce(searchProducts, 500);

    const handleProductSelect = (productId: string, name: number) => {
        const option = productOptions.find(o => o.value === productId);
        if (option) {
            const p = option.product;
            const priceInBs = calculatePriceInPrimary(p, false);
            const finalPrice = (taxEnabled && !p.isTaxExempt) ? priceInBs * (1 + taxRate / 100) : priceInBs;
            const roundedPrice = getRoundedPrice(finalPrice, roundingFactor, roundingEnabled);

            const items = form.getFieldValue('items') || [];
            items[name] = {
                ...items[name],
                productId: p.id,
                quantity: 1,
                unitPrice: roundedPrice,
                isTaxExempt: p.isTaxExempt,
                isSecondaryUnit: false,
                productRef: p
            };
            form.setFieldsValue({ items });
            
            // Sync items to react array state to update sidebar totals immediately
            updateActiveSaleState(null, null, items, null);
        }
    };

    const handleUnitToggle = (isSecondary: boolean, name: number) => {
        const items = form.getFieldValue('items') || [];
        const item = items[name];
        if (item && item.productRef) {
            const p = item.productRef;
            const priceInBs = calculatePriceInPrimary(p, isSecondary);
            const finalPrice = (taxEnabled && !p.isTaxExempt) ? priceInBs * (1 + taxRate / 100) : priceInBs;
            const roundedPrice = getRoundedPrice(finalPrice, roundingFactor, roundingEnabled);

            items[name] = {
                ...item,
                unitPrice: roundedPrice,
                isSecondaryUnit: isSecondary
            };
            form.setFieldsValue({ items });
            updateActiveSaleState(null, null, items, null);
        }
    };

    // Helper to reactively update the state array for active sale
    const updateActiveSaleState = (newClient?: Client | null, newHourBlock?: string | null, newItems?: any[] | null, newPayments?: any[] | null) => {
        setSalesList(prev => prev.map(s => {
            if (s.id === activeSaleId) {
                return {
                    ...s,
                    client: newClient !== undefined ? newClient : s.client,
                    hourBlock: newHourBlock !== null && newHourBlock !== undefined ? newHourBlock : s.hourBlock,
                    items: newItems || s.items,
                    payments: newPayments || s.payments
                };
            }
            return s;
        }));
    };

    // Calculate dynamic totals for the ACTIVE sale currently loaded in the form
    const totals = useMemo(() => {
        let subtotal = 0;
        let tax = 0;

        formItems.forEach((item: any) => {
            if (!item?.productId || !item?.quantity || !item?.unitPrice) return;
            const itemTotalWithTax = item.quantity * item.unitPrice;
            
            if (taxEnabled && item.isTaxExempt === false) {
                const itemTax = itemTotalWithTax - (itemTotalWithTax / (1 + (taxRate / 100)));
                tax += itemTax;
            }
            
            subtotal += itemTotalWithTax;
        });

        const realSubtotal = subtotal - tax;
        const total = subtotal;

        return { subtotal: realSubtotal, tax, total };
    }, [formItems, taxEnabled, taxRate]);

    const paymentTotals = useMemo(() => {
        let totalPaidInBs = 0;
        formPayments.forEach((p: any) => {
            if (!p?.amount || !p?.method) return;

            let amountInBs = p.amount;
            if (p.method.startsWith('CURRENCY_')) {
                const currencyCode = p.method.split('_')[1];
                const currency = currencies.find(c => c.code === currencyCode);
                if (currency) {
                    amountInBs = p.amount * (currency.exchangeRate || 1);
                }
            }
            totalPaidInBs += amountInBs;
        });

        return {
            totalPaidInBs,
            remaining: Math.max(0, totals.total - totalPaidInBs),
            change: Math.max(0, totalPaidInBs - totals.total)
        };
    }, [formPayments, totals.total, currencies]);

    // Calculate static totals for other closed sales in the sidebar list
    const calculateSaleTotal = (sale: BatchSaleEntry) => {
        let total = 0;
        sale.items.forEach((item: any) => {
            if (!item?.productId || !item?.quantity || !item?.unitPrice) return;
            total += item.quantity * item.unitPrice;
        });
        return total;
    };

    const getSaleDisplayTotal = (sale: BatchSaleEntry) => {
        if (sale.id === activeSaleId) {
            return totals.total;
        }
        return calculateSaleTotal(sale);
    };

    const calculateSalePayments = (sale: BatchSaleEntry) => {
        let totalPaidInBs = 0;
        sale.payments.forEach((p: any) => {
            if (!p?.amount || !p?.method) return;

            let amountInBs = p.amount;
            if (p.method.startsWith('CURRENCY_')) {
                const currencyCode = p.method.split('_')[1];
                const currency = currencies.find(c => c.code === currencyCode);
                if (currency) {
                    amountInBs = p.amount * (currency.exchangeRate || 1);
                }
            }
            totalPaidInBs += amountInBs;
        });
        return totalPaidInBs;
    };

    // Sidebar Master-Detail Switching
    const switchActiveSale = (nextId: string) => {
        if (nextId === activeSaleId) return;

        // 1. Save current form values to state
        const currentValues = form.getFieldsValue();
        const updatedSales = salesList.map(s => {
            if (s.id === activeSaleId) {
                return {
                    ...s,
                    client: selectedClient,
                    hourBlock: currentValues.hourBlock,
                    items: currentValues.items || [{}],
                    payments: currentValues.payments || [{ method: 'CASH', amount: 0 }]
                };
            }
            return s;
        });
        setSalesList(updatedSales);

        // 2. Load next sale into form
        const targetSale = updatedSales.find(s => s.id === nextId);
        if (targetSale) {
            setActiveSaleId(nextId);
            setSelectedClient(targetSale.client);
            form.setFieldsValue({
                hourBlock: targetSale.hourBlock,
                items: targetSale.items,
                payments: targetSale.payments
            });
        }
    };

    const handleAddSale = () => {
        // Save current form values to state first
        const currentValues = form.getFieldsValue();
        const updatedSales = salesList.map(s => {
            if (s.id === activeSaleId) {
                return {
                    ...s,
                    client: selectedClient,
                    hourBlock: currentValues.hourBlock,
                    items: currentValues.items || [{}],
                    payments: currentValues.payments || [{ method: 'CASH', amount: 0 }]
                };
            }
            return s;
        });

        // Determine default starting hour for the next sale (e.g. next sequential block)
        const lastHourBlockVal = currentValues.hourBlock;
        let nextHourBlockVal = '08';
        const currentIndex = HOUR_BLOCKS.findIndex(h => h.value === lastHourBlockVal);
        if (currentIndex !== -1 && currentIndex < HOUR_BLOCKS.length - 1) {
            nextHourBlockVal = HOUR_BLOCKS[currentIndex + 1].value;
        }

        const newId = String(Date.now());
        const newSale: BatchSaleEntry = {
            id: newId,
            client: null,
            hourBlock: nextHourBlockVal,
            items: [{}],
            payments: [{ method: 'CASH', amount: 0 }]
        };

        setSalesList([...updatedSales, newSale]);
        setActiveSaleId(newId);
        setSelectedClient(null);
        form.setFieldsValue({
            hourBlock: nextHourBlockVal,
            items: [{}],
            payments: [{ method: 'CASH', amount: 0 }]
        });
    };

    const handleDeleteSale = (id: string, event: React.MouseEvent) => {
        event.stopPropagation();
        if (salesList.length === 1) {
            message.warning('El lote debe tener al menos una venta.');
            return;
        }

        const filteredSales = salesList.filter(s => s.id !== id);
        setSalesList(filteredSales);

        if (activeSaleId === id) {
            const nextSale = filteredSales[0];
            setActiveSaleId(nextSale.id);
            setSelectedClient(nextSale.client);
            form.setFieldsValue({
                hourBlock: nextSale.hourBlock,
                items: nextSale.items,
                payments: nextSale.payments
            });
        }
    };

    // Batch Submit Handler
    const handleSubmitBatch = async () => {
        try {
            // Validate the currently active sale's form inputs first
            const currentValues = await form.validateFields();

            // Save the validated form contents into the active sale
            const finalSalesList = salesList.map(s => {
                if (s.id === activeSaleId) {
                    return {
                        ...s,
                        client: selectedClient,
                        hourBlock: currentValues.hourBlock,
                        items: currentValues.items || [{}],
                        payments: currentValues.payments || [{ method: 'CASH', amount: 0 }]
                    };
                }
                return s;
            });

            // Perform robust batch validations across all transcribed sales
            for (let i = 0; i < finalSalesList.length; i++) {
                const s = finalSalesList[i];
                const blockLabel = HOUR_BLOCKS.find(hb => hb.value === s.hourBlock)?.label || `${s.hourBlock}:00`;
                
                const validItems = s.items.filter((item: any) => item?.productId && item?.quantity && item?.unitPrice);
                if (validItems.length === 0) {
                    message.warning(`La venta #${i + 1} (${blockLabel}) no contiene productos válidos.`);
                    switchActiveSale(s.id);
                    return;
                }

                const total = validItems.reduce((acc: number, item: any) => acc + (item.quantity * item.unitPrice), 0);
                const paid = calculateSalePayments(s);
                const remaining = total - paid;
                
                if (remaining > 0.01) {
                    message.warning(`La venta #${i + 1} (${blockLabel}) tiene saldo pendiente de ${formatVenezuelanPrice(remaining, primaryCurrency?.symbol)}.`);
                    switchActiveSale(s.id);
                    return;
                }
            }

            if (!blackoutDate) {
                message.warning('Por favor, seleccione el Día del Corte para el lote.');
                return;
            }

            setIsSubmitting(true);

            // Execute sequential API submissions
            for (let i = 0; i < finalSalesList.length; i++) {
                const s = finalSalesList[i];
                const blockLabel = HOUR_BLOCKS.find(hb => hb.value === s.hourBlock)?.label || `${s.hourBlock}:00`;
                
                let subtotal = 0;
                let tax = 0;
                const validItems = s.items.filter((item: any) => item?.productId && item?.quantity && item?.unitPrice);
                
                const itemsDto = validItems.map((item: any) => {
                    const p = item.productRef;
                    let quantitySent = item.quantity;
                    let unitPriceSent = item.unitPrice;

                    if (p) {
                        quantitySent = getNormalizedQuantity(item.quantity, p, item.isSecondaryUnit);
                        if (item.isSecondaryUnit && p.unitsPerSecondaryUnit) {
                            const factor = Number(p.unitsPerSecondaryUnit);
                            if (p.conversionDirection === 'secondary_to_primary') {
                                unitPriceSent = item.unitPrice * factor;
                            } else {
                                unitPriceSent = item.unitPrice / factor;
                            }
                        }
                    }

                    const itemTotalWithTax = item.quantity * item.unitPrice;
                    if (taxEnabled && item.isTaxExempt === false) {
                        const itemTax = itemTotalWithTax - (itemTotalWithTax / (1 + (taxRate / 100)));
                        tax += itemTax;
                    }
                    subtotal += itemTotalWithTax;

                    return {
                        productId: item.productId,
                        quantity: Math.round(quantitySent * 1000) / 1000,
                        unitPrice: Math.round(unitPriceSent * 100) / 100,
                        total: Number(item.quantity) * Number(item.unitPrice)
                    };
                });

                const realSubtotal = subtotal - tax;
                const total = subtotal;

                let compositePaymentMethod = '';
                if (s.payments.length === 1) {
                    compositePaymentMethod = s.payments[0].method;
                } else {
                    compositePaymentMethod = s.payments
                        .map((p: any) => `${p.method}:${p.amount.toFixed(2)}`)
                        .join(', ');
                }

                const totalPaid = calculateSalePayments(s);
                const change = Math.max(0, totalPaid - total);

                // Add random minutes to spread chronological timestamps inside the 1-hour block
                const randomMinute = Math.floor(Math.random() * 60);
                const finalDateObj = dayjs(blackoutDate)
                    .hour(Number(s.hourBlock))
                    .minute(randomMinute)
                    .second(0);

                if (finalDateObj.isAfter(dayjs())) {
                    message.warning(`La venta #${i + 1} (${blockLabel}) resultaría en una hora del futuro. Por favor, ajuste el bloque horario.`);
                    switchActiveSale(s.id);
                    return;
                }

                const finalDate = finalDateObj.toISOString();

                const saleDto = {
                    clientId: s.client?.id,
                    date: finalDate,
                    items: itemsDto,
                    subtotal: Math.round(realSubtotal * 100) / 100,
                    discount: 0,
                    tax: Math.round(tax * 100) / 100,
                    total: Math.round(total * 100) / 100,
                    paymentMethod: compositePaymentMethod,
                    tendered: Math.round(totalPaid * 100) / 100,
                    change: Math.round(change * 100) / 100,
                    exchangeRate: exchangeRate || 1,
                    cashSessionId,
                };

                await salesApi.create(saleDto);
            }

            message.success(`¡Lote de ${finalSalesList.length} ventas procesado con éxito!`);
            onCancel();

        } catch (error: any) {
            console.error(error);
            if (error?.errorFields) {
                message.warning('Verifique que todos los campos del formulario de la venta activa estén correctos.');
            } else {
                message.error(error?.response?.data?.message || 'Error al procesar el lote de ventas.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const paymentMethodOptions = [
        { label: 'Efectivo (Bs)', value: 'CASH' },
        { label: 'Punto de Venta', value: 'DEBIT' },
        { label: 'Pago Móvil', value: 'MOBILE' },
        { label: 'Crédito', value: 'CREDIT' },
        ...currencies.filter(c => !c.isPrimary && c.active).map(c => ({
            label: `Divisas (${c.name}) - Tasa: ${c.exchangeRate}`,
            value: `CURRENCY_${c.code}`
        }))
    ];

    const disabledDate = (current: dayjs.Dayjs) => {
        // Can not select days after today
        return current && current.isAfter(dayjs().endOf('day'));
    };

    return (
        <Modal
            title={
                <Row justify="space-between" align="middle" style={{ width: '100%', paddingRight: '24px' }}>
                    <Col>
                        <Space>
                            <ClockCircleOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                            <div>
                                <Title level={4} style={{ margin: 0 }}>Ventas Atrasadas por Lote</Title>
                                <Text type="secondary" style={{ fontSize: '12px' }}>Transcribir libreta de apagón</Text>
                            </div>
                        </Space>
                    </Col>
                    <Col>
                        <Space style={{ backgroundColor: '#f5f5f5', padding: '8px 12px', borderRadius: '8px' }}>
                            <CalendarOutlined style={{ color: '#1890ff' }} />
                            <Text strong>Día del Corte:</Text>
                            <DatePicker 
                                format="YYYY-MM-DD" 
                                value={blackoutDate} 
                                onChange={(val) => setBlackoutDate(val)} 
                                allowClear={false}
                                disabledDate={disabledDate}
                                style={{ width: '130px' }}
                            />
                        </Space>
                    </Col>
                </Row>
            }
            open={open}
            onCancel={onCancel}
            width={1050}
            footer={null}
            destroyOnClose
            styles={{ body: { padding: '16px 8px' } }}
        >
            <Row gutter={16}>
                {/* Left Sidebar: Transcribed Sales List */}
                <Col span={7}>
                    <Card 
                        size="small" 
                        title={<Text strong>Ventas del Corte</Text>}
                        extra={
                            <Button 
                                type="primary" 
                                size="small" 
                                icon={<PlusOutlined />} 
                                onClick={handleAddSale}
                            >
                                Nueva
                            </Button>
                        }
                        style={{ height: '530px', display: 'flex', flexDirection: 'column' }}
                        styles={{ body: { flex: 1, overflowY: 'auto', padding: '8px' } }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {salesList.map((s, idx) => {
                                const isActive = s.id === activeSaleId;
                                const blockLabel = HOUR_BLOCKS.find(hb => hb.value === s.hourBlock)?.label.split(' - ')[0] || `${s.hourBlock}:00`;
                                const total = getSaleDisplayTotal(s);
                                const clientName = s.id === activeSaleId 
                                    ? (selectedClient ? selectedClient.name : 'CONTADO')
                                    : (s.client ? s.client.name : 'CONTADO');

                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => switchActiveSale(s.id)}
                                        style={{
                                            padding: '10px 12px',
                                            borderRadius: '6px',
                                            border: isActive ? '1px solid #1890ff' : '1px solid #f0f0f0',
                                            backgroundColor: isActive ? '#e6f7ff' : '#fafafa',
                                            cursor: 'pointer',
                                            position: 'relative',
                                            transition: 'all 0.2s',
                                            boxShadow: isActive ? '0 2px 4px rgba(24, 144, 255, 0.1)' : 'none'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Text strong style={{ color: isActive ? '#1890ff' : 'inherit', fontSize: '13px' }}>
                                                Venta #{idx + 1} ({blockLabel})
                                            </Text>
                                            {salesList.length > 1 && (
                                                <Tooltip title="Eliminar venta del lote">
                                                    <Button
                                                        type="text"
                                                        danger
                                                        size="small"
                                                        icon={<DeleteOutlined />}
                                                        onClick={(e) => handleDeleteSale(s.id, e)}
                                                        style={{ height: '22px', width: '22px', padding: 0 }}
                                                    />
                                                </Tooltip>
                                            )}
                                        </div>
                                        <div style={{ marginTop: '2px', fontSize: '11px' }}>
                                            <Text type="secondary">{clientName}</Text>
                                        </div>
                                        <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
                                            <Text strong style={{ color: '#52c41a', fontSize: '13px' }}>
                                                {formatVenezuelanPrice(total, primaryCurrency?.symbol)}
                                            </Text>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Card>
                </Col>

                {/* Right Panel: Workspace Form for Active Sale */}
                <Col span={17}>
                    <Form
                        form={form}
                        layout="vertical"
                        style={{ height: '530px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                    >
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', paddingBottom: '8px' }}>
                            <Row gutter={12}>
                                <Col span={10}>
                                    <Form.Item
                                        name="hourBlock"
                                        label="Bloque de la Hora"
                                        rules={[{ required: true, message: 'Seleccione bloque horario' }]}
                                    >
                                        <Select 
                                            options={HOUR_BLOCKS} 
                                            onChange={(val) => updateActiveSaleState(null, val, null, null)} 
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={14}>
                                    <Form.Item label="Cliente">
                                        <Space.Compact style={{ width: '100%' }}>
                                            <Input
                                                readOnly
                                                value={selectedClient ? selectedClient.name : 'CONTADO'}
                                                prefix={<UserOutlined />}
                                            />
                                            <Button type="primary" onClick={() => setIsClientModalOpen(true)}>
                                                Seleccionar
                                            </Button>
                                            {selectedClient && (
                                                <Button danger onClick={() => {
                                                    setSelectedClient(null);
                                                    updateActiveSaleState(null, null, null, null);
                                                }}>
                                                    X
                                                </Button>
                                            )}
                                        </Space.Compact>
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Card size="small" title="Productos" style={{ marginBottom: 12 }} styles={{ body: { padding: '8px' } }}>
                                <Form.List name="items">
                                    {(fields, { add, remove }) => (
                                        <>
                                            {fields.map(({ key, name, ...restField }) => (
                                                <React.Fragment key={key}>
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, 'productRef']}
                                                        noStyle
                                                    >
                                                        <Input type="hidden" />
                                                    </Form.Item>
                                                    <Row gutter={6} align="middle" style={{ marginBottom: 6 }}>
                                                        <Col flex="auto">
                                                            <Form.Item
                                                                {...restField}
                                                                name={[name, 'productId']}
                                                                noStyle
                                                                rules={[{ required: true, message: 'Requerido' }]}
                                                            >
                                                                <Select
                                                                    showSearch
                                                                    placeholder="Buscar producto..."
                                                                    filterOption={false}
                                                                    onSearch={debouncedSearchProducts}
                                                                    onChange={(val) => handleProductSelect(val, name)}
                                                                    loading={searchingProducts}
                                                                    options={productOptions}
                                                                    style={{ width: '100%' }}
                                                                />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col flex="none">
                                                            <Form.Item
                                                                {...restField}
                                                                name={[name, 'isSecondaryUnit']}
                                                                valuePropName="checked"
                                                                noStyle
                                                            >
                                                                <Switch 
                                                                    checkedChildren="Sec" 
                                                                    unCheckedChildren="Pri" 
                                                                    onChange={(checked) => handleUnitToggle(checked, name)}
                                                                    disabled={!formItems[name]?.productRef?.secondaryUnitId}
                                                                />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={3}>
                                                            <Form.Item
                                                                {...restField}
                                                                name={[name, 'quantity']}
                                                                noStyle
                                                                rules={[{ required: true }]}
                                                            >
                                                                <InputNumber 
                                                                    placeholder="Cant." 
                                                                    min={0.001} 
                                                                    style={{ width: '100%' }} 
                                                                    onChange={() => {
                                                                        setTimeout(() => {
                                                                            const items = form.getFieldValue('items');
                                                                            updateActiveSaleState(null, null, items, null);
                                                                        }, 50);
                                                                    }}
                                                                />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col span={4}>
                                                            <Form.Item
                                                                {...restField}
                                                                name={[name, 'unitPrice']}
                                                                noStyle
                                                                rules={[{ required: true }]}
                                                            >
                                                                <InputNumber 
                                                                    placeholder="Precio Bs" 
                                                                    min={0} 
                                                                    style={{ width: '100%' }} 
                                                                    onChange={() => {
                                                                        setTimeout(() => {
                                                                            const items = form.getFieldValue('items');
                                                                            updateActiveSaleState(null, null, items, null);
                                                                        }, 50);
                                                                    }}
                                                                />
                                                            </Form.Item>
                                                        </Col>
                                                        <Col flex="none">
                                                            <Button danger icon={<DeleteOutlined />} onClick={() => {
                                                                remove(name);
                                                                setTimeout(() => {
                                                                    const items = form.getFieldValue('items');
                                                                    updateActiveSaleState(null, null, items, null);
                                                                }, 50);
                                                            }} />
                                                        </Col>
                                                    </Row>
                                                </React.Fragment>
                                            ))}
                                            <Form.Item style={{ marginBottom: 0 }}>
                                                <Button type="dashed" onClick={() => add({})} block icon={<PlusOutlined />}>
                                                    Agregar Producto
                                                </Button>
                                            </Form.Item>
                                        </>
                                    )}
                                </Form.List>
                                
                                <Row style={{ marginTop: 8 }}>
                                    <Col span={24} style={{ textAlign: 'right' }}>
                                        {taxEnabled && (
                                            <div style={{ fontSize: '11px', color: '#8c8c8c', lineHeight: '1.2' }}>
                                                Base: {formatVenezuelanPrice(totals.subtotal, primaryCurrency?.symbol)} | 
                                                IVA: {formatVenezuelanPrice(totals.tax, primaryCurrency?.symbol)}
                                            </div>
                                        )}
                                        <Title level={5} style={{ margin: 0, color: '#1890ff' }}>
                                            Total: {formatVenezuelanPrice(totals.total, primaryCurrency?.symbol)}
                                        </Title>
                                    </Col>
                                </Row>
                            </Card>

                            <Card size="small" title="Métodos de Pago (Multimoneda)" styles={{ body: { padding: '8px' } }}>
                                <Form.List name="payments">
                                    {(fields, { add, remove }) => (
                                        <>
                                            {fields.map(({ key, name, ...restField }) => (
                                                <Row key={key} gutter={6} align="middle" style={{ marginBottom: 6 }}>
                                                    <Col span={11}>
                                                        <Form.Item
                                                            {...restField}
                                                            name={[name, 'method']}
                                                            noStyle
                                                            rules={[{ required: true }]}
                                                        >
                                                            <Select 
                                                                options={paymentMethodOptions} 
                                                                style={{ width: '100%' }} 
                                                                onChange={() => {
                                                                    setTimeout(() => {
                                                                        const p = form.getFieldValue('payments');
                                                                        updateActiveSaleState(null, null, null, p);
                                                                    }, 50);
                                                                }}
                                                            />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col span={11}>
                                                        <Form.Item
                                                            {...restField}
                                                            name={[name, 'amount']}
                                                            noStyle
                                                            rules={[{ required: true }]}
                                                        >
                                                            <InputNumber 
                                                                placeholder="Monto" 
                                                                min={0.01} 
                                                                style={{ width: '100%' }} 
                                                                onChange={() => {
                                                                    setTimeout(() => {
                                                                        const p = form.getFieldValue('payments');
                                                                        updateActiveSaleState(null, null, null, p);
                                                                    }, 50);
                                                                }}
                                                            />
                                                        </Form.Item>
                                                    </Col>
                                                    <Col flex="none">
                                                        {fields.length > 1 && (
                                                            <Button danger icon={<DeleteOutlined />} onClick={() => {
                                                                remove(name);
                                                                setTimeout(() => {
                                                                    const p = form.getFieldValue('payments');
                                                                    updateActiveSaleState(null, null, null, p);
                                                                }, 50);
                                                            }} />
                                                        )}
                                                    </Col>
                                                </Row>
                                            ))}
                                            <Form.Item style={{ marginBottom: 0 }}>
                                                <Button 
                                                    type="dashed" 
                                                    onClick={() => add({ method: 'CASH', amount: paymentTotals.remaining > 0 ? Number((paymentTotals.remaining).toFixed(2)) : 0 })} 
                                                    block 
                                                    icon={<PlusOutlined />}
                                                >
                                                    Agregar Pago
                                                </Button>
                                            </Form.Item>
                                        </>
                                    )}
                                </Form.List>

                                <Divider style={{ margin: '8px 0' }} />
                                <Row style={{ fontSize: '12px' }}>
                                    <Col span={8}>
                                        <Text type="secondary">Pagado: </Text>
                                        <Text strong>{formatVenezuelanPrice(paymentTotals.totalPaidInBs, primaryCurrency?.symbol)}</Text>
                                    </Col>
                                    <Col span={8}>
                                        <Text type="secondary">Restante: </Text>
                                        <Text strong type={paymentTotals.remaining > 0 ? "danger" : "secondary"}>
                                            {formatVenezuelanPrice(paymentTotals.remaining, primaryCurrency?.symbol)}
                                        </Text>
                                    </Col>
                                    <Col span={8}>
                                        <Text type="secondary">Cambio: </Text>
                                        <Text strong type="success">{formatVenezuelanPrice(paymentTotals.change, primaryCurrency?.symbol)}</Text>
                                    </Col>
                                </Row>
                            </Card>
                        </div>

                        {/* Bottom Workspace Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f0f0f0', paddingTop: '12px', marginTop: '8px' }}>
                            <Space size="middle">
                                <Button onClick={onCancel}>Cerrar</Button>
                                <Button 
                                    type="primary" 
                                    size="large" 
                                    icon={<SaveOutlined />} 
                                    loading={isSubmitting} 
                                    onClick={handleSubmitBatch}
                                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                                >
                                    Procesar Lote ({salesList.length} {salesList.length === 1 ? 'Venta' : 'Ventas'})
                                </Button>
                            </Space>
                        </div>
                    </Form>
                </Col>
            </Row>

            <ClientSelectionModal
                open={isClientModalOpen}
                onSelect={(client) => {
                    setSelectedClient(client);
                    setIsClientModalOpen(false);
                    updateActiveSaleState(client, null, null, null);
                }}
                onCancel={() => setIsClientModalOpen(false)}
            />
        </Modal>
    );
};
