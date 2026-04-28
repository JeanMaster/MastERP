import { useState, useEffect, useMemo } from 'react';
import { Table, Button, Card, Select, Modal, Tag, Grid } from 'antd';
import { usePOSStore } from '../../../store/posStore';
import { formatVenezuelanPrice, formatVenezuelanPriceOnly } from '../../../utils/formatters';
import type { CartItem } from '../../../store/posStore';
import { productsApi } from '../../../services/productsApi';
import type { Product } from '../../../services/productsApi';
import debounce from 'lodash/debounce';
import { QuantityModal } from './QuantityModal';
import { DiscountModal } from './DiscountModal';
import { PriceModal } from './PriceModal';
import { DeleteOutlined, PercentageOutlined, NumberOutlined, DollarOutlined, ExclamationCircleOutlined, WarningOutlined, SyncOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

/**
 * POSLeftPanel Component
 * Manages the shopping cart list, search bar, and item-specific actions (Quantity, Price, Discount).
 * Includes complex stock validation and multi-currency price calculations.
 */
export const POSLeftPanel = () => {
    const { t } = useTranslation();
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.lg;
    const {
        cart,
        addItem,
        selectedItemId,
        selectItem,
        updateQuantity,
        updateItemPrice,
        removeItem,
        applyDiscount,
        toggleSelectedItemUnit,
        totals,
        preferredSecondaryCurrency,
        taxEnabled,
        taxRate,
        calculatePriceInPrimary,
        calculatePriceInCurrency,
        calculateCostInPrimary,
        getNormalizedQuantity,
        searchTerm,
        setSearchTerm,
        setSearchResults,
        searchResults
    } = usePOSStore();

    // Modal States
    const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

    // Debounced search to find products by name, SKU or barcode
    const debouncedSearch = useMemo(
        () =>
            debounce((value: string) => {
                if (value.length > 2) {
                    productsApi.getAll({ search: value }).then(setSearchResults);
                } else {
                    setSearchResults([]);
                }
            }, 500),
        [setSearchResults]
    );

    const handleSearch = (value: string) => {
        setSearchTerm(value);
        debouncedSearch(value);
    };

    /**
     * Handles adding a product to the cart with stock validation.
     */
    const handleSelectProduct = (_productId: string, option: any) => {
        if (option.product) {
            const product = option.product;

            if (product.type !== 'SERVICE' && product.stock === 0) {
                Modal.warning({
                    title: t('pos.cart.out_of_stock'),
                    icon: <WarningOutlined style={{ color: '#ff4d4f' }} />,
                    content: t('pos.cart.out_of_stock_desc', { name: product.name }),
                });
                return;
            }

            const existingItemsForThisProduct = cart.filter(item => item.product.id === product.id);
            const currentNormalizedQuantity = existingItemsForThisProduct.reduce((acc, item) =>
                acc + getNormalizedQuantity(item.quantity, item.product, item.isSecondaryUnit), 0
            );

            const addedNormalizedQuantity = getNormalizedQuantity(1, product, false);

            if (product.type !== 'SERVICE' && (currentNormalizedQuantity + addedNormalizedQuantity) > product.stock) {
                // Try secondary unit fallback
                if (product.secondaryUnitId) {
                    const addedSecondaryNormalizedQuantity = getNormalizedQuantity(1, product, true);
                    if ((currentNormalizedQuantity + addedSecondaryNormalizedQuantity) <= product.stock) {
                        addItem(product, true);
                        return;
                    }
                }

                Modal.warning({
                    title: t('pos.cart.insufficient_stock'),
                    icon: <WarningOutlined style={{ color: '#faad14' }} />,
                    content: t('pos.cart.insufficient_stock_desc', { qty: currentNormalizedQuantity.toFixed(3), stock: product.stock }),
                });
                return;
            }

            addItem(product, false);
        }
    };


    // Keyboard Shortcuts (F4: Qty, F5: Price, F6: Remove, F7: Discount, F8: Toggle Unit)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedItemId) return;

            switch (e.key) {
                case 'F4':
                    e.preventDefault();
                    setIsQuantityModalOpen(true);
                    break;
                case 'F5':
                    e.preventDefault();
                    setIsPriceModalOpen(true);
                    break;
                case 'F6':
                    e.preventDefault();
                    Modal.confirm({
                        title: t('pos.cart.remove_confirm_title'),
                        content: t('pos.cart.remove_confirm_desc'),
                        onOk: () => removeItem(selectedItemId),
                    });
                    break;
                case 'F7':
                    e.preventDefault();
                    setIsDiscountModalOpen(true);
                    break;
                case 'F8':
                    e.preventDefault();
                    toggleSelectedItemUnit();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItemId, removeItem, toggleSelectedItemUnit]);

    const selectedCartItem = cart.find(item => item.product.id === selectedItemId);

    const columns = [
        {
            title: t('pos.cart.qty'),
            dataIndex: 'quantity',
            key: 'quantity',
            width: 70,
            align: 'center' as const,
            render: (text: number) => (
                <span style={{ fontSize: 14, fontWeight: 'bold' }}>
                    {text % 1 === 0 ? text : text.toFixed(3).replace(/\.?0+$/, "")}
                </span>
            )
        },
        {
            title: t('pos.cart.description'),
            dataIndex: 'product',
            key: 'product',
            render: (product: any, record: CartItem) => (
                <div>
                    <span style={{ fontWeight: 'bold' }}>{product.name}</span>
                    {record.isSecondaryUnit && <div style={{ fontSize: 10, color: '#888' }}>({product.secondaryUnit?.name || 'Sec.'})</div>}
                    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                        {product.isTaxExempt && <Tag color="default" style={{ fontSize: 9, margin: 0 }}>{t('pos.cart.exempt')}</Tag>}
                        {record.discount > 0 && (
                            <span style={{ fontSize: 11, color: 'green' }}>
                                {t('pos.cart.discount')}: {record.discountPercent}% (-{formatVenezuelanPriceOnly(record.discount, 2, false)})
                            </span>
                        )}
                    </div>
                </div>
            )
        },
        !isMobile ? {
            title: t('pos.cart.stock'),
            key: 'stock',
            width: 70,
            align: 'center' as const,
            render: (_: any, record: CartItem) => {
                const isService = record.product.type === 'SERVICE';
                const stock = record.product.stock;
                const normalizedQuantity = getNormalizedQuantity(record.quantity, record.product, record.isSecondaryUnit);
                const hasStockIssue = !isService && normalizedQuantity > stock;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Tag color={
                            isService ? 'blue' :
                                stock === 0 ? 'red' :
                                    stock <= 10 ? 'orange' :
                                        'green'
                        } style={{ margin: 0, fontSize: 11 }}>
                            {isService ? '∞' : stock}
                        </Tag>
                        {hasStockIssue && (
                            <ExclamationCircleOutlined
                                style={{ color: 'red', fontSize: 14 }}
                                title="Quantity exceeds available stock"
                            />
                        )}
                    </div>
                );
            }
        } : null,
        {
            title: t('pos.cart.total'),
            dataIndex: 'total',
            key: 'total',
            width: 90,
            align: 'right' as const,
            render: (value: number) => {
                const secondaryValue = preferredSecondaryCurrency
                    ? calculatePriceInCurrency(value, preferredSecondaryCurrency.id)
                    : 0;
                return (
                    <div style={{ overflow: 'hidden' }}>
                        <div
                            style={{
                                fontSize: 14,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                            title={formatVenezuelanPriceOnly(value, 2, false)}
                        >
                            {formatVenezuelanPriceOnly(value, 2, false)}
                        </div>
                        {preferredSecondaryCurrency && secondaryValue > 0 && (
                            <div
                                style={{
                                    fontSize: 10,
                                    color: '#888',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}
                                title={formatVenezuelanPrice(secondaryValue, preferredSecondaryCurrency.symbol, 2, false)}
                            >
                                {formatVenezuelanPrice(secondaryValue, preferredSecondaryCurrency.symbol, 2, false)}
                            </div>
                        )}
                    </div>
                );
            }
        }
    ].filter(Boolean) as any;

    return (
        <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Search Select */}
            <Select
                showSearch
                searchValue={searchTerm}
                value={null}
                placeholder={t('pos.cart.search_placeholder')}
                defaultActiveFirstOption={false}
                suffixIcon={null}
                filterOption={false}
                onSearch={handleSearch}
                onChange={handleSelectProduct}
                notFoundContent={null}
                style={{ width: '100%' }}
                size="large"
                options={(searchResults || []).map((d: Product) => {
                    const priceInPrimary = calculatePriceInPrimary(d, false);
                    const priceInSecondary = preferredSecondaryCurrency
                        ? calculatePriceInCurrency(priceInPrimary, preferredSecondaryCurrency.id)
                        : 0;
                    const originalSymbol = d.currency?.symbol || '$';
                    const originalPrice = d.salePrice;
                    const secondarySymbol = preferredSecondaryCurrency?.symbol || '$';

                    let priceString = `${originalSymbol}${formatVenezuelanPriceOnly(Number(originalPrice), 2, false)}`;
                    if (preferredSecondaryCurrency && priceInSecondary > 0 && d.currency?.name !== preferredSecondaryCurrency.code) {
                        priceString += ` | ${formatVenezuelanPrice(priceInSecondary, secondarySymbol, 2, false)}`;
                    }

                    const isService = d.type === 'SERVICE';
                    const stockIndicator = isService ? '🔵' : d.stock === 0 ? '🔴' : d.stock <= 10 ? '🟡' : '🟢';
                    const stockText = isService ? 'Service' : `Stock: ${d.stock}`;

                    return {
                        value: d.id,
                        label: `${d.sku} - ${d.name} (${priceString}) [${stockText} ${isService ? '∞' : stockIndicator}]`,
                        product: d
                    };
                })}
            />

            {/* Cart Table */}
            <div style={{ flex: 1, minHeight: 0, border: '1px solid #d9d9d9', background: 'white', borderRadius: 4, overflowY: 'auto' }}>
                <Table
                    dataSource={cart}
                    columns={columns}
                    pagination={false}
                    size="small"
                    scroll={{ y: isMobile ? 'calc(100vh - 430px)' : 'calc(100vh - 300px)' }}
                    rowKey={(record) => record.product.id}
                    locale={{ emptyText: t('pos.cart.empty') }}
                    rowClassName={(record) => record.product.id === selectedItemId ? 'pos-row-selected' : 'pos-row'}
                    onRow={(record) => ({
                        onClick: () => selectItem(record.product.id),
                    })}
                />
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 5, marginTop: isMobile ? 0 : 5 }}>
                <Button
                    size={isMobile ? "middle" : "small"}
                    icon={<NumberOutlined />}
                    disabled={!selectedItemId}
                    onClick={() => setIsQuantityModalOpen(true)}
                >
                    {isMobile ? t('pos.cart.qty') : `F4 ${t('pos.cart.qty')}`}
                </Button>
                <Button
                    size={isMobile ? "middle" : "small"}
                    icon={<DollarOutlined />}
                    disabled={!selectedItemId}
                    onClick={() => setIsPriceModalOpen(true)}
                >
                    {isMobile ? t('common.price') : `F5 ${t('common.price')}`}
                </Button>
                <Button
                    size={isMobile ? "middle" : "small"}
                    icon={<DeleteOutlined />}
                    danger
                    disabled={!selectedItemId}
                    onClick={() => {
                        Modal.confirm({
                            title: t('pos.cart.remove_confirm_title'),
                            content: t('pos.cart.remove_confirm_desc'),
                            onOk: () => removeItem(selectedItemId!),
                        });
                    }}
                >
                    {isMobile ? t('common.delete') : `F6 ${t('common.delete')}`}
                </Button>
                <Button
                    size={isMobile ? "middle" : "small"}
                    icon={<PercentageOutlined />}
                    disabled={!selectedItemId}
                    onClick={() => setIsDiscountModalOpen(true)}
                >
                    {isMobile ? t('common.discount') : `F7 ${t('common.discount')}`}
                </Button>
                <Button
                    size={isMobile ? "middle" : "small"}
                    icon={<SyncOutlined />}
                    disabled={!selectedItemId}
                    onClick={toggleSelectedItemUnit}
                >
                    {isMobile ? "Alt" : `F8 ${t('pos.footer.unit', { defaultValue: 'Alt Unit' })}`}
                </Button>
            </div>

            {/* Cart Totals Summary */}
            <Card size="small" style={{ background: '#333', color: 'white', border: 0 }}>
                {taxEnabled && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ color: '#aaa', fontSize: 13 }}>{t('pos.cart.taxable_base')}</span>
                            <span
                                style={{ fontSize: 14, color: '#fff' }}
                                title={formatVenezuelanPriceOnly(totals.subtotal || 0, 2, false)}
                            >
                                {formatVenezuelanPriceOnly(totals.subtotal || 0, 2, false)}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span style={{ color: '#aaa', fontSize: 13 }}>{t('pos.cart.vat')} ({taxRate}%)</span>
                            <span
                                style={{ fontSize: 14, color: '#fff' }}
                                title={formatVenezuelanPriceOnly(totals.tax || 0, 2, false)}
                            >
                                {formatVenezuelanPriceOnly(totals.tax || 0, 2, false)}
                            </span>
                        </div>
                    </>
                )}

                {!taxEnabled && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ color: 'white' }}>{t('pos.cart.subtotal')}</span>
                        <strong
                            style={{ fontSize: 16, color: 'white' }}
                            title={formatVenezuelanPriceOnly(totals.subtotal || 0, 2, false)}
                        >
                            {formatVenezuelanPriceOnly(totals.subtotal || 0, 2, false)}
                        </strong>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: 'white' }}>{t('pos.cart.discount')}</span>
                    <strong style={{ fontSize: 16, color: 'orange' }}>
                        {(totals.discount || 0).toFixed(2)}
                    </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #555', marginTop: 5, paddingTop: 5 }}>
                    <span style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>{t('pos.cart.grand_total')}</span>
                    <div style={{ textAlign: 'right' }}>
                        <strong
                            style={{ fontSize: 24, color: 'yellow' }}
                            title={formatVenezuelanPriceOnly(totals.total || 0, 2, false)}
                        >
                            {formatVenezuelanPriceOnly(totals.total || 0, 2, false)}
                        </strong>
                        {preferredSecondaryCurrency && (
                            <div style={{ marginTop: -5 }}>
                                <span
                                    style={{ fontSize: 14, color: '#aaa' }}
                                    title={formatVenezuelanPrice(totals.totalUsd || 0, preferredSecondaryCurrency.symbol, 2, false)}
                                >
                                    {formatVenezuelanPrice(totals.totalUsd || 0, preferredSecondaryCurrency.symbol, 2, false)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ fontSize: 11, color: '#aaa', marginTop: 5, textAlign: 'right' }}>
                    {t('pos.cart.items_count')}: {totals.itemsCount}
                </div>
            </Card>

            {/* Management Modals */}
            {selectedCartItem && (
                <>
                    <QuantityModal
                        open={isQuantityModalOpen}
                        currentQuantity={selectedCartItem.quantity}
                        productName={selectedCartItem.product.name}
                        onOk={(qty) => {
                            const normalizedQty = getNormalizedQuantity(qty, selectedCartItem.product, selectedCartItem.isSecondaryUnit);
                            const otherItems = cart.filter(item => item.product.id === selectedCartItem.product.id && item !== selectedCartItem);
                            const otherNormalizedQty = otherItems.reduce((acc, item) =>
                                acc + getNormalizedQuantity(item.quantity, item.product, item.isSecondaryUnit), 0
                            );

                            if (selectedCartItem.product.type !== 'SERVICE' && (normalizedQty + otherNormalizedQty) > selectedCartItem.product.stock) {
                                Modal.warning({
                                    title: t('pos.cart.insufficient_stock'),
                                    content: t('pos.cart.insufficient_stock_simple', { defaultValue: 'The requested quantity exceeds available stock ({{stock}}).', stock: selectedCartItem.product.stock })
                                });
                                return;
                            }

                            updateQuantity(selectedCartItem.product.id, qty);
                            setIsQuantityModalOpen(false);
                        }}
                        onCancel={() => setIsQuantityModalOpen(false)}
                    />

                    <DiscountModal
                        open={isDiscountModalOpen}
                        product={selectedCartItem.product}
                        currentPrice={selectedCartItem.price}
                        isSecondaryUnit={selectedCartItem.isSecondaryUnit}
                        onOk={(percent) => {
                            if (percent > 30) {
                                Modal.error({
                                    title: t('pos.cart.excessive_discount'),
                                    content: t('pos.cart.excessive_discount_desc')
                                });
                                return;
                            }

                            const currentPrice = selectedCartItem.price;
                            const discountAmount = currentPrice * (percent / 100);
                            const finalPrice = currentPrice - discountAmount;
                            const costInPrimary = calculateCostInPrimary(selectedCartItem.product, selectedCartItem.isSecondaryUnit);

                            if (finalPrice < costInPrimary) {
                                Modal.error({
                                    title: t('pos.cart.price_below_cost'),
                                    content: t('pos.cart.price_below_cost_desc', { price: finalPrice.toFixed(2), cost: costInPrimary.toFixed(2) })
                                });
                                return;
                            }

                            applyDiscount(selectedCartItem.product.id, percent);
                            setIsDiscountModalOpen(false);
                        }}
                        onCancel={() => setIsDiscountModalOpen(false)}
                    />

                    <PriceModal
                        open={isPriceModalOpen}
                        cartItem={selectedCartItem}
                        onOk={(newPrice) => {
                            updateItemPrice(selectedCartItem.product.id, newPrice);
                            setIsPriceModalOpen(false);
                        }}
                        onCancel={() => setIsPriceModalOpen(false)}
                    />
                </>
            )}

        </div>
    );
};
