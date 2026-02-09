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

export const POSLeftPanel = () => {
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
        calculatePriceInPrimary,
        calculatePriceInCurrency,
        calculateCostInPrimary,
        getNormalizedQuantity,
        searchTerm,
        setSearchTerm,
        setSearchResults,
        searchResults
    } = usePOSStore();

    // Removed local state: const [searchResults, setSearchResults] = useState<Product[]>([]);

    // Modal States
    const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
    const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);

    // Debounced API call for search
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

    const handleSelectProduct = (_productId: string, option: any) => {
        if (option.product) {
            const product = option.product;

            // Check if product has no stock (Skip for Services)
            if (product.type !== 'SERVICE' && product.stock === 0) {
                Modal.warning({
                    title: 'Producto sin stock',
                    icon: <WarningOutlined style={{ color: '#ff4d4f' }} />,
                    content: `${product.name} no tiene inventario disponible.`,
                });
                return;
            }

            // Check if adding would exceed available stock
            const existingItemsForThisProduct = cart.filter(item => item.product.id === product.id);
            const currentNormalizedQuantity = existingItemsForThisProduct.reduce((acc, item) =>
                acc + getNormalizedQuantity(item.quantity, item.product, item.isSecondaryUnit), 0
            );

            // Quantity being added (1 unit of primary unit)
            const addedNormalizedQuantity = getNormalizedQuantity(1, product, false);

            if (product.type !== 'SERVICE' && (currentNormalizedQuantity + addedNormalizedQuantity) > product.stock) {
                // Fallback: Try adding secondary unit if available
                if (product.secondaryUnitId) {
                    const addedSecondaryNormalizedQuantity = getNormalizedQuantity(1, product, true);
                    if ((currentNormalizedQuantity + addedSecondaryNormalizedQuantity) <= product.stock) {
                        addItem(product, true);
                        return;
                    }
                }

                Modal.warning({
                    title: 'Stock insuficiente',
                    icon: <WarningOutlined style={{ color: '#faad14' }} />,
                    content: `Incapaz de añadir 1 unidad completa. Ya tienes el equivalente a ${currentNormalizedQuantity.toFixed(3)} uds en el carrito. Stock disponible: ${product.stock}`,
                });
                return;
            }

            addItem(product, false); // Default to primary unit
        }
    };


    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedItemId) {
                // Even if no item selected, F3 (Client) should work? 
                // The previous logic had `if (!selectedItemId) return;` at top, blocking F3 if cart empty.
                // Better to allow F3 always.
            }


            if (!selectedItemId) return; // Block item actions if no item selected

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
                        title: '¿Eliminar item?',
                        content: 'Se eliminará el producto del carrito',
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
            title: 'Cant.',
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
            title: 'Descripción',
            dataIndex: 'product',
            key: 'product',
            render: (product: any, record: CartItem) => (
                <div>
                    <span style={{ fontWeight: 'bold' }}>{product.name}</span>
                    {record.isSecondaryUnit && <div style={{ fontSize: 10, color: '#888' }}>({product.secondaryUnit?.name || 'Sec.'})</div>}
                    {record.discount > 0 && (
                        <div style={{ fontSize: 11, color: 'green' }}>
                            Desc: {record.discountPercent}% (-{formatVenezuelanPriceOnly(record.discount, 2, false)})
                        </div>
                    )}
                </div>
            )
        },
        !isMobile ? {
            title: 'Stock',
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
                                title="Cantidad excede stock disponible"
                            />
                        )}
                    </div>
                );
            }
        } : null,
        {
            title: 'Total',
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
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Buscador */}
            <Select
                showSearch
                searchValue={searchTerm}
                value={null}
                placeholder="Escanee código o busque producto"
                defaultActiveFirstOption={false}
                suffixIcon={null}
                filterOption={false}
                onSearch={handleSearch}
                onChange={handleSelectProduct}
                notFoundContent={null}
                style={{ width: '100%' }}
                size="large"
                options={(searchResults || []).map((d: Product) => {
                    // Calculate Prices for Display
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

                    // Stock indicator
                    const isService = d.type === 'SERVICE';
                    const stockIndicator = isService ? '🔵' : d.stock === 0 ? '🔴' : d.stock <= 10 ? '🟡' : '🟢';
                    const stockText = isService ? 'Servicio' : `Stock: ${d.stock}`;

                    return {
                        value: d.id,
                        label: `${d.sku} - ${d.name} (${priceString}) [${stockText} ${isService ? '∞' : stockIndicator}]`,
                        product: d
                    };
                })}
            />

            {/* Grid del Carrito */}
            <div style={{ flex: 1, border: '1px solid #d9d9d9', background: 'white', borderRadius: 4, overflow: 'hidden' }}>
                <Table
                    dataSource={cart}
                    columns={columns}
                    pagination={false}
                    size="small"
                    scroll={{ y: isMobile ? 'calc(100vh - 430px)' : 'calc(100vh - 300px)' }}
                    rowKey={(record) => record.product.id}
                    locale={{ emptyText: 'No hay items' }}
                    rowClassName={(record) => record.product.id === selectedItemId ? 'pos-row-selected' : 'pos-row'}
                    onRow={(record) => ({
                        onClick: () => selectItem(record.product.id),
                    })}
                />
            </div>

            {/* Botones de Acción Rápida (Visual Keys) */}
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 5, marginTop: isMobile ? 0 : 5 }}>
                <Button
                    size={isMobile ? "middle" : "small"}
                    icon={<NumberOutlined />}
                    disabled={!selectedItemId}
                    onClick={() => setIsQuantityModalOpen(true)}
                >
                    {isMobile ? "Cant." : "F4 Cant."}
                </Button>
                <Button
                    size={isMobile ? "middle" : "small"}
                    icon={<DollarOutlined />}
                    disabled={!selectedItemId}
                    onClick={() => setIsPriceModalOpen(true)}
                >
                    {isMobile ? "Precio" : "F5 Precio"}
                </Button>
                <Button
                    size={isMobile ? "middle" : "small"}
                    icon={<DeleteOutlined />}
                    danger
                    disabled={!selectedItemId}
                    onClick={() => {
                        Modal.confirm({
                            title: '¿Eliminar item?',
                            content: 'Se eliminará el producto del carrito',
                            onOk: () => removeItem(selectedItemId!),
                        });
                    }}
                >
                    {isMobile ? "Borrar" : "F6 Borrar"}
                </Button>
                <Button
                    size={isMobile ? "middle" : "small"}
                    icon={<PercentageOutlined />}
                    disabled={!selectedItemId}
                    onClick={() => setIsDiscountModalOpen(true)}
                >
                    {isMobile ? "Dcto" : "F7 Dcto"}
                </Button>
                <Button
                    size={isMobile ? "middle" : "small"}
                    icon={<SyncOutlined />}
                    disabled={!selectedItemId}
                    onClick={toggleSelectedItemUnit}
                >
                    {isMobile ? "Alt" : "F8 Alt"}
                </Button>
            </div>

            {/* Mini Totales Inferiores */}
            <Card size="small" style={{ background: '#333', color: 'white', border: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: 'white' }}>Sub Total</span>
                    <strong
                        style={{ fontSize: 16, color: 'white' }}
                        title={formatVenezuelanPriceOnly(totals.subtotal || 0, 2, false)}
                    >
                        {formatVenezuelanPriceOnly(totals.subtotal || 0, 2, false)}
                    </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ color: 'white' }}>Descuento</span>
                    <strong style={{ fontSize: 16, color: 'orange' }}>
                        {(totals.discount || 0).toFixed(2)}
                    </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #555', marginTop: 5, paddingTop: 5 }}>
                    <span style={{ color: 'white' }}>Total</span>
                    <strong
                        style={{ fontSize: 20, color: 'yellow' }}
                        title={formatVenezuelanPriceOnly(totals.total || 0, 2, false)}
                    >
                        {formatVenezuelanPriceOnly(totals.total || 0, 2, false)}
                    </strong>
                </div>
                {preferredSecondaryCurrency && (
                    <div style={{ textAlign: 'right', marginTop: -2 }}>
                        <span
                            style={{ fontSize: 12, color: '#aaa' }}
                            title={formatVenezuelanPrice(totals.totalUsd || 0, preferredSecondaryCurrency.symbol, 2, false)}
                        >
                            {formatVenezuelanPrice(totals.totalUsd || 0, preferredSecondaryCurrency.symbol, 2, false)}
                        </span>
                    </div>
                )}
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 5, textAlign: 'right' }}>
                    Items: {totals.itemsCount}
                </div>
            </Card>

            {/* Modals */}
            {selectedCartItem && (
                <>
                    <QuantityModal
                        open={isQuantityModalOpen}
                        currentQuantity={selectedCartItem.quantity}
                        productName={selectedCartItem.product.name}
                        onOk={(qty) => {
                            // Stock Validation
                            const normalizedQty = getNormalizedQuantity(qty, selectedCartItem.product, selectedCartItem.isSecondaryUnit);
                            // Important: Calculate total normalized quantity of OTHER items of same product
                            const otherItems = cart.filter(item => item.product.id === selectedCartItem.product.id && item !== selectedCartItem);
                            const otherNormalizedQty = otherItems.reduce((acc, item) =>
                                acc + getNormalizedQuantity(item.quantity, item.product, item.isSecondaryUnit), 0
                            );

                            if (selectedCartItem.product.type !== 'SERVICE' && (normalizedQty + otherNormalizedQty) > selectedCartItem.product.stock) {
                                Modal.warning({
                                    title: 'Stock insuficiente',
                                    content: `La cantidad solicitada excede el stock disponible (${selectedCartItem.product.stock}).`
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
                            // Validation 1: Max 30%
                            if (percent > 30) {
                                Modal.error({
                                    title: 'Descuento Excesivo',
                                    content: 'El descuento máximo permitido es del 30%.'
                                });
                                return;
                            }

                            // Validation 2: Price below Cost
                            const currentPrice = selectedCartItem.price;
                            const discountAmount = currentPrice * (percent / 100);
                            const finalPrice = currentPrice - discountAmount;

                            const costInPrimary = calculateCostInPrimary(selectedCartItem.product, selectedCartItem.isSecondaryUnit);

                            if (finalPrice < costInPrimary) {
                                Modal.error({
                                    title: 'Precio por debajo del costo',
                                    content: `El descuento del ${percent}% resulta en un precio (${finalPrice.toFixed(2)}) menor al costo del producto (${costInPrimary.toFixed(2)}). Operación no permitida.`
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
