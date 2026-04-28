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
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
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
            message.error(t('returns.messages.error_enter_invoice'));
            return;
        }

        setLoading(true);
        try {
            const sales = await salesApi.getAll();
            const foundSale = sales.find(s => s.invoiceNumber === invoiceNumber.trim());

            if (!foundSale) {
                message.error(t('returns.messages.error_invoice_not_found'));
                setSale(null);
                return;
            }

            const saleDate = new Date(foundSale.date);
            const today = new Date();
            const daysDiff = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));

            if (daysDiff > 30) {
                message.warning(t('returns.messages.warning_old_invoice'));
            }

            setSale(foundSale);
            setCurrentStep(1);
        } catch (error) {
            message.error(t('returns.messages.error_searching_invoice'));
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleItemSelection = (checked: boolean, item: any) => {
        if (checked) {
            if (!item.product) {
                message.error(t('common.product_data_unavailable'));
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
            message.error(t('common.error_searching_products'));
        } finally {
            setIsSearchingProducts(false);
        }
    };

    const addReplacementItem = (product: any) => {
        if (replacementItems.some(i => i.productId === product.id)) {
            message.warning(t('common.product_already_added'));
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
            message.error(t('returns.messages.error_select_item'));
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
            message.success(t('returns.messages.success_create'));
            resetModal();
            onSuccess();
        } catch (error: any) {
            message.error(error.response?.data?.message || t('returns.messages.error_create'));
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const itemsColumns = [
        {
            title: t('common.product'),
            key: 'product',
            render: (_: any, record: any) => (
                <div>
                    <div><strong>{record.product?.name || 'Unknown Product'}</strong></div>
                    <div style={{ fontSize: 11, color: '#888' }}>{record.product?.sku || ''}</div>
                </div>
            )
        },
        {
            title: t('returns.modal.orig_qty'),
            dataIndex: 'quantity',
            key: 'originalQty',
            width: 100,
            render: (qty: number) => Number(qty).toFixed(0)
        },
        {
            title: t('common.unit_price'),
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            width: 100,
            render: (price: number) => formatVenezuelanPrice(Number(price))
        },
        {
            title: t('common.total'),
            dataIndex: 'total',
            key: 'total',
            width: 100,
            render: (total: number) => formatVenezuelanPrice(Number(total))
        },
        {
            title: t('common.select'),
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
            title: t('returns.modal.return_qty'),
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
            title: t('returns.modal.step_find'),
            content: (
                <div style={{ padding: '20px 0' }}>
                    <Space.Compact style={{ width: '100%' }}>
                        <Input
                            placeholder={t('returns.modal.invoice_placeholder')}
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
                            {t('returns.modal.search')}
                        </Button>
                    </Space.Compact>

                    {sale && (
                        <Alert
                            message={t('returns.modal.invoice_found')}
                            description={
                                <div style={{ marginTop: 10 }}>
                                    <p><strong>{t('common.invoice')}:</strong> {sale.invoiceNumber}</p>
                                    <p><strong>{t('common.date')}:</strong> {dayjs(sale.date).format('MM/DD/YYYY HH:mm')}</p>
                                    <p><strong>{t('common.customer')}:</strong> {sale.client?.name || t('common.walk_in_customer')}</p>
                                    <p><strong>{t('common.total')}:</strong> {formatVenezuelanPrice(Number(sale.total))}</p>
                                    <p><strong>{t('common.items')}:</strong> {sale.items.length}</p>
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
            title: t('returns.modal.step_select'),
            content: (
                <div>
                    <Title level={5}>{t('returns.modal.invoice_items')}</Title>
                    <Table
                        dataSource={sale?.items || []}
                        columns={itemsColumns}
                        rowKey="id"
                        pagination={false}
                        size="small"
                    />

                    {selectedItems.length > 0 && (
                        <div style={{ marginTop: 20 }}>
                            <Title level={5}>{t('returns.modal.selected_items')}</Title>
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
            title: t('returns.modal.step_options'),
            content: (
                <div>
                    <Form layout="vertical">
                        <Form.Item label={t('returns.modal.type')}>
                            <Radio.Group value={returnType} onChange={(e) => setReturnType(e.target.value)}>
                                <Space direction="vertical">
                                    <Radio value="REFUND">{t('returns.type_refund')}</Radio>
                                    <Radio value="EXCHANGE_SAME">{t('returns.type_exchange_same')}</Radio>
                                    <Radio value="EXCHANGE_DIFFERENT">{t('returns.type_exchange_different')}</Radio>
                                </Space>
                            </Radio.Group>
                        </Form.Item>

                        <Form.Item label={t('returns.modal.reason')}>
                            <Select value={reason} onChange={setReason}>
                                <Select.Option value="DEFECTIVE">{t('returns.modal.reason_defective')}</Select.Option>
                                <Select.Option value="UNSATISFIED">{t('returns.modal.reason_unsatisfied')}</Select.Option>
                                <Select.Option value="ERROR">{t('returns.modal.reason_error')}</Select.Option>
                                <Select.Option value="EXPIRED">{t('returns.modal.reason_expired')}</Select.Option>
                                <Select.Option value="OTHER">{t('common.other')}</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item label={t('returns.modal.condition')}>
                            <Select value={condition} onChange={setCondition}>
                                <Select.Option value="EXCELLENT">{t('returns.modal.cond_excellent')}</Select.Option>
                                <Select.Option value="GOOD">{t('returns.modal.cond_good')}</Select.Option>
                                <Select.Option value="DEFECTIVE">{t('returns.modal.cond_defective')}</Select.Option>
                                <Select.Option value="DAMAGED">{t('returns.modal.cond_damaged')}</Select.Option>
                            </Select>
                        </Form.Item>

                        {returnType === 'REFUND' && (
                            <Form.Item label={t('returns.modal.refund_method')}>
                                <Select value={refundMethod} onChange={setRefundMethod}>
                                    <Select.Option value="CASH">{t('common.cash')}</Select.Option>
                                    <Select.Option value="TRANSFER">{t('common.transfer')}</Select.Option>
                                    <Select.Option value="CREDIT_NOTE">{t('common.credit_note')}</Select.Option>
                                </Select>
                            </Form.Item>
                        )}

                        <Form.Item label={t('common.notes')}>
                            <TextArea
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder={t('returns.modal.notes_placeholder')}
                            />
                        </Form.Item>
                    </Form>
                </div>
            )
        },
        {
            title: t('returns.modal.step_exchange'),
            content: (
                <div>
                    <Title level={5}>{t('returns.modal.search_replacement')}</Title>
                    <Select
                        showSearch
                        placeholder={t('common.search_placeholder')}
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
                            <Title level={5}>{t('returns.modal.selected_replacement')}</Title>
                            <Table
                                dataSource={replacementItems}
                                rowKey="productId"
                                pagination={false}
                                size="small"
                                columns={[
                                    { title: t('common.product'), key: 'product', render: (_, r) => <div><strong>{r.productName}</strong><br /><small>{r.productSku}</small></div> },
                                    {
                                        title: t('common.price'),
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
                                        title: t('common.qty_short'),
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
                                    { title: t('common.total'), key: 'total', render: (_, r) => formatVenezuelanPrice(r.total) },
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
                                <Text strong>{t('returns.modal.balance_favor')}</Text>
                                <Text strong style={{ color: '#52c41a' }}>
                                    {formatVenezuelanPrice(
                                        Math.max(0, selectedItems.reduce((sum, i) => sum + i.total, 0) - replacementItems.reduce((sum, i) => sum + i.total, 0))
                                    )}
                                </Text>
                                <br />
                                <Text strong>{t('returns.modal.balance_paid')}</Text>
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
            title: t('common.review'),
            content: (
                <div>
                    <Alert
                        message={t('returns.modal.summary')}
                        description={
                            <div style={{ marginTop: 10 }}>
                                <p><strong>{t('common.invoice')}:</strong> {sale?.invoiceNumber}</p>
                                <p><strong>{t('common.type')}:</strong> {
                                    returnType === 'REFUND' ? t('returns.type_refund_short') :
                                        returnType === 'EXCHANGE_SAME' ? t('returns.type_exchange_same_short') :
                                            t('returns.type_exchange_different_short')
                                }</p>
                                <p><strong>{t('returns.modal.items_to_return')}:</strong> {selectedItems.length}</p>
                                <p><strong>{t('returns.modal.refund_amount')}:</strong> {formatVenezuelanPrice(
                                    selectedItems.reduce((sum, item) => sum + item.total, 0)
                                )}</p>
                                {returnType === 'EXCHANGE_DIFFERENT' && (
                                    <>
                                        <p><strong>{t('returns.modal.replacement_items')}:</strong> {replacementItems.length}</p>
                                        <p><strong>{t('returns.modal.replacement_total')}:</strong> {formatVenezuelanPrice(
                                            replacementItems.reduce((sum, item) => sum + item.total, 0)
                                        )}</p>
                                    </>
                                )}
                                {returnType === 'REFUND' && (
                                    <p><strong>{t('returns.modal.refund_method')}:</strong> {
                                        refundMethod === 'CASH' ? t('common.cash') :
                                            refundMethod === 'TRANSFER' ? t('common.transfer') :
                                                t('common.credit_note')
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
            title={t('returns.modal.create_title')}
            open={open}
            onCancel={handleCancel}
            width={900}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Button onClick={handleCancel}>{t('common.cancel')}</Button>
                    <Space>
                        {currentStep > 0 && (
                            <Button onClick={() => setCurrentStep(currentStep - 1)}>
                                {t('common.back')}
                            </Button>
                        )}
                        {currentStep < filteredSteps.length - 1 && (
                            <Button type="primary" onClick={handleNext}>
                                {t('common.next')}
                            </Button>
                        )}
                        {currentStep === filteredSteps.length - 1 && (
                            <Button type="primary" onClick={handleSubmit} loading={loading}>
                                {t('returns.new_request_full')}
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
