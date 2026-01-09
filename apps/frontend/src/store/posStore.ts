import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../services/productsApi';
import { companySettingsApi } from '../services/companySettingsApi';
import { currenciesApi, type Currency } from '../services/currenciesApi';
import { salesApi, type CreateSaleDto } from '../services/salesApi';


export interface CartItem {
    product: Product;
    quantity: number;
    price: number;
    tax: number;
    discount: number; // Monto de descuento aplicado
    discountPercent: number; // Porcentaje de descuento (0-100)
    total: number;
    isSecondaryUnit: boolean;
    originalCurrencyCode?: string; // Code of the currency the product was bought in
}

interface POSState {
    cart: CartItem[];
    activeCustomer: string;
    customerId: string | null;
    selectedItemId: string | null;
    nextInvoiceNumber: string; // Next invoice number to be assigned
    reservedInvoiceNumber: string | null; // Reserved invoice number for current sale
    totals: {
        subtotal: number;
        discount: number; // Total descuentos
        tax: number;
        total: number;
        totalUsd: number; // This will now represent Total in Secondary Currency
        itemsCount: number;
    };
    exchangeRate: number; // Rate of Preferred Secondary Currency
    preferredSecondaryCurrency: Currency | null;
    currencies: Currency[]; // All available currencies
    primaryCurrency: Currency | null;
    searchTerm: string;
    searchResults: Product[];

    // Actions
    setSearchTerm: (term: string) => void;
    setSearchResults: (results: Product[]) => void;
    addItem: (product: Product, isSecondary: boolean) => void;
    removeItem: (productId: string) => void;
    updateQuantity: (productId: string, quantity: number) => void;
    updateItemPrice: (productId: string, newPrice: number) => void;
    selectItem: (itemId: string | null) => void;
    applyDiscount: (productId: string, percent: number) => void;
    toggleUnit: (productId: string) => void;
    toggleSelectedItemUnit: () => void;
    clearCart: () => void;
    resetPOS: () => void;
    setExchangeRate: (rate: number) => void;
    setCustomer: (customer: { id: string; name: string } | string) => void;
    calculateTotals: () => void;
    initialize: () => Promise<void>;
    processSale: (paymentData: any, reservedInvoiceNumber?: string | null) => Promise<any>;
    fetchNextInvoiceNumber: () => Promise<void>;
    refreshInvoiceNumber: () => Promise<void>;
    reserveInvoiceNumber: () => Promise<string>;

    // Helpers
    calculatePriceInPrimary: (product: Product, isSecondaryUnit: boolean) => number;
    calculateCostInPrimary: (product: Product, isSecondaryUnit: boolean) => number;
    calculatePriceInCurrency: (priceInPrimary: number, targetCurrencyId: string) => number;
    getNormalizedQuantity: (quantity: number, product: Product, isSecondary: boolean) => number;
}

export const usePOSStore = create<POSState>()(
    persist(
        (set, get) => ({
            cart: [],
            activeCustomer: 'CONTADO',
            customerId: null,
            selectedItemId: null,
            nextInvoiceNumber: 'FAC-00000001', // Default next invoice number
            reservedInvoiceNumber: null, // No invoice number reserved initially
            totals: {
                subtotal: 0,
                discount: 0,
                tax: 0,
                total: 0,
                totalUsd: 0,
                itemsCount: 0,
            },
            exchangeRate: 0,
            preferredSecondaryCurrency: null,
            currencies: [],
            primaryCurrency: null,
            searchTerm: '',
            searchResults: [],
            setSearchTerm: (term) => set({ searchTerm: term }),
            setSearchResults: (results) => set({ searchResults: results }),

            calculatePriceInPrimary: (product: Product, isSecondaryUnit: boolean) => {
                const { currencies, primaryCurrency } = get();

                // Get the raw price from product
                let rawPrice = isSecondaryUnit
                    ? (product.secondarySalePrice || 0)
                    : Number(product.salePrice);

                // If no currencies loaded yet, return raw price (fallback)
                if (!currencies.length || !primaryCurrency) return rawPrice;

                // If product currency is same as primary, return price as is
                if (product.currencyId === primaryCurrency.id) {
                    return rawPrice;
                }

                // If product currency is different, convert to Primary
                // Find product currency rate
                const productCurrency = currencies.find(c => c.id === product.currencyId);

                if (productCurrency) {
                    // Assumption: Rates are "Bs per Unit" (e.g. 50 Bs/$)
                    const rate = Number(productCurrency.exchangeRate || 0);
                    if (rate > 0) {
                        return rawPrice * rate;
                    }
                }
                return rawPrice;
            },

            calculateCostInPrimary: (product: Product, isSecondaryUnit: boolean) => {
                const { currencies, primaryCurrency } = get();

                let rawCost = isSecondaryUnit
                    ? (product.secondaryCostPrice || 0)
                    : Number(product.costPrice);

                if (!currencies.length || !primaryCurrency) return rawCost;

                if (product.currencyId === primaryCurrency.id) {
                    return rawCost;
                }

                const productCurrency = currencies.find(c => c.id === product.currencyId);
                if (productCurrency) {
                    const rate = Number(productCurrency.exchangeRate || 0);
                    if (rate > 0) {
                        return rawCost * rate;
                    }
                }
                return rawCost;
            },

            calculatePriceInCurrency: (priceInPrimary: number, targetCurrencyId: string) => {
                const { currencies, primaryCurrency } = get();

                if (!currencies.length || !primaryCurrency) return priceInPrimary;

                // If target is primary currency, return as is
                if (targetCurrencyId === primaryCurrency.id) {
                    return priceInPrimary;
                }

                // Find target currency
                const targetCurrency = currencies.find(c => c.id === targetCurrencyId);
                if (targetCurrency && targetCurrency.exchangeRate) {
                    const rate = Number(targetCurrency.exchangeRate);
                    if (rate > 0) {
                        // Convert from primary to target currency
                        // If rate is 130 Bs/USD, then 156 Bs / 130 = 1.2 USD
                        return priceInPrimary / rate;
                    }
                }

                return priceInPrimary;
            },

            getNormalizedQuantity: (quantity: number, product: Product, isSecondary: boolean) => {
                if (!isSecondary || !product.unitsPerSecondaryUnit) return quantity;

                const factor = Number(product.unitsPerSecondaryUnit);
                if (product.conversionDirection === 'secondary_to_primary') {
                    // Example: 1 Rollo (Primary) = 100 Meters (Secondary)
                    // Meters -> Rollo: Divide by factor
                    return quantity / factor;
                } else {
                    // Example: 1 Caja (Secondary) = 12 Units (Primary)
                    // Caja -> Unit: Multiply by factor
                    return quantity * factor;
                }
            },

            addItem: (product, isSecondary) => {
                const { cart, calculatePriceInPrimary } = get();
                const existingItem = cart.find(
                    (item) => item.product.id === product.id && item.isSecondaryUnit === isSecondary
                );

                // Calculate price normalized to Primary Currency (Bs)
                const rawPriceInPrimary = calculatePriceInPrimary(product, isSecondary);
                // Round up to nearest 10
                const priceInPrimary = Math.ceil(rawPriceInPrimary / 10) * 10;

                if (existingItem) {
                    get().updateQuantity(product.id, existingItem.quantity + 1);
                } else {
                    const newItem: CartItem = {
                        product,
                        quantity: 1,
                        price: priceInPrimary,
                        tax: 0,
                        discount: 0,
                        discountPercent: 0,
                        total: priceInPrimary * 1,
                        isSecondaryUnit: isSecondary,
                        originalCurrencyCode: product.currency?.name // keeping for reference
                    };

                    const newCart = [...cart, newItem];
                    set({ cart: newCart, selectedItemId: product.id });
                    get().calculateTotals();
                }
            },

            removeItem: (productId) => {
                const { cart, selectedItemId } = get();
                const newCart = cart.filter((item) => item.product.id !== productId);

                let newSelected = selectedItemId;
                if (selectedItemId === productId) {
                    newSelected = null;
                }

                set({ cart: newCart, selectedItemId: newSelected });
                get().calculateTotals();
            },

            updateQuantity: (productId, quantity) => {
                const { cart } = get();
                if (quantity <= 0) {
                    get().removeItem(productId);
                    return;
                }

                const newCart = cart.map((item) => {
                    if (item.product.id === productId) {
                        const subtotalLine = item.price * quantity;
                        const discountAmount = subtotalLine * (item.discountPercent / 100);

                        return {
                            ...item,
                            quantity,
                            discount: discountAmount,
                            total: subtotalLine - discountAmount,
                        };
                    }
                    return item;
                });

                set({ cart: newCart });
                get().calculateTotals();
            },

            selectItem: (itemId) => {
                set({ selectedItemId: itemId });
            },

            applyDiscount: (productId, percent) => {
                const { cart } = get();

                const newCart = cart.map((item) => {
                    if (item.product.id === productId) {
                        const subtotalLine = item.price * item.quantity;
                        const discountAmount = subtotalLine * (percent / 100);

                        return {
                            ...item,
                            discountPercent: percent,
                            discount: discountAmount,
                            total: subtotalLine - discountAmount
                        };
                    }
                    return item;
                });

                set({ cart: newCart });
                get().calculateTotals();
            },
            toggleUnit: (productId) => {
                const { cart, calculatePriceInPrimary } = get();

                const item = cart.find((item) => item.product.id === productId);
                if (!item) return;

                // Check if product has secondary unit
                if (!item.product.secondaryUnitId) {
                    return; // No secondary unit available, do nothing
                }

                const newIsSecondaryUnit = !item.isSecondaryUnit;
                const rawNewPriceInPrimary = calculatePriceInPrimary(item.product, newIsSecondaryUnit);
                // Round up to nearest 10
                const newPriceInPrimary = Math.ceil(rawNewPriceInPrimary / 10) * 10;

                const newCart = cart.map((cartItem) => {
                    if (cartItem.product.id === productId) {
                        const subtotalLine = newPriceInPrimary * cartItem.quantity;
                        const discountAmount = subtotalLine * (cartItem.discountPercent / 100);

                        return {
                            ...cartItem,
                            price: newPriceInPrimary,
                            isSecondaryUnit: newIsSecondaryUnit,
                            discount: discountAmount,
                            total: subtotalLine - discountAmount
                        };
                    }
                    return cartItem;
                });

                set({ cart: newCart });
                get().calculateTotals();
            },

            toggleSelectedItemUnit: () => {
                const { selectedItemId } = get();
                if (selectedItemId) {
                    get().toggleUnit(selectedItemId);
                }
            },

            clearCart: () => {
                set({
                    cart: [],
                    selectedItemId: null,
                    totals: { subtotal: 0, discount: 0, tax: 0, total: 0, totalUsd: 0, itemsCount: 0 }
                });
            },

            updateItemPrice: (productId, newPrice) => {
                const { cart } = get();
                const newCart = cart.map((item) => {
                    if (item.product.id === productId) {
                        return {
                            ...item,
                            price: newPrice,
                            total: newPrice * item.quantity - (item.discount || 0) // Re-calculate total. Warning: Validation for discount?
                            // Discount logic might need revisit if it was percent based.
                            // If discountPercent > 0, we should maintain percent?
                            // Yes, let's recalculate discount if percent exists.
                        };
                    }
                    return item;
                });

                // Recalculate discounts properly
                const finalCart = newCart.map(item => {
                    if (item.product.id === productId) {
                        const subtotal = item.price * item.quantity;
                        const discountAmount = subtotal * (item.discountPercent / 100);
                        return {
                            ...item,
                            discount: discountAmount,
                            total: subtotal - discountAmount
                        };
                    }
                    return item;
                });

                set({ cart: finalCart });
                get().calculateTotals();
            },

            resetPOS: () => {
                set({
                    cart: [],
                    selectedItemId: null,
                    activeCustomer: 'CONTADO',
                    totals: { subtotal: 0, discount: 0, tax: 0, total: 0, totalUsd: 0, itemsCount: 0 }
                });
            },

            setExchangeRate: (rate) => {
                set({ exchangeRate: rate });
                get().calculateTotals();
            },

            setCustomer: (customer) => {
                if (typeof customer === 'string') {
                    set({ activeCustomer: customer, customerId: null });
                } else {
                    set({ activeCustomer: customer.name, customerId: customer.id });
                }
            },

            calculateTotals: () => {
                const { cart, exchangeRate } = get();

                const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                const totalDiscount = cart.reduce((acc, item) => acc + item.discount, 0);
                const tax = 0; // Implement tax later

                const total = subtotal - totalDiscount + tax;
                const itemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

                // Calculate Total in Secondary Currency (e.g. USD)
                // If total is in Bs (600) and rate is 260 Bs/$, result is 2.30 $
                const totalUsd = exchangeRate > 0 ? total / exchangeRate : 0;

                set({
                    totals: {
                        subtotal,
                        discount: totalDiscount,
                        tax,
                        total,
                        totalUsd,
                        itemsCount
                    }
                });
            },

            initialize: async () => {
                try {
                    // 1. Fetch Company Settings
                    const settings = await companySettingsApi.getSettings();

                    // 2. Fetch All Currencies
                    const allCurrencies = await currenciesApi.getAll();
                    const primary = allCurrencies.find(c => c.isPrimary) || null;

                    let secondaryRate = 0;
                    let secondaryDetails = null;

                    // 3. Setup Secondary Currency Rate
                    if (settings.preferredSecondaryCurrencyId) {
                        const secondary = allCurrencies.find(c => c.id === settings.preferredSecondaryCurrencyId);
                        if (secondary) {
                            secondaryRate = Number(secondary.exchangeRate || 0);
                            secondaryDetails = secondary;
                        }
                    }

                    set({
                        currencies: allCurrencies,
                        primaryCurrency: primary,
                        preferredSecondaryCurrency: secondaryDetails,
                        exchangeRate: secondaryRate
                    });

                    // Fetch next invoice number from sales data
                    await get().fetchNextInvoiceNumber();

                    get().calculateTotals();
                } catch (error) {
                    console.error("Failed to initialize POS store", error);
                }
            },

            fetchNextInvoiceNumber: async () => {
                try {
                    console.log('🔍 Fetching next invoice number...');
                    // Get all sales to find the last invoice number
                    const sales = await salesApi.getAll();
                    console.log('📊 Total sales found:', sales.length);

                    if (sales.length === 0) {
                        // No sales yet, start with FAC-00000001
                        console.log('✅ No sales found, setting to FAC-00000001');
                        set({ nextInvoiceNumber: 'FAC-00000001' });
                        return;
                    }

                    // Sort by invoice number to get the latest (assuming format FAC-XXXXXXXX)
                    const sortedSales = [...sales].sort((a, b) => {
                        return b.invoiceNumber.localeCompare(a.invoiceNumber);
                    });

                    const lastInvoice = sortedSales[0].invoiceNumber;
                    console.log('📄 Last invoice found:', lastInvoice);

                    // Extract number from invoice (e.g., "FAC-00000004" -> 4)
                    const match = lastInvoice.match(/([A-Z]+)-(\d+)$/);
                    if (match) {
                        const prefix = match[1];
                        const lastNumber = parseInt(match[2], 10);
                        const nextNumber = lastNumber + 1;
                        const nextInvoice = `${prefix}-${nextNumber.toString().padStart(8, '0')}`;
                        console.log('✅ Next invoice calculated:', nextInvoice);
                        set({ nextInvoiceNumber: nextInvoice });
                    } else {
                        // Fallback if format is unexpected
                        console.warn('⚠️ Could not parse invoice format, using fallback');
                        set({ nextInvoiceNumber: 'FAC-00000001' });
                    }
                } catch (error) {
                    console.error('❌ Failed to fetch next invoice number:', error);
                    // Keep current value on error
                }
            },

            refreshInvoiceNumber: async () => {
                await get().fetchNextInvoiceNumber();
            },

            reserveInvoiceNumber: async () => {
                try {
                    const invoiceNumber = await salesApi.reserveInvoiceNumber();
                    set({ reservedInvoiceNumber: invoiceNumber });
                    return invoiceNumber;
                } catch (error) {
                    console.error('Failed to reserve invoice number:', error);
                    throw error;
                }
            },

            processSale: async (paymentData: any) => {
                const { cart, totals, customerId } = get();

                // Handle multiple payments - combine them into a single payment method string
                let paymentMethod = 'MIXED';
                let tendered = paymentData.totalPaid || 0;
                let change = paymentData.change || 0;

                // If only one payment, use that method
                if (paymentData.payments && paymentData.payments.length === 1) {
                    paymentMethod = paymentData.payments[0].method;
                    tendered = paymentData.payments[0].amount;
                } else if (paymentData.payments && paymentData.payments.length > 1) {
                    // Multiple payments - create a description
                    paymentMethod = paymentData.payments
                        .map((p: any) => `${p.method}:${p.amount.toFixed(2)}`)
                        .join(', ');
                }

                const saleDto: CreateSaleDto = {
                    clientId: customerId || undefined,
                    items: cart.map(item => {
                        const quantitySent = get().getNormalizedQuantity(item.quantity, item.product, item.isSecondaryUnit);
                        let unitPriceSent = item.price;

                        if (item.isSecondaryUnit && item.product.unitsPerSecondaryUnit) {
                            const factor = Number(item.product.unitsPerSecondaryUnit);
                            if (item.product.conversionDirection === 'secondary_to_primary') {
                                // Rollo = 100 Metros -> PriceRollo = PriceMeter * 100
                                unitPriceSent = item.price * factor;
                            } else {
                                // Caja = 12 Units -> PriceUnit = PriceCaja / 12
                                unitPriceSent = item.price / factor;
                            }
                        }

                        return {
                            productId: item.product.id,
                            quantity: Math.round(quantitySent * 1000) / 1000,
                            unitPrice: Math.round(unitPriceSent * 100) / 100,
                            total: Math.round(item.total * 100) / 100
                        };
                    }),
                    subtotal: Math.round(totals.subtotal * 100) / 100,
                    discount: Math.round(totals.discount * 100) / 100,
                    tax: Math.round(totals.tax * 100) / 100,
                    total: Math.round(totals.total * 100) / 100,
                    paymentMethod: paymentMethod,
                    tendered: Math.round(tendered * 100) / 100,
                    change: Math.round(change * 100) / 100,
                    exchangeRate: get().exchangeRate || 1,
                    // Invoice number will be generated by backend
                };

                try {
                    const createdSale = await salesApi.create(saleDto);
                    // Clear cart on success
                    get().clearCart();
                    // Reset customer to CONTADO
                    set({ activeCustomer: 'CONTADO', customerId: null });
                    // Refresh invoice number for next sale
                    await get().refreshInvoiceNumber();
                    // Return the full sale object for invoice modal
                    return createdSale;
                } catch (error) {
                    console.error('Error processing sale:', error);
                    throw error; // Re-throw to handle in component
                }
            }
        }),
        {
            name: 'pos-storage',
            onRehydrateStorage: () => (state) => {
                state?.initialize();
            }
        }
    )
);
