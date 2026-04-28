import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, Button, Table, InputNumber, message, Divider, Row, Col, Typography, Space } from 'antd';
import { DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { suppliersApi } from '../../../services/suppliersApi';
import type { Supplier } from '../../../services/suppliersApi';
import { productsApi } from '../../../services/productsApi';
import type { Product } from '../../../services/productsApi';
import { purchasesApi } from '../../../services/purchasesApi';
import type { CreatePurchaseDto } from '../../../services/purchasesApi';
import { currenciesApi } from '../../../services/currenciesApi';
import type { Currency } from '../../../services/currenciesApi';
import { PriceUpdateConfirmModal } from './PriceUpdateConfirmModal';
import { purchaseOrdersApi } from '../../../services/purchaseOrdersApi';
import type { PurchaseOrder } from '../../../services/purchaseOrdersApi';

interface CreatePurchaseModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

/**
 * CreatePurchaseModal Component
 * Workflow for registering new purchases and inventory reception.
 * Allows loading data from existing Purchase Orders and updating product costs in batch.
 */
export const CreatePurchaseModal: React.FC<CreatePurchaseModalProps> = ({ visible, onCancel, onSuccess }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
    const [exchangeRate, setExchangeRate] = useState<number>(1);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [priceUpdateModalVisible, setPriceUpdateModalVisible] = useState(false);
    const [productsWithCostChange, setProductsWithCostChange] = useState<any[]>([]);
    const [priceUpdateLoading, setPriceUpdateLoading] = useState(false);
    const [pendingOrders, setPendingOrders] = useState<PurchaseOrder[]>([]);
    const [orderSelectionVisible, setOrderSelectionVisible] = useState(false);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    // Initial load
    useEffect(() => {
        if (visible) {
            loadSuppliers();
            loadCurrencies();
            loadPendingOrders();
            setSelectedItems([]);
            form.resetFields();
            form.setFieldValue('invoiceDate', dayjs());
            setExchangeRate(1);
            setSelectedCurrency(null);
            setSelectedOrderId(null);
        }
    }, [visible]);

    const loadPendingOrders = async () => {
        try {
            const data = await purchaseOrdersApi.getAll();
            setPendingOrders(data.filter((o: PurchaseOrder) => o.status === 'PENDING'));
        } catch (error) {
            console.error('Error loading pending orders', error);
        }
    };

    /**
     * Fills the form using data from a selected Purchase Order.
     */
    const handleSelectOrder = (orderId: string) => {
        const order = pendingOrders.find(o => o.id === orderId);
        if (!order) return;

        setSelectedOrderId(order.id);
        form.setFieldsValue({
            supplierId: order.supplierId,
            currencyCode: order.currencyCode,
        });

        const curr = currencies.find(c => c.code === order.currencyCode);
        if (curr) {
            setSelectedCurrency(curr);
            setExchangeRate(Number(order.exchangeRate) || 1);
        }

        const newItems = order.items.map(item => ({
            productId: item.productId,
            productName: item.product?.name || 'Unknown Product',
            sku: item.product?.sku || 'N/A',
            quantity: Number(item.quantity),
            cost: Number(item.cost),
            subtotal: Number(item.total),
            currentCost: 0
        }));

        setSelectedItems(newItems);
        setOrderSelectionVisible(false);
        message.success(t('common.order_loaded_success', { defaultValue: 'Order loaded successfully. Please verify items and quantities.' }));
    };

    const loadCurrencies = async () => {
        const data = await currenciesApi.getAll();
        setCurrencies(data);
        const primary = data.find(c => c.isPrimary);
        if (primary) {
            setSelectedCurrency(primary);
            form.setFieldValue('currencyCode', primary.code);
        }
    };

    // Debounced product search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchText) searchProducts(searchText);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchText]);


    const loadSuppliers = async () => {
        const data = await suppliersApi.getAll(undefined, true);
        setSuppliers(data);
    };

    const searchProducts = async (term: string) => {
        try {
            const data = await productsApi.getAll({ search: term, active: true });
            setProducts(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddItem = (product: Product) => {
        if (selectedItems.find(item => item.productId === product.id)) {
            message.warning(t('common.product_already_in_list', { defaultValue: 'Product already in list' }));
            return;
        }

        const newItem = {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: 1,
            cost: product.costPrice,
            subtotal: product.costPrice,
            currentCost: product.costPrice
        };
        setSelectedItems([...selectedItems, newItem]);
        message.success(t('common.product_added', { defaultValue: 'Product added' }));
    };

    const updateItem = (productId: string, field: string, value: number) => {
        const updated = selectedItems.map(item => {
            if (item.productId === productId) {
                const newItem = { ...item, [field]: value };
                newItem.subtotal = newItem.quantity * newItem.cost;
                return newItem;
            }
            return item;
        });
        setSelectedItems(updated);
    };

    const removeItem = (productId: string) => {
        setSelectedItems(selectedItems.filter(item => item.productId !== productId));
    };

    const calculateTotal = () => {
        return selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (selectedItems.length === 0) {
                message.error(t('common.add_at_least_one_product', { defaultValue: 'At least one product must be added' }));
                return;
            }

            setLoading(true);

            const purchaseData: CreatePurchaseDto = {
                supplierId: values.supplierId,
                invoiceDate: values.invoiceDate.toDate(),
                invoiceNumber: values.invoiceNumber,
                items: selectedItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    cost: item.cost
                })),
                currencyCode: selectedCurrency?.code || 'VES',
                exchangeRate: exchangeRate,
                taxAmount: values.taxAmount || 0,
                purchaseOrderId: selectedOrderId || undefined
            };

            const result: any = await purchasesApi.create(purchaseData);
            message.success(t('common.success_register_purchase', { defaultValue: 'Purchase registered successfully' }));

            // Handle cost changes if any
            if (result.productsWithCostChange && result.productsWithCostChange.length > 0) {
                setProductsWithCostChange(result.productsWithCostChange);
                setPriceUpdateModalVisible(true);
            } else {
                onSuccess();
            }
        } catch (error) {
            console.error(error);
            message.error(t('common.error_register_purchase', { defaultValue: 'Error registering purchase' }));
        } finally {
            setLoading(false);
        }
    };

    const handlePriceUpdateConfirm = async () => {
        try {
            setPriceUpdateLoading(true);
            const updates = productsWithCostChange.map(p => ({
                productId: p.productId,
                newCostPrice: p.newCost,
                salePriceMargin: p.salePriceMargin,
                offerPriceMargin: p.offerPriceMargin,
                wholesalePriceMargin: p.wholesalePriceMargin,
                currencyId: p.currencyId,
            }));

            await productsApi.batchUpdatePrices(updates);
            message.success(t('common.prices_updated_success', { defaultValue: 'Prices updated successfully' }));

            setPriceUpdateLoading(false);
            setPriceUpdateModalVisible(false);

            setTimeout(() => {
                onSuccess();
            }, 300);
        } catch (error) {
            console.error(error);
            message.error(t('common.error_updating_prices', { defaultValue: 'Error updating prices' }));
            setPriceUpdateLoading(false);
        }
    };

    const handlePriceUpdateCancel = () => {
        setPriceUpdateModalVisible(false);
        setTimeout(() => {
            onSuccess();
        }, 300);
    };

    const columns = [
        { title: t('common.product', { defaultValue: 'Product' }), dataIndex: 'productName', key: 'name' },
        {
            title: t('common.quantity'),
            key: 'quantity',
            render: (_: any, record: any) => (
                <InputNumber
                    min={0.001}
                    value={record.quantity}
                    onChange={(val) => updateItem(record.productId, 'quantity', Number(val))}
                    style={{ width: 80 }}
                />
            )
        },
        {
            title: `${t('common.unit_cost', { defaultValue: 'Unit Cost' })} (${selectedCurrency?.symbol || '$'})`,
            key: 'cost',
            render: (_: any, record: any) => (
                <InputNumber
                    min={0}
                    step={0.01}
                    value={record.cost}
                    onChange={(val) => updateItem(record.productId, 'cost', Number(val))}
                    style={{ width: 100 }}
                    addonBefore={
                        record.currentCost !== record.cost ?
                            <span style={{ color: 'orange', fontSize: 10 }}>{t('common.diff', { defaultValue: 'Diff' })}</span> : null
                    }
                />
            )
        },
        {
            title: t('common.total'),
            key: 'total',
            render: (_: any, record: any) => (record.quantity * record.cost).toFixed(2)
        },
        {
            title: '',
            key: 'action',
            render: (_: any, record: any) => (
                <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(record.productId)} />
            )
        }
    ];

    return (
        <Modal
            title={
                <Row align="middle" justify="space-between" style={{ marginRight: 32 }}>
                    <Col>Register Purchase / Reception</Col>
                    <Col>
                        {pendingOrders.length > 0 && (
                            <Button
                                size="small"
                                icon={<SearchOutlined />}
                                onClick={() => setOrderSelectionVisible(true)}
                                type="dashed"
                            >
                                {t('common.load_from_order', { defaultValue: 'Load from Order' })} ({pendingOrders.length})
                            </Button>
                        )}
                    </Col>
                </Row>
            }
            open={visible}
            onCancel={onCancel}
            width={900}
            footer={[
                <Button key="back" onClick={onCancel}>{t('common.cancel')}</Button>,
                <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
                    {t('common.process_purchase', { defaultValue: 'Process Purchase' })}
                </Button>
            ]}
        >
            <Form form={form} layout="vertical">
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="supplierId" label={t('common.supplier')} rules={[{ required: true }]}>
                            <Select
                                showSearch
                                placeholder={t('common.select_supplier')}
                                optionFilterProp="children"
                            >
                                {suppliers.map(s => (
                                    <Select.Option key={s.id} value={s.id}>{s.comercialName}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="invoiceDate" label={t('common.invoice_date', { defaultValue: 'Invoice Date' })} rules={[{ required: true }]}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="invoiceNumber" label={t('common.invoice_control_number', { defaultValue: 'Control / Invoice #' })}>
                            <Input placeholder="00-000000" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="currencyCode" label={t('common.payment_currency', { defaultValue: 'Payment Currency' })} rules={[{ required: true }]}>
                            <Select
                                placeholder={t('common.currency')}
                                onChange={(val) => {
                                    const curr = currencies.find(c => c.code === val);
                                    if (curr) {
                                        setSelectedCurrency(curr);
                                        const rate = Number(curr.exchangeRate) || 1;
                                        setExchangeRate(rate);
                                    }
                                }}
                            >
                                {currencies.map(c => (
                                    <Select.Option key={c.id} value={c.code}>{c.name} ({c.symbol})</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    {selectedCurrency && !selectedCurrency.isPrimary && (
                        <Col span={8}>
                            <Form.Item label={`${t('common.exchange_rate', { defaultValue: 'Exchange Rate' })} (${selectedCurrency.code})`}>
                                <InputNumber
                                    min={0.0001}
                                    step={0.01}
                                    style={{ width: '100%' }}
                                    value={exchangeRate}
                                    onChange={(val) => setExchangeRate(Number(val))}
                                />
                            </Form.Item>
                        </Col>
                    )}
                </Row>
            </Form>

            <Divider>Products</Divider>

            <div style={{ marginBottom: 16 }}>
                <Select
                    showSearch
                    placeholder="Search product to add..."
                    style={{ width: '100%' }}
                    defaultActiveFirstOption={false}
                    showArrow={false}
                    filterOption={false}
                    onSearch={setSearchText}
                    onChange={(val) => {
                        const prod = products.find(p => p.id === val);
                        if (prod) {
                            handleAddItem(prod);
                            setSearchText('');
                        }
                    }}
                    notFoundContent={null}
                >
                    {products.map(p => (
                        <Select.Option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) - {t('common.stock', { defaultValue: 'Stock' })}: {p.stock}
                        </Select.Option>
                    ))}
                </Select>
            </div>

            <Table
                columns={columns}
                dataSource={selectedItems}
                rowKey="productId"
                pagination={false}
                size="small"
                summary={() => {
                    const subtotal = calculateTotal();
                    const taxAmount = form.getFieldValue('taxAmount') || 0;
                    const total = subtotal + taxAmount;
                    return (
                        <>
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={3} align="right">
                                    <Typography.Text strong>{t('common.subtotal')}</Typography.Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={1}>
                                    <Typography.Text strong>
                                        {selectedCurrency?.symbol || ''} {subtotal.toFixed(2)}
                                    </Typography.Text>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={3} align="right">
                                    <Space>
                                        <Typography.Text type="secondary">{t('common.tax_deductible_vat', { defaultValue: 'Tax Deductible (VAT)' })}</Typography.Text>
                                        <Form.Item name="isTaxable" valuePropName="checked" noStyle>
                                            <Select
                                                size="small"
                                                style={{ width: 60 }}
                                                onChange={(val) => {
                                                    if (!val) form.setFieldValue('taxAmount', 0);
                                                    else form.setFieldValue('taxAmount', subtotal * 0.16);
                                                }}
                                                options={[
                                                    { value: true, label: t('common.yes') },
                                                    { value: false, label: t('common.no') }
                                                ]}
                                            />
                                        </Form.Item>
                                        <Typography.Text strong>{t('common.vat_16', { defaultValue: 'VAT (16%)' })}</Typography.Text>
                                    </Space>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={1}>
                                    <Form.Item name="taxAmount" noStyle>
                                        <InputNumber
                                            size="small"
                                            min={0}
                                            step={0.01}
                                            style={{ width: 100 }}
                                            disabled={!form.getFieldValue('isTaxable')}
                                        />
                                    </Form.Item>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                            <Table.Summary.Row style={{ background: '#fafafa' }}>
                                <Table.Summary.Cell index={0} colSpan={3} align="right">
                                    <Typography.Text strong style={{ fontSize: 16 }}>{t('common.total')}</Typography.Text>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={1}>
                                    <Typography.Text type="success" strong style={{ fontSize: 16 }}>
                                        {selectedCurrency?.symbol || ''} {total.toFixed(2)}
                                    </Typography.Text>
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                        </>
                    );
                }}
            />

            <PriceUpdateConfirmModal
                visible={priceUpdateModalVisible}
                products={productsWithCostChange}
                currencySymbol={selectedCurrency?.symbol || '$'}
                onConfirm={handlePriceUpdateConfirm}
                onCancel={handlePriceUpdateCancel}
                loading={priceUpdateLoading}
            />

            {/* Order Selection Modal */}
            <Modal
                title={t('common.select_pending_order', { defaultValue: 'Select Pending Order' })}
                open={orderSelectionVisible}
                onCancel={() => setOrderSelectionVisible(false)}
                footer={null}
                width={700}
            >
                <Table
                    dataSource={pendingOrders}
                    rowKey="id"
                    size="small"
                    columns={[
                        { title: t('common.order_number', { defaultValue: 'Order #' }), dataIndex: 'id', render: (id) => id.slice(0, 8) },
                        { title: t('common.supplier'), dataIndex: ['supplier', 'comercialName'] },
                        { title: t('common.date'), dataIndex: 'orderDate', render: (d) => dayjs(d).format('DD/MM/YYYY') },
                        { title: t('common.total'), dataIndex: 'total', render: (t, r) => `${r.currencyCode} ${t}` },
                        {
                            title: t('common.action', { defaultValue: 'Action' }),
                            render: (_, record) => (
                                <Button type="primary" size="small" onClick={() => handleSelectOrder(record.id)}>
                                    {t('common.select', { defaultValue: 'Select' })}
                                </Button>
                            )
                        }
                    ]}
                />
            </Modal>
        </Modal>
    );
};
