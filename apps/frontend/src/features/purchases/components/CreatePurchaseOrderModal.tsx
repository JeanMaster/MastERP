import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, Button, Table, InputNumber, message, Divider, Row, Col, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
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

export const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({ visible, onCancel, onSuccess }) => {
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
        const data = await currenciesApi.getAll();
        setCurrencies(data);
        const primary = data.find(c => c.isPrimary);
        if (primary) {
            setSelectedCurrency(primary);
            form.setFieldValue('currencyCode', primary.code);
        }
    };

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

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchText) searchProducts(searchText);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchText]);

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
            cost: product.costPrice || 0,
            subtotal: product.costPrice || 0,
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
            const values = await form.validateFields();

            if (selectedItems.length === 0) {
                message.error('Debe agregar al menos un producto');
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
            message.success('Pedido creado exitosamente');
            onSuccess();
        } catch (error) {
            console.error(error);
            message.error('Error al crear el pedido');
        } finally {
            setLoading(false);
        }
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
            title: `Costo Est. (${selectedCurrency?.symbol || '$'})`,
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
            title="Nuevo Pedido a Proveedor"
            open={visible}
            onCancel={onCancel}
            width={900}
            footer={[
                <Button key="back" onClick={onCancel}>Cancelar</Button>,
                <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
                    Crear Pedido
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
                        <Form.Item name="orderDate" label="Fecha del Pedido" rules={[{ required: true }]}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                    <Col span={8}>
                        <Form.Item name="expectedDate" label="Fecha Estimada Recepción">
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>
                    </Col>
                </Row>
                <Row gutter={16}>
                    <Col span={8}>
                        <Form.Item name="currencyCode" label="Moneda" rules={[{ required: true }]}>
                            <Select
                                placeholder="Moneda"
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
                        <Form.Item name="notes" label="Notas / Comentarios">
                            <Input placeholder="Ej: Pago a contra entrega, urgente, etc." />
                        </Form.Item>
                    </Col>
                </Row>
            </Form>

            <Divider>Seleccionar Productos</Divider>

            <div style={{ marginBottom: 16 }}>
                <Select
                    showSearch
                    placeholder="Buscar producto por SKU o nombre..."
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
                            {p.name} ({p.sku}) - Actual Stock: {p.stock}
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
                                <Typography.Text strong>TOTAL ESTIMADO</Typography.Text>
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
