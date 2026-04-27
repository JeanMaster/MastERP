import { useState } from 'react';
import {
    Modal,
    Steps,
    Input,
    Button,
    Table,
    InputNumber,
    Select,
    Radio,
    Space,
    Typography,
    Form,
    message,
    Spin,
    Alert,
    Checkbox
} from 'antd';
import { SearchOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { usePOSStore } from '../../../store/posStore';
import { salesApi, type Sale } from '../../../services/salesApi';
import { returnsApi, type CreateReturnDto, type CreateReturnItemDto } from '../../../services/returnsApi';
import { productsApi } from '../../../services/productsApi';
import { formatVenezuelanPrice } from '../../../utils/formatters';
import { getRoundedPrice } from '../../../utils/rounding';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CreateReturnModalProps {
    open: boolean;
    onCancel: () => void;
    onSuccess: () => void;
}

interface SelectedItem extends CreateReturnItemDto {
    productName: string;
    productSku: string;
}

/**
 * CreateReturnModal Component
 * Multi-step wizard for initiating a product return or exchange.
 * Flow: 
 * 1. Find Original Invoice -> 2. Select Items & Quantities -> 
 * 3. Define Return Type (Refund/Exchange) -> 4. Select Replacement (Optional) -> 5. Review & Submit.
 */
export const CreateReturnModal = ({ open, onCancel, onSuccess }: CreateReturnModalProps) => {
    const { roundingEnabled, roundingFactor } = usePOSStore();
    const [currentStep, setCurrentStep] = useState(0);
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [sale, setSale] = useState<Sale | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [returnType, setReturnType] = useState<'REFUND' | 'EXCHANGE_SAME' | 'EXCHANGE_DIFFERENT'>('REFUND');
    const [reason, setReason] = useState<string>('DEFECTIVE');
    const [condition, setCondition] = useState<string>('GOOD');
    const [refundMethod, setRefundMethod] = useState<string>('CASH');
    const [notes, setNotes] = useState('');
    const [replacementItems, setReplacementItems] = useState<SelectedItem[]>([]);
    const [replacementSearch, setReplacementSearch] = useState('');
    const [replacementSearchResults, setReplacementSearchResults] = useState<any[]>([]);
    const [isSearchingProducts, setIsSearchingProducts] = useState(false);

    const resetModal = () => {
        setCurrentStep(0);
        setInvoiceNumber('');
        setSale(null);
        setSelectedItems([]);
        setReturnType('REFUND');
        setReason('DEFECTIVE');
        setCondition('GOOD');
        setRefundMethod('CASH');
        setNotes('');
        setReplacementItems([]);
        setReplacementSearch('');
        setReplacementSearchResults([]);
    };

    const handleCancel = () => {
        resetModal();
        onCancel();
    };

    /**
     * Searches for the original sale record by invoice number.
     */
    const handleSearchInvoice = async () => {
        if (!invoiceNumber.trim()) {
            message.error('Please enter an invoice number');
            return;
        }

        setLoading(true);
        try {
            const sales = await salesApi.getAll();
            const foundSale = sales.find(s => s.invoiceNumber === invoiceNumber.trim());

            if (!foundSale) {
                message.error('Invoice not found');
                setSale(null);
                return;
            }

            const saleDate = new Date(foundSale.date);
            const today = new Date();
            const daysDiff = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff > 30) {
                message.warning('This invoice is over 30 days old. Check return policy eligibility.');
            }

            setSale(foundSale);
            setCurrentStep(1);
        } catch (error) {
            message.error('Error searching for invoice');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleItemSelection = (checked: boolean, item: any) => {
        if (checked) {
            if (!item.product) {
                message.error('Product data not available');
                return;
            }

            const newItem: SelectedItem = {
                productId: item.productId,
                productName: item.product.name,
                productSku: item.product.sku,
                quantity: Number(item.quantity),
                unitPrice: Number(item.unitPrice),
                total: Number(item.total)
            };
            setSelectedItems([...selectedItems, newItem]);
        } else {
            setSelectedItems(selectedItems.filter(i => i.productId !== item.productId));
        }
    };

    const updateItemQuantity = (productId: string, quantity: number) => {
        setSelectedItems(selectedItems.map(item =>
            item.productId === productId
                ? { ...item, quantity, total: quantity * item.unitPrice }
                : item
        ));
    };

    const handleSearchProducts = async (value: string) => {
        if (!value.trim()) {
            setReplacementSearchResults([]);
            return;
        }

        setIsSearchingProducts(true);
        try {
            const results = await productsApi.getAll({ search: value, active: true, type: 'PRODUCT' });
            setReplacementSearchResults(results);
        } catch (error) {
            console.error('Error searching products:', error);
            message.error('Error searching products');
        } finally {
            setIsSearchingProducts(false);
        }
    };

    const addReplacementItem = (product: any) => {
        if (replacementItems.some(i => i.productId === product.id)) {
            message.warning('Product already added');
            return;
        }

        let unitPrice = Number(product.salePrice);
        if (product.currency && !product.currency.isPrimary && product.currency.exchangeRate) {
            unitPrice = unitPrice * Number(product.currency.exchangeRate);
        }

        unitPrice = getRoundedPrice(unitPrice, roundingFactor, roundingEnabled);

        const newItem: SelectedItem = {
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            quantity: 1,
            unitPrice: unitPrice,
            total: unitPrice
        };
        setReplacementItems([...replacementItems, newItem]);
        setReplacementSearch('');
        setReplacementSearchResults([]);
    };

    const updateReplacementQuantity = (productId: string, quantity: number) => {
        setReplacementItems(replacementItems.map(item =>
            item.productId === productId
                ? { ...item, quantity, total: quantity * item.unitPrice }
                : item
        ));
    };

    const updateReplacementPrice = (productId: string, price: number) => {
        const roundedPrice = getRoundedPrice(price, roundingFactor, roundingEnabled);
        setReplacementItems(replacementItems.map(item =>
            item.productId === productId
                ? { ...item, unitPrice: roundedPrice, total: item.quantity * roundedPrice }
                : item
        ));
    };

    const removeReplacementItem = (productId: string) => {
        setReplacementItems(replacementItems.filter(i => i.productId !== productId));
    };

    const handleNext = () => {
        if (currentStep === 1 && selectedItems.length === 0) {
            message.error('Please select at least one item to return');
            return;
        }
        setCurrentStep(currentStep + 1);
    };

    /**
     * Submits the return request to the API.
     */
    const handleSubmit = async () => {
        if (!sale) return;

        const refundAmount = selectedItems.reduce((sum, item) => sum + item.total, 0);

        const dto: CreateReturnDto = {
            originalSaleId: sale.id,
            returnType,
            reason: reason as any,
            productCondition: condition as any,
            items: selectedItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.total
            })),
            replacementItems: returnType === 'EXCHANGE_DIFFERENT'
                ? replacementItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.total
                }))
                : undefined,
            refundAmount,
            refundMethod: returnType === 'REFUND' ? refundMethod as any : undefined,
            notes,
            requestedBy: 'User'
        };

        setLoading(true);
        try {
            await returnsApi.create(dto);
            message.success('Return request created successfully');
            resetModal();
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'Error creating return request');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const itemsColumns = [
        {
            title: 'Product',
            key: 'product',
            render: (_: any, record: any) => (
                <div>
                    <div><strong>{record.product?.name || 'Unknown Product'}</strong></div>
                    <div style={{ fontSize: 11, color: '#888' }}>{record.product?.sku || ''}</div>
                </div>
            )
        },
        {
            title: 'Orig. Qty',
            dataIndex: 'quantity',
            key: 'originalQty',
            width: 100,
            render: (qty: number) => Number(qty).toFixed(0)
        },
        {
            title: 'Unit Price',
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            width: 100,
            render: (price: number) => formatVenezuelanPrice(Number(price))
        },
        {
            title: 'Total',
            dataIndex: 'total',
            key: 'total',
            width: 100,
            render: (total: number) => formatVenezuelanPrice(Number(total))
        },
        {
            title: 'Select',
            key: 'select',
            width: 80,
            render: (_: any, record: any) => (
                <Checkbox
                    checked={selectedItems.some(i => i.productId === record.productId)}
                    onChange={(e) => handleItemSelection(e.target.checked, record)}
                />
            )
        }
    ];

    const selectedItemsColumns = [
        ...itemsColumns.filter(col => col.key !== 'select'),
        {
            title: 'Return Qty',
            key: 'returnQty',
            width: 120,
            render: (_: any, record: SelectedItem) => (
                <InputNumber
                    min={1}
                    max={record.quantity}
                    value={record.quantity}
                    onChange={(value) => updateItemQuantity(record.productId, value || 1)}
                    size="small"
                />
            )
        },
    ];

    const steps = [
        {
            title: 'Find Invoice',
            content: (
                <div style={{ padding: '20px 0' }}>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            placeholder="Invoice number (e.g., FAC-00000001)"
                            value={invoiceNumber}
                            onChange={(e) => setInvoiceNumber(e.target.value)}
                            onPressEnter={handleSearchInvoice}
                            size="large"
                        />
                        <Button
                            type="primary"
                            icon={<SearchOutlined />}
                            onClick={handleSearchInvoice}
                            loading={loading}
                            size="large"
                        >
                            Search
                        </Button>
                    </Space.Compact>

                    {sale && (
                        <Alert
                            message="Invoice Found"
                            description={
                                <div style={{ marginTop: 10 }}>
                                    <p><strong>Invoice:</strong> {sale.invoiceNumber}</p>
                                    <p><strong>Date:</strong> {dayjs(sale.date).format('MM/DD/YYYY HH:mm')}</p>
                                    <p><strong>Customer:</strong> {sale.client?.name || 'Walk-in Customer'}</p>
                                    <p><strong>Total:</strong> {formatVenezuelanPrice(Number(sale.total))}</p>
                                    <p><strong>Items:</strong> {sale.items.length}</p>
                                </div>
                            }
                            type="success"
                            showIcon
                            style={{ marginTop: 16 }}
                        />
                    )}
                </div>
            )
        },
        {
            title: 'Select Items',
            content: (
                <div>
                    <Title level={5}>Invoice Items</Title>
                    <Table
                        dataSource={sale?.items || []}
                        columns={itemsColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                    />

                    {selectedItems.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <Title level={5}>Items selected for return</Title>
                            <Table
                                dataSource={selectedItems}
                                columns={selectedItemsColumns}
                                rowKey="productId"
                                pagination={false}
                                size="small"
                            />
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Return Options',
            content: (
                <div>
                    <Form layout="vertical">
                        <Form.Item label="Return Type">
                            <Radio.Group value={returnType} onChange={(e) => setReturnType(e.target.value)}>
                                <Space direction="vertical">
                                    <Radio value="REFUND">Refund (Return money)</Radio>
                                    <Radio value="EXCHANGE_SAME">Exchange for same product</Radio>
                                    <Radio value="EXCHANGE_DIFFERENT">Swap for different product</Radio>
                                </Space>
                            </Radio.Group>
                        </Form.Item>

                        <Form.Item label="Reason for Return">
                            <Select value={reason} onChange={setReason}>
                                <Select.Option value="DEFECTIVE">Defective product</Select.Option>
                                <Select.Option value="UNSATISFIED">Customer unsatisfied</Select.Option>
                                <Select.Option value="ERROR">Sale error</Select.Option>
                                <Select.Option value="EXPIRED">Expired product</Select.Option>
                                <Select.Option value="OTHER">Other</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item label="Product Condition">
                            <Select value={condition} onChange={setCondition}>
                                <Select.Option value="EXCELLENT">Excellent (Resalable)</Select.Option>
                                <Select.Option value="GOOD">Good</Select.Option>
                                <Select.Option value="DEFECTIVE">Defective</Select.Option>
                                <Select.Option value="DAMAGED">Damaged/Broken</Select.Option>
                            </Select>
                        </Form.Item>

                        {returnType === 'REFUND' && (
                            <Form.Item label="Refund Method">
                                <Select value={refundMethod} onChange={setRefundMethod}>
                                    <Select.Option value="CASH">Cash</Select.Option>
                                    <Select.Option value="TRANSFER">Bank Transfer</Select.Option>
                                    <Select.Option value="CREDIT_NOTE">Store Credit Note</Select.Option>
                                </Select>
                            </Form.Item>
                        )}

                        <Form.Item label="Additional Notes">
                            <TextArea
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Details about the return request..."
                            />
                        </Form.Item>
                    </Form>
                </div>
            )
        },
        {
            title: 'Exchange Products',
            content: (
                <div>
                    <Title level={5}>Search for replacement products</Title>
                    <Select
                        showSearch
                        placeholder="Search by Name or SKU..."
                        value={replacementSearch}
                        onSearch={handleSearchProducts}
                        onChange={(value) => {
                            const product = replacementSearchResults.find(p => p.id === value);
                            if (product) addReplacementItem(product);
                        }}
                        filterOption={false}
                        style={{ width: '100%', marginBottom: 16 }}
                        loading={isSearchingProducts}
                        notFoundContent={isSearchingProducts ? <Spin size="small" /> : null}
                    >
                        {replacementSearchResults.map(product => (
                            <Select.Option key={product.id} value={product.id}>
                                {product.name} ({product.sku})
                            </Select.Option>
                        ))}
                    </Select>

                    {replacementItems.length > 0 && (
                        <div>
                            <Title level={5}>Selected Replacement Items</Title>
                            <Table
                                dataSource={replacementItems}
                                rowKey="productId"
                                pagination={false}
                                size="small"
                                columns={[
                                    { title: 'Product', key: 'product', render: (_, r) => <div><strong>{r.productName}</strong><br /><small>{r.productSku}</small></div> },
                                    {
                                        title: 'Price',
                                        key: 'price',
                                        width: 140,
                                        render: (_, r) => (
                                            <InputNumber
                                                value={r.unitPrice}
                                                onChange={(val) => updateReplacementPrice(r.productId, Number(val) || 0)}
                                                formatter={value => `Bs. ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                                                parser={value => Number(value!.replace(/Bs\.\s?|(\.*)/g, '').replace(',', '.'))}
                                                step={0.01}
                                                size="small"
                                                style={{ width: '100%' }}
                                            />
                                        )
                                    },
                                    {
                                        title: 'Qty.',
                                        key: 'qty',
                                        render: (_, r) => (
                                            <InputNumber
                                                min={1}
                                                value={r.quantity}
                                                onChange={(val) => updateReplacementQuantity(r.productId, val || 1)}
                                                size="small"
                                            />
                                        )
                                    },
                                    { title: 'Total', key: 'total', render: (_, r) => formatVenezuelanPrice(r.total) },
                                    {
                                        title: '',
                                        key: 'actions',
                                        render: (_, r) => (
                                            <Button
                                                type="text"
                                                danger
                                                icon={<CloseCircleOutlined />}
                                                onClick={() => removeReplacementItem(r.productId)}
                                            />
                                        )
                                    }
                                ]}
                            />

                            <div style={{ marginTop: 10, textAlign: 'right' }}>
                                <Text strong>Balance in favor of Customer: </Text>
                                <Text strong style={{ color: '#52c41a' }}>
                                    {formatVenezuelanPrice(
                                        Math.max(0, selectedItems.reduce((sum, i) => sum + i.total, 0) - replacementItems.reduce((sum, i) => sum + i.total, 0))
                                    )}
                                </Text>
                                <br />
                                <Text strong>Balance to be paid by Customer: </Text>
                                <Text strong style={{ color: '#f5222d' }}>
                                    {formatVenezuelanPrice(
                                        Math.max(0, replacementItems.reduce((sum, i) => sum + i.total, 0) - selectedItems.reduce((sum, i) => sum + i.total, 0))
                                    )}
                                </Text>
                            </div>
                        </div>
                    )}
                </div>
            )
        },
        {
            title: 'Review',
            content: (
                <div>
                    <Alert
                        message="Return Summary"
                        description={
                            <div style={{ marginTop: 10 }}>
                                <p><strong>Invoice:</strong> {sale?.invoiceNumber}</p>
                                <p><strong>Type:</strong> {
                                    returnType === 'REFUND' ? 'Refund' :
                                        returnType === 'EXCHANGE_SAME' ? 'Same Product Exchange' :
                                            'Product Swap'
                                }</p>
                                <p><strong>Items to return:</strong> {selectedItems.length}</p>
                                <p><strong>Refund Amount:</strong> {formatVenezuelanPrice(
                                    selectedItems.reduce((sum, item) => sum + item.total, 0)
                                )}</p>
                                {returnType === 'EXCHANGE_DIFFERENT' && (
                                    <>
                                        <p><strong>Replacement Items:</strong> {replacementItems.length}</p>
                                        <p><strong>Replacement Total:</strong> {formatVenezuelanPrice(
                                            replacementItems.reduce((sum, item) => sum + item.total, 0)
                                        )}</p>
                                    </>
                                )}
                                {returnType === 'REFUND' && (
                                    <p><strong>Refund Method:</strong> {
                                        refundMethod === 'CASH' ? 'Cash' :
                                            refundMethod === 'TRANSFER' ? 'Bank Transfer' :
                                                'Credit Note'
                                    }</p>
                                )}
                            </div>
                        }
                        type="info"
                        showIcon
                    />
                </div>
            )
        }
    ];

    const filteredSteps = steps.filter(step => {
        if (step.title === 'Exchange Products') {
            return returnType === 'EXCHANGE_DIFFERENT';
        }
        return true;
    });

    return (
        <Modal
            title="Create New Return"
            open={open}
            onCancel={handleCancel}
            width={900}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Space>
                        {currentStep > 0 && (
                            <Button onClick={() => setCurrentStep(currentStep - 1)}>
                                Back
                            </Button>
                        )}
                        {currentStep < filteredSteps.length - 1 && (
                            <Button type="primary" onClick={handleNext}>
                                Next
                            </Button>
                        )}
                        {currentStep === filteredSteps.length - 1 && (
                            <Button type="primary" onClick={handleSubmit} loading={loading}>
                                Create Return Request
                            </Button>
                        )}
                    </Space>
                </div>
            }
        >
            <Steps current={currentStep} items={filteredSteps.map(s => ({ title: s.title }))} style={{ marginBottom: 24 }} />

            {loading && currentStep === 0 ? (
                <div style={{ textAlign: 'center', padding: 50 }}>
                    <Spin size="large" />
                </div>
            ) : (
                filteredSteps[currentStep]?.content
            )}
        </Modal>
    );
};
