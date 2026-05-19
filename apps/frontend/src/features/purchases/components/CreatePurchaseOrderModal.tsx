import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, Button, Table, InputNumber, message, Divider, Row, Col, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { suppliersApi } from '../../../services/suppliersApi';
import type { Supplier } from '../../../services/suppliersApi';
import { productsApi } from '../../../services/productsApi';
import type { Product } from '../../../services/productsApi';
import { purchaseOrdersApi } from '../../../services/purchaseOrdersApi';
import type { CreatePurchaseOrderDto } from '../../../services/purchaseOrdersApi';
import { currenciesApi } from '../../../services/currenciesApi';
import type { Currency } from '../../../services/currenciesApi';

interface CreatePurchaseOrderModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

/**
 * CreatePurchaseOrderModal Component
 * Workflow for drafting a new purchase order for a supplier.
 * Features: Multi-currency support, product search with debouncing, and estimated total calculation.
 */
export const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({ visible, onCancel, onSuccess }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        if (visible) {
            loadSuppliers();
            loadCurrencies();
            setSelectedItems([]);
            form.resetFields();
            form.setFieldValue('orderDate', dayjs());
        }
    }, [visible]);

    const loadCurrencies = async () => {
        try {
            const data = await currenciesApi.getAll();
            setCurrencies(data);
            const primary = data.find(c => c.isPrimary);
            if (primary) {
                setSelectedCurrency(primary);
                form.setFieldValue('currencyCode', primary.code);
            }
        } catch (error) {
            console.error('Error loading currencies', error);
        }
    };

    const loadSuppliers = async () => {
        try {
            const data = await suppliersApi.getAll(undefined, true);
            setSuppliers(data);
        } catch (error) {
            console.error('Error loading suppliers', error);
        }
    };

    /**
     * Searches for active products to add to the order.
     */
    const searchProducts = async (term: string) => {
        try {
            const data = await productsApi.getAll({ search: term, active: true });
            setProducts(data);
        } catch (error) {
            console.error('Error searching products', error);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchText) searchProducts(searchText);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchText]);

    const handleAddItem = (product: Product) => {
        if (selectedItems.find(item => item.productId === product.id)) {
            message.warning(t('common.product_already_in_list', { defaultValue: 'Product is already in the list' }));
            return;
        }

        const newItem = {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: 1,
            cost: product.costPrice || 0,
            subtotal: product.costPrice || 0,
        };
        setSelectedItems([...selectedItems, newItem]);
        message.success(t('common.product_added', { defaultValue: 'Product added' }));
    };

    /**
     * Updates an item's quantity or estimated cost in the order list.
     */
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

    /**
     * Submits the purchase order data to the backend.
     */
    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();

            if (selectedItems.length === 0) {
                message.error(t('common.add_at_least_one_product', { defaultValue: 'Please add at least one product' }));
                return;
            }

            setLoading(true);

            const orderData: CreatePurchaseOrderDto = {
                supplierId: values.supplierId,
                orderDate: values.orderDate.toDate(),
                expectedDate: values.expectedDate?.toDate(),
                items: selectedItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    cost: item.cost
                })),
                currencyCode: values.currencyCode,
                exchangeRate: selectedCurrency?.exchangeRate ? Number(selectedCurrency.exchangeRate) : 1,
                notes: values.notes
            };

            await purchaseOrdersApi.create(orderData);
            message.success(t('common.success_create_order', { defaultValue: 'Purchase order created successfully' }));
            onSuccess();
        } catch (error: any) {
            console.error(error);
            message.error(error.response?.data?.message || t('common.error_create_order', { defaultValue: 'Error creating purchase order' }));
        } finally {
            setLoading(false);
        }
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
            title: `${t('common.est_cost', { defaultValue: 'Est. Cost' })} (${selectedCurrency?.symbol || '$'})`,
            key: 'cost',
            render: (_: any, record: any) => (
                <InputNumber
                    min={0}
                    step={0.01}
                    value={record.cost}
                    onChange={(val) => updateItem(record.productId, 'cost', Number(val))}
                    style={{ width: 100 }}
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
            title={t('common.new_purchase_order', { defaultValue: 'New Purchase Order' })}
            open={visible}
            onCancel={onCancel}
            width={900}
            forceRender
            footer={[
                <Button key="back" onClick={onCancel}>{t('common.cancel')}</Button>,
                <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
                    {t('common.create_order', { defaultValue: 'Create Order' })}
                </Button>
            ]}
        >
            <Form form={form} layout="vertical">
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="supplierId" label={t('common.supplier', { defaultValue: 'Supplier' })} rules={[{ required: true }]}>
                            <Select
                                showSearch
                                placeholder={t('common.select_supplier', { defaultValue: 'Select supplier' })}
                                optionFilterProp="children"
                            >
                                {suppliers.map(s => (
                                    <Select.Option key={s.id} value={s.id}>{s.comercialName}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="orderDate" label={t('common.order_date', { defaultValue: 'Order Date' })} rules={[{ required: true }]}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="expectedDate" label={t('common.expected_delivery_date', { defaultValue: 'Expected Delivery Date' })}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="currencyCode" label={t('common.currency')} rules={[{ required: true }]}>
                            <Select
                                placeholder={t('common.select_currency', { defaultValue: 'Select currency' })}
                                onChange={(val) => {
                                    const curr = currencies.find(c => c.code === val);
                                    if (curr) setSelectedCurrency(curr);
                                }}
                            >
                                {currencies.map(c => (
                                    <Select.Option key={c.id} value={c.code}>{c.name} ({c.symbol})</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={16}>
                        <Form.Item name="notes" label={t('common.notes', { defaultValue: 'Notes / Comments' })}>
                            <Input placeholder={t('common.purchase_notes_placeholder', { defaultValue: 'e.g. Urgent delivery, payment on arrival, etc.' })} />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>

            <Divider>{t('common.select_products', { defaultValue: 'Select Products' })}</Divider>

            <div style={{ marginBottom: 16 }}>
                <Select
                    showSearch
                    placeholder={t('common.search_product_placeholder', { defaultValue: 'Search product by SKU or Name...' })}
                    style={{ width: '100%' }}
                    defaultActiveFirstOption={false}
                    suffixIcon={null}
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
                            {p.name} ({p.sku}) - {t('common.current_stock', { defaultValue: 'Current Stock' })}: {p.stock}
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
                    const total = calculateTotal();
                    return (
                        <Table.Summary.Row>
                            <Table.Summary.Cell index={0} colSpan={3} align="right">
                                <Typography.Text strong>{t('common.estimated_total', { defaultValue: 'ESTIMATED TOTAL' })}</Typography.Text>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={1}>
                                <Typography.Text type="success" strong>
                                    {selectedCurrency?.symbol || ''} {total.toFixed(2)}
                                </Typography.Text>
                            </Table.Summary.Cell>
                        </Table.Summary.Row>
                    );
                }}
            />
        </Modal>
    );
};
