import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, Button, Table, InputNumber, message, Divider, Row, Col, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
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

interface CreatePurchaseModalProps {
    visible: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

export const CreatePurchaseModal: React.FC<CreatePurchaseModalProps> = ({ visible, onCancel, onSuccess }) => {
    const [form] = Form.useForm();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [currencies, setCurrencies] = useState<Currency[]>([]);
    const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
    const [exchangeRate, setExchangeRate] = useState<number>(1);
    const [products, setProducts] = useState<Product[]>([]); // For search
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [priceUpdateModalVisible, setPriceUpdateModalVisible] = useState(false);
    const [productsWithCostChange, setProductsWithCostChange] = useState<any[]>([]);
    const [priceUpdateLoading, setPriceUpdateLoading] = useState(false);

    // Load initial data
    useEffect(() => {
        if (visible) {
            loadSuppliers();
            loadCurrencies();
            setSelectedItems([]);
            form.resetFields();
            form.setFieldValue('invoiceDate', dayjs());
            setExchangeRate(1);
            setSelectedCurrency(null);
        }
    }, [visible]);

    const loadCurrencies = async () => {
        const data = await currenciesApi.getAll();
        setCurrencies(data);
        // Default to primary? Or let user select.
        const primary = data.find(c => c.isPrimary);
        if (primary) {
            setSelectedCurrency(primary);
            form.setFieldValue('currencyCode', primary.code);
        }
    };

    // Simple product search effect
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
            message.warning('El producto ya está en la lista');
            return;
        }

        const newItem = {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: 1,
            cost: product.costPrice, // Default to current cost
            subtotal: product.costPrice,
            currentCost: product.costPrice
        };
        setSelectedItems([...selectedItems, newItem]);
        message.success('Producto agregado');
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
            const values = await form.validateFields(); // Supplier, Date, Invoice #

            if (selectedItems.length === 0) {
                message.error('Debe agregar al menos un producto');
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
                exchangeRate: exchangeRate
            };

            const result: any = await purchasesApi.create(purchaseData);
            message.success('Compra registrada exitosamente');

            // Check if there are products with cost changes
            if (result.productsWithCostChange && result.productsWithCostChange.length > 0) {
                setProductsWithCostChange(result.productsWithCostChange);
                setPriceUpdateModalVisible(true);
            } else {
                onSuccess();
            }
        } catch (error) {
            console.error(error);
            message.error('Error al registrar la compra');
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
            }));

            await productsApi.batchUpdatePrices(updates);
            message.success('Precios actualizados exitosamente');
            setPriceUpdateModalVisible(false);
            onSuccess();
        } catch (error) {
            console.error(error);
            message.error('Error al actualizar precios');
        } finally {
            setPriceUpdateLoading(false);
        }
    };

    const handlePriceUpdateCancel = () => {
        setPriceUpdateModalVisible(false);
        onSuccess(); // Close main modal and refresh
    };

    const columns = [
        { title: 'Producto', dataIndex: 'productName', key: 'name' },
        {
            title: 'Cantidad',
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
            title: `Costo Unit. (${selectedCurrency?.symbol || '$'})`,
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
                            <span style={{ color: 'orange', fontSize: 10 }}>Diff</span> : null
                    }
                />
            )
        },
        {
            title: 'Total',
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
            title="Registrar Compra / Recepción"
            open={visible}
            onCancel={onCancel}
            width={900}
            footer={[
                <Button key="back" onClick={onCancel}>Cancelar</Button>,
                <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
                    Procesar Compra
                </Button>
            ]}
        >
            <Form form={form} layout="vertical">
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="supplierId" label="Proveedor" rules={[{ required: true }]}>
                            <Select
                                showSearch
                                placeholder="Seleccionar proveedor"
                                optionFilterProp="children"
                            >
                                {suppliers.map(s => (
                                    <Select.Option key={s.id} value={s.id}>{s.comercialName}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="invoiceDate" label="Fecha Factura" rules={[{ required: true }]}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="invoiceNumber" label="N° Control / Factura">
                            <Input placeholder="00-000000" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="currencyCode" label="Moneda de Pago" rules={[{ required: true }]}>
                            <Select
                                placeholder="Moneda"
                                onChange={(val) => {
                                    const curr = currencies.find(c => c.code === val);
                                    if (curr) {
                                        setSelectedCurrency(curr);
                                        // Set exchange rate default
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
                            <Form.Item label={`Tasa de Cambio (${selectedCurrency.code})`}>
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

            <Divider>Productos</Divider>

            <div style={{ marginBottom: 16 }}>
                <Select
                    showSearch
                    placeholder="Buscar producto para agregar..."
                    style={{ width: '100%' }}
                    defaultActiveFirstOption={false}
                    showArrow={false}
                    filterOption={false}
                    onSearch={setSearchText}
                    onChange={(val) => {
                        // Find product in results
                        const prod = products.find(p => p.id === val);
                        if (prod) {
                            handleAddItem(prod);
                            setSearchText(''); // Clear search
                        }
                    }}
                    notFoundContent={null}
                >
                    {products.map(p => (
                        <Select.Option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) - Stock: {p.stock}
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
                                <Typography.Text strong>TOTAL</Typography.Text>
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

            <PriceUpdateConfirmModal
                visible={priceUpdateModalVisible}
                products={productsWithCostChange}
                currencySymbol={selectedCurrency?.symbol || '$'}
                onConfirm={handlePriceUpdateConfirm}
                onCancel={handlePriceUpdateCancel}
                loading={priceUpdateLoading}
            />
        </Modal>
    );
};
