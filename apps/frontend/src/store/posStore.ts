import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../services/productsApi';
import { companySettingsApi } from '../services/companySettingsApi';
import { currenciesApi, type Currency } from '../services/currenciesApi';
import { salesApi, type CreateSaleDto } from '../services/salesApi';
import { getRoundedPrice } from '../utils/rounding';


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
    taxEnabled: boolean;
    taxRate: number;
    currencies: Currency[]; // All available currencies
    primaryCurrency: Currency | null;
    companyInfo: { name: string; rif: string } | null;
    roundingEnabled: boolean;
    roundingFactor: number;
    igtfEnabled: boolean;
    igtfRate: number;
    isSpecialTaxpayer: boolean;
    searchTerm: string;
    searchResults: Product[];
    appliedCoupon: { id: string; code: string; discountAmount: number } | null;
    customerPoints: number;
    customerPointsValueUsd: number;
    pointsRate: number;
    maxRedemptionPercentage: number;

    // Actions
    fetchCustomerPoints: (clientId: string) => Promise<void>;
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
    applyCoupon: (coupon: { id: string; code: string; discountAmount: number }) => void;
    removeCoupon: () => void;
    setExchangeRate: (rate: number) => void;
    setCustomer: (customer: { id: string; name: string } | string) => void;
    calculateTotals: () => void;
    initialize: () => Promise<void>;
    processSale: (paymentData: any, cashSessionId?: string) => Promise<any>;
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
            taxEnabled: false,
            taxRate: 16,
            currencies: [],
            primaryCurrency: null,
            companyInfo: null,
            roundingEnabled: true,
            roundingFactor: 10,
            igtfEnabled: false,
            igtfRate: 3,
            isSpecialTaxpayer: false,
            searchTerm: '',
            searchResults: [],
            appliedCoupon: null,
            customerPoints: 0,
            customerPointsValueUsd: 0,
            pointsRate: 0,
            maxRedemptionPercentage: 100,
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

                const taxEnabled = get().taxEnabled;
                const taxRate = get().taxRate;

                // Calculate price normalized to Primary Currency (Bs)
                let rawPriceInPrimary = calculatePriceInPrimary(product, isSecondary);

                // Add IVA if enabled and product is not exempt
                if (taxEnabled && !product.isTaxExempt) {
                    rawPriceInPrimary = rawPriceInPrimary * (1 + taxRate / 100);
                }

                // Round using global settings
                const { roundingEnabled, roundingFactor } = get();
                const priceInPrimary = getRoundedPrice(rawPriceInPrimary, roundingFactor, roundingEnabled);

                // Tax contained in each unit (rounded price)
                const unitTax = (taxEnabled && !product.isTaxExempt)
                    ? priceInPrimary - (priceInPrimary / (1 + (taxRate / 100)))
                    : 0;

                if (existingItem) {
                    get().updateQuantity(product.id, existingItem.quantity + 1);
                } else {
                    const newItem: CartItem = {
                        product,
                        quantity: 1,
                        price: priceInPrimary,
                        tax: unitTax,
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

                set({ cart: newCart, selectedItemId: newSelected, appliedCoupon: null }); // Remove coupon if cart changes to avoid inconsistencies
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
                        // For IVA included, discount applies to the full price (which already has IVA)
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

                set({ cart: newCart, appliedCoupon: null }); // Remove coupon on quantity change
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

                set({ cart: newCart, appliedCoupon: null }); // Remove global coupon if line discount changes
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
                // Round using global settings
                const { roundingEnabled, roundingFactor } = get();
                const newPriceInPrimary = getRoundedPrice(rawNewPriceInPrimary, roundingFactor, roundingEnabled);

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
                    appliedCoupon: null,
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
                    appliedCoupon: null,
                    totals: { subtotal: 0, discount: 0, tax: 0, total: 0, totalUsd: 0, itemsCount: 0 }
                });
            },

            setExchangeRate: (rate) => {
                set({ exchangeRate: rate });
                get().calculateTotals();
            },

            setCustomer: (customer) => {
                if (typeof customer === 'string') {
                    set({ 
                        activeCustomer: customer, 
                        customerId: null, 
                        appliedCoupon: null,
                        customerPoints: 0,
                        customerPointsValueUsd: 0,
                        pointsRate: 0,
                        maxRedemptionPercentage: 100
                    });
                } else {
                    set({ 
                        activeCustomer: customer.name, 
                        customerId: customer.id, 
                        appliedCoupon: null 
                    });
                    
                    // Trigger points fetch (non-blocking)
                    get().fetchCustomerPoints(customer.id);
                }
                get().calculateTotals(); // in case a tier coupon was removed
            },

            fetchCustomerPoints: async (clientId) => {
                try {
                    const { marketingApi } = await import('../services/marketingApi');
                    const pointsData = await marketingApi.getPointsValue(clientId);
                    set({ 
                        customerPoints: pointsData.points, 
                        customerPointsValueUsd: pointsData.valueUsd,
                        pointsRate: pointsData.rate,
                        maxRedemptionPercentage: pointsData.maxRedemptionPercentage || 100
                    });
                } catch (error) {
                    console.error("Failed to fetch customer points", error);
                    set({ customerPoints: 0, customerPointsValueUsd: 0, pointsRate: 0 });
                }
            },

            applyCoupon: (coupon) => {
                set({ appliedCoupon: coupon });
                get().calculateTotals();
            },
            
            removeCoupon: () => {
                set({ appliedCoupon: null });
                get().calculateTotals();
            },

            calculateTotals: () => {
                const { cart, exchangeRate, taxEnabled, taxRate, appliedCoupon } = get();

                const totalWithTax = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
                let totalDiscount = cart.reduce((acc, item) => acc + (item.discount || 0), 0);

                if (appliedCoupon) {
                    totalDiscount += appliedCoupon.discountAmount;
                }

                let total = totalWithTax - totalDiscount;
                if (total < 0) total = 0;

                // Calculate the tax portion from the total
                // Since total includes IVA, tax = Total - (Total / 1.16)
                // But only for items that are taxable and taking into account their individual discounts
                const tax = cart.reduce((acc, item) => {
                    if (taxEnabled && !item.product.isTaxExempt) {
                        const itemTotalAfterDiscount = (item.price * item.quantity) - (item.discount || 0);
                        const itemTax = itemTotalAfterDiscount - (itemTotalAfterDiscount / (1 + (taxRate / 100)));
                        return acc + itemTax;
                    }
                    return acc;
                }, 0);

                const subtotal = total - tax; // This is the Base Imponible in our context (Total without Tax)
                const itemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

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
                        exchangeRate: secondaryRate,
                        taxEnabled: settings.taxEnabled || false,
                        taxRate: Number(settings.taxRate) || 16,
                        roundingEnabled: settings.roundingEnabled !== undefined ? settings.roundingEnabled : true,
                        roundingFactor: settings.roundingFactor || 10,
                        igtfEnabled: settings.igtfEnabled !== undefined ? settings.igtfEnabled : false,
                        igtfRate: Number(settings.igtfRate) || 3,
                        isSpecialTaxpayer: settings.isSpecialTaxpayer !== undefined ? settings.isSpecialTaxpayer : false,
                        companyInfo: { name: settings.name, rif: settings.rif }
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
                    const nextInvoice = await salesApi.getNextInvoiceNumber();
                    set({ nextInvoiceNumber: nextInvoice });
                } catch (error) {
                    console.error('❌ Failed to fetch next invoice number:', error);
                    // Fallback in case the specific endpoint fails
                    set({ nextInvoiceNumber: 'FAC-00000001' });
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

            processSale: async (paymentData: any, cashSessionId?: string) => {
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
                    // If method already has a colon (extended method), don't append another :amount
                    paymentMethod = paymentData.payments
                        .map((p: any) => p.method.includes(':') ? p.method : `${p.method}:${p.amount.toFixed(2)}`)
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
                    paymentMethod: paymentData.payments && paymentData.payments.length > 0
                        ? paymentData.payments
                            .map((p: any) => {
                                // Crucial: Send original currency amount if available to prevent double conversion in backend
                                const method = p.method;
                                const amount = p.originalAmount || p.amount;
                                let paymentString = `${method}:${amount.toFixed(2)}`;
                                if (p.bankId) {
                                    paymentString += `:${p.bankId}`;
                                }
                                return paymentString;
                            })
                            .join(', ')
                        : paymentMethod,
                    tendered: Math.round(tendered * 100) / 100,
                    change: Math.round(change * 100) / 100,
                    exchangeRate: get().exchangeRate || 1,
                    cashSessionId: cashSessionId,
                    couponId: get().appliedCoupon?.id || undefined,
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
