import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import dayjs from 'dayjs';

@Injectable()
export class StatsService {
    constructor(private prisma: PrismaService) { }

    // Razones donde el producto vuelve al stock (producto vendible)
    private readonly SELLABLE_RETURN_REASONS = ['ERROR', 'UNSATISFIED', 'OTHER'];

    // Razones de ajuste de inventario que afectan COGS (pérdidas reales)
    private readonly LOSS_ADJUSTMENT_REASONS = ['DAMAGE', 'LOSS'];

    public async getCrossRateFactor(currencyCode: string = 'VES') {
        const companySettings = await this.prisma.companySettings.findFirst({
            include: { preferredSecondaryCurrency: true }
        });
        const refCurrency = companySettings?.preferredSecondaryCurrency;
        const currentRefRate = Number(refCurrency?.exchangeRate || 1);

        let factor = 1;
        if (currencyCode === 'VES') {
            factor = currentRefRate;
        } else {
            const targetCurrency = await this.prisma.currency.findUnique({ where: { code: currencyCode } });
            if (targetCurrency && refCurrency && targetCurrency.code !== refCurrency.code) {
                const tr = Number(targetCurrency.exchangeRate || 1);
                if (tr > 0) factor = currentRefRate / tr;
            }
        }
        return { factor, currentRefRate };
    }

    public async calculateNetSalesRevalued(dateFilter: any, currencyCode: string = 'VES', nominal: boolean = false) {
        const { factor: crossRateFactor, currentRefRate } = await this.getCrossRateFactor(currencyCode);

        // 1. Get Gross Sales revalued
        const sales = await this.prisma.sale.findMany({
            where: { active: true, createdAt: dateFilter },
            select: { total: true, exchangeRate: true }
        });

        let grossSalesTarget = 0;
        let grossSalesNominal = 0;
        sales.forEach(sale => {
            const historicalRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                ? Number(sale.exchangeRate)
                : currentRefRate;

            grossSalesNominal += Number(sale.total);
            grossSalesTarget += (Number(sale.total) / historicalRate) * crossRateFactor;
        });

        // 2. Get Returns Adjustments (Exchanges and Refunds)
        const returns = await this.prisma.return.findMany({
            where: { status: 'COMPLETED', createdAt: dateFilter },
            include: {
                items: true,
                replacementItems: true,
                originalSale: { select: { exchangeRate: true } }
            }
        });

        let totalAdjustmentsTarget = 0;
        let totalAdjustmentsNominal = 0;
        returns.forEach(ret => {
            const returnedValueVES = ret.items.reduce((sum, item) => sum + Number(item.total), 0);

            // 1. Revalue RETURN items using historical rate (Reversal of old sale)
            const historicalRate = (Number(ret.originalSale?.exchangeRate) && Number(ret.originalSale?.exchangeRate) !== 1)
                ? Number(ret.originalSale?.exchangeRate)
                : currentRefRate;

            totalAdjustmentsTarget -= (returnedValueVES / historicalRate) * crossRateFactor;
            totalAdjustmentsNominal -= returnedValueVES;

            // 2. Revalue REPLACEMENT items using current rate (New inventory out)
            if (ret.returnType.startsWith('EXCHANGE')) {
                const replacementValueVES = ret.replacementItems.reduce((sum, item) => sum + Number(item.total), 0);
                totalAdjustmentsTarget += (replacementValueVES / currentRefRate) * crossRateFactor;
                totalAdjustmentsNominal += replacementValueVES;
            }
        });

        return nominal ? (grossSalesNominal + totalAdjustmentsNominal) : (grossSalesTarget + totalAdjustmentsTarget);
    }

    async getDashboardStats(range: string = '7days') {
        const today = dayjs().startOf('day').toDate();
        const monthStart = dayjs().startOf('month').toDate();
        const lastMonthStart = dayjs().subtract(1, 'month').startOf('month').toDate();
        const lastMonthEnd = dayjs().subtract(1, 'month').endOf('month').toDate();

        // All sales in dashboard are now revalued to current rate for coherence
        const todaySales = await this.calculateNetSalesRevalued({ gte: today }, 'VES', true);
        const thisMonthSales = await this.calculateNetSalesRevalued({ gte: monthStart });
        const thisMonthSalesNominal = await this.calculateNetSalesRevalued({ gte: monthStart }, 'VES', true);
        const lastMonthSales = await this.calculateNetSalesRevalued({ gte: lastMonthStart, lte: lastMonthEnd });
        const lastMonthSalesNominal = await this.calculateNetSalesRevalued({ gte: lastMonthStart, lte: lastMonthEnd }, 'VES', true);

        // Top 5 selling products
        const topProducts = await this.prisma.saleItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true },
            where: { sale: { active: true } },
            orderBy: { _sum: { quantity: 'desc' } },
            take: 5,
        });

        const topProductsData = await Promise.all(
            topProducts.map(async (item) => {
                const product = await this.prisma.product.findUnique({
                    where: { id: item.productId },
                });
                return {
                    name: product?.name,
                    quantity: Number(item._sum.quantity || 0),
                };
            }),
        );

        // Products with critical stock (below 10 units as example)
        const criticalStock = await this.prisma.product.count({
            where: { stock: { lt: 10 }, active: true },
        });

        // Total products
        const totalProducts = await this.prisma.product.count({ where: { active: true } });

        // Active cash session balance
        const activeSession = await this.prisma.cashSession.findFirst({
            where: { status: 'OPEN' },
        });

        // Dynamic Sales Trend based on Range
        const salesTrend: { date: string; sales: number }[] = [];

        if (range === '7days' || range === '30days') {
            const daysToFetch = range === '7days' ? 7 : 30;
            for (let i = daysToFetch - 1; i >= 0; i--) {
                const date = dayjs().subtract(i, 'day').startOf('day').toDate();
                const nextDate = dayjs().subtract(i, 'day').endOf('day').toDate();

                salesTrend.push({
                    date: dayjs(date).format('DD/MM'),
                    sales: await this.calculateNetSalesRevalued({ gte: date, lte: nextDate }),
                });
            }
        } else if (range === '1year') {
            for (let i = 11; i >= 0; i--) {
                const date = dayjs().subtract(i, 'month').startOf('month').toDate();
                const nextDate = dayjs().subtract(i, 'month').endOf('month').toDate();

                salesTrend.push({
                    date: dayjs(date).format('MMM YY'),
                    sales: await this.calculateNetSalesRevalued({ gte: date, lte: nextDate }),
                });
            }
        } else if (range === 'all') {
            const firstSale = await this.prisma.sale.findFirst({
                where: { active: true },
                orderBy: { createdAt: 'asc' },
            });

            const startDate = firstSale ? dayjs(firstSale.createdAt).startOf('month') : dayjs().subtract(5, 'month').startOf('month');
            const now = dayjs().endOf('month');

            let current = startDate;
            while (current.isBefore(now)) {
                const start = current.startOf('month').toDate();
                const end = current.endOf('month').toDate();

                salesTrend.push({
                    date: current.format('MMM YY'),
                    sales: await this.calculateNetSalesRevalued({ gte: start, lte: end }),
                });

                current = current.add(1, 'month');
            }
        }

        // Calculate Returns/Refunds for current month
        const monthReturns = await this.prisma.return.findMany({
            where: {
                status: 'COMPLETED',
                createdAt: { gte: monthStart }
            },
            select: {
                returnType: true,
                refundAmount: true,
                items: {
                    select: { total: true }
                },
                replacementItems: {
                    select: { total: true }
                }
            }
        });

        let totalReturnsValue = 0;
        let totalExchangeValue = 0;
        let totalRefundsPaid = 0;
        let netReplacementValue = 0;

        monthReturns.forEach(ret => {
            const returnValue = ret.items.reduce((sum, i) => sum + Number(i.total || 0), 0);

            // NOMINAL MODEL: Use exact values without revaluation
            if (ret.returnType.startsWith('REFUND')) {
                totalReturnsValue += returnValue;
                if (ret.refundAmount) totalRefundsPaid += Number(ret.refundAmount);
            } else if (ret.returnType.startsWith('EXCHANGE')) {
                totalExchangeValue += returnValue;
                const replacementValue = ret.replacementItems.reduce((sum, i) => sum + Number(i.total || 0), 0);
                netReplacementValue += replacementValue;
                // For exchanges, also add any additional refund paid
                if (ret.refundAmount && Number(ret.refundAmount) > 0) {
                    totalRefundsPaid += Number(ret.refundAmount);
                }
            }
        });

        return {
            todaySales,
            thisMonthSales,
            thisMonthSalesNominal,
            lastMonthSales,
            lastMonthSalesNominal,
            topProducts: topProductsData,
            criticalStock,
            totalProducts,
            cashBalance: activeSession ? Number(activeSession.openingBalance) : 0,
            salesTrend,
            monthReturns: {
                totalReturnsValue,
                totalExchangeValue,
                totalRefundsPaid,
                netReplacementValue,
                netImpact: totalReturnsValue + totalExchangeValue - netReplacementValue
            }
        };
    }

    async getInventoryReport(currencyCode: string = 'VES') {
        // Stock by department - get all active products with cost and currency info
        const products = await this.prisma.product.findMany({
            where: { active: true },
            select: {
                stock: true,
                costPrice: true,
                categoryId: true,
                category: { select: { name: true } },
                currency: { select: { isPrimary: true, exchangeRate: true } }
            },
        });

        const targetCurrency = await this.prisma.currency.findUnique({ where: { code: currencyCode } });
        const targetRate = Number(targetCurrency?.exchangeRate || 1);
        // If target is primary, rate is 1 (or whatever it is stored as, usually 1)
        // Logic: Value(Primary) / Rate(Target) = Value(Target)
        // If Target is USD (Rate 50), Value 5000 / 50 = 100 USD.
        // If Target is Primary, Rate 1, Value 5000 / 1 = 5000.

        // Group by department/category and calculate value in Primary Currency
        const deptMap = new Map<string, { units: number; value: number }>();
        let totalValue = 0;

        products.forEach((p) => {
            const deptName = p.category?.name || 'Sin Categoría';
            const existing = deptMap.get(deptName) || { units: 0, value: 0 };

            // Calculate Cost in Primary Currency
            // If currency is not primary, multiply by rate (e.g. 10 USD * 40 Bs/USD = 400 Bs)
            const rate = p.currency?.isPrimary ? 1 : Number(p.currency?.exchangeRate || 1);
            const costInPrimary = Number(p.costPrice || 0) * rate;

            // Convert to Target Currency
            // Primary -> Target: Primary / TargetRate
            // (Assumes TargetRate is Primary per Target Unit, e.g. 50 Bs/$)
            const costInTarget = targetCurrency?.isPrimary ? costInPrimary : costInPrimary / targetRate;

            const productValue = Number(p.stock) * costInTarget;

            existing.units += Number(p.stock);
            existing.value += productValue;

            deptMap.set(deptName, existing);
            totalValue += productValue;
        });

        const stockByDept = Array.from(deptMap.entries()).map(
            ([department, data]) => ({
                department,
                units: data.units,
                value: data.value,
            }),
        );

        // Products below minimum stock (assuming 10 as threshold)
        const lowStock = await this.prisma.product.findMany({
            where: { stock: { lt: 10 }, active: true },
            select: {
                name: true,
                stock: true,
                category: { select: { name: true } },
            },
            take: 20,
        });

        // Depletion Forecast: Products that will run out in <= 20 days based on last 30 days velocity
        const thirtyDaysAgo = dayjs().subtract(30, 'days').toDate();
        const salesInLast30Days = await this.prisma.saleItem.groupBy({
            by: ['productId'],
            where: {
                createdAt: { gte: thirtyDaysAgo },
                sale: { isCancelled: false }
            },
            _sum: {
                quantity: true
            }
        });

        const velocityMap = new Map<string, number>();
        salesInLast30Days.forEach(item => {
            const totalSold = Number(item._sum.quantity || 0);
            velocityMap.set(item.productId, totalSold / 30);
        });

        // Get all active products with their current stock and sales info
        const allProducts = await this.prisma.product.findMany({
            where: { active: true },
            select: {
                id: true,
                name: true,
                stock: true,
                category: { select: { name: true } }
            }
        });

        const depletionForecast = allProducts
            .flatMap(p => {
                const velocity = velocityMap.get(p.id) || 0;
                const stock = Number(p.stock);

                if (velocity <= 0) return []; // No sales, no forecast

                const daysRemaining = Math.ceil(stock / velocity);
                if (daysRemaining > 20) return []; // Only critical ones

                return [{
                    name: p.name,
                    stock: stock,
                    dailySalesVelocity: velocity,
                    daysRemaining,
                    category: p.category?.name || 'Sin Categoría'
                }];
            })
            .sort((a, b) => Number(a.daysRemaining) - Number(b.daysRemaining));

        return {
            stockByDepartment: stockByDept,
            lowStockProducts: lowStock,
            depletionForecast: depletionForecast,
            totalInventoryValue: totalValue,
        };
    }

    async getFinanceReport(currencyCode: string = 'VES', startDate?: string, endDate?: string) {
        const dateFilter: any = {};

        if (startDate || endDate) {
            if (startDate) {
                dateFilter.gte = dayjs(startDate).startOf('day').toDate();
            }
            if (endDate) {
                dateFilter.lte = dayjs(endDate).endOf('day').toDate();
            }
        } else {
            // Default to current month if no range provided
            dateFilter.gte = dayjs().startOf('month').toDate();
        }

        // 1. Get Target Rate Info
        const targetCurrency = await this.prisma.currency.findUnique({ where: { code: currencyCode } });

        // 2. Get Reference Currency (The one stored in sale.exchangeRate, usually USD)
        const companySettings = await this.prisma.companySettings.findFirst({
            include: { preferredSecondaryCurrency: true }
        });
        const refCurrency = companySettings?.preferredSecondaryCurrency;
        const currentRefRate = Number(refCurrency?.exchangeRate || 1);

        // Calculate Cross-Rate Factor (Ref -> Target)
        let crossRateFactor = 1;
        if (currencyCode === 'VES') {
            crossRateFactor = currentRefRate;
        } else if (targetCurrency && refCurrency && targetCurrency.code !== refCurrency.code) {
            const tr = Number(targetCurrency.exchangeRate || 1);
            if (tr > 0) {
                crossRateFactor = currentRefRate / tr;
            }
        }

        // Sales for the selected range
        const salesInRange = await this.prisma.sale.findMany({
            where: {
                active: true,
                createdAt: dateFilter
            },
            select: {
                total: true,
                paymentMethod: true,
                createdAt: true,
                exchangeRate: true,
                items: {
                    select: {
                        cost: true,
                        quantity: true,
                        product: {
                            select: {
                                id: true,
                                costPrice: true,
                                currency: true
                            }
                        }
                    }
                }
            },
        });

        // Payment methods breakdown
        const paymentBreakdown: Record<string, number> = {};
        const currencyTypeBreakdown: Record<'LOCAL' | 'FOREIGN', number> = { LOCAL: 0, FOREIGN: 0 };
        const dailySales: Record<string, number> = {};
        let totalSalesAmount = 0;
        let totalSalesNominal = 0;
        let totalCostOfSales = 0;

        const targetRate = Number(targetCurrency?.exchangeRate || 1);
        const conversionRate = (currencyCode === 'VES') ? 1 : targetRate;

        salesInRange.forEach((sale) => {
            const date = dayjs(sale.createdAt).format('YYYY-MM-DD');
            const saleNominalTotal = Number(sale.total || 0);
            totalSalesNominal += saleNominalTotal;

            // NOMINAL MODEL: sale.total is always stored in VES
            // For VES reports: use value as-is (no revaluation)
            // For foreign currency reports: convert using CURRENT rate
            let saleTotalVES = saleNominalTotal;
            let saleTotalTarget;

            if (currencyCode === 'VES') {
                // VES report: use nominal value (no conversion)
                saleTotalTarget = saleTotalVES;
            } else {
                // Foreign currency report: convert at current rate (VES -> Target)
                // We divide by the direct VES->Target rate
                saleTotalTarget = saleTotalVES / conversionRate;
            }

            totalSalesAmount += saleTotalTarget;
            dailySales[date] = (dailySales[date] || 0) + saleTotalTarget;

            // Calculate COGS (normalized to target currency)
            sale.items.forEach(item => {
                let itemCostInVES = Number(item.cost || 0);

                // Fallback for old sales where cost was not captured
                if (itemCostInVES === 0 && item.product) {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    itemCostInVES = Number(item.product.costPrice || 0) * productRate;
                }

                const itemTotalCostVES = itemCostInVES * Number(item.quantity);
                // NOMINAL MODEL: COGS stays at nominal value for VES, converts at current rate for foreign
                const itemTotalCostTarget = currencyCode === 'VES'
                    ? itemTotalCostVES
                    : itemTotalCostVES / conversionRate;

                totalCostOfSales += itemTotalCostTarget;
            });

            const paymentStr = sale.paymentMethod || 'CASH';
            const paymentMethods = paymentStr.split(', ');

            paymentMethods.forEach((payment) => {
                const parts = payment.trim().split(':');
                const method = parts[0].trim().toUpperCase();

                // Formato: METHOD:AMOUNT:RATE
                const partsLength = parts.length;
                const paymentSpecificRate = partsLength > 2 ? parseFloat(parts[2]) : null;

                // Amount source logic:
                // If parts > 1, the amount is explicitly defined in the payment string (likely foreign unit if method is foreign).
                // If parts == 1, we are falling back to the sale nominal total, which is consistently stored in VES.
                let rawAmount = saleNominalTotal;
                let isExplicitForeignAmount = false;

                if (partsLength > 1) {
                    rawAmount = parseFloat(parts[1]);
                    isExplicitForeignAmount = true;
                }

                // Determine if this specific method is foreign (requires multiplication by rate)
                const isForeignMethod =
                    method === 'ZELLE' ||
                    method === 'UDT' ||
                    method.startsWith('CURRENCY_') ||
                    (method.startsWith('ACCOUNT_CREDIT_') && method !== 'ACCOUNT_CREDIT');

                // NOMINAL MODEL: Use payment amount as-is for VES, convert at current rate for foreign
                let amountInVES = rawAmount;

                // If this is a foreign method with explicit amount, it might be in foreign currency
                if (isForeignMethod && isExplicitForeignAmount) {
                    const effectiveRate = paymentSpecificRate || currentRefRate;
                    const proposedAmountInVES = rawAmount * effectiveRate;

                    // Sanity check: if proposed amount is way larger than total, assume it's already in VES
                    if (saleNominalTotal > 0 && proposedAmountInVES > (saleNominalTotal * 1.5)) {
                        amountInVES = rawAmount; // Already in VES
                    } else {
                        amountInVES = proposedAmountInVES;
                    }
                }

                // Convert to target currency for display
                const amountInTarget = currencyCode === 'VES'
                    ? amountInVES
                    : amountInVES / crossRateFactor;

                paymentBreakdown[method] = (paymentBreakdown[method] || 0) + amountInTarget;

                // Currency Type Categorization
                const isDivisa = isForeignMethod || method.includes('_UDT') || method.includes('_USD');
                const type = isDivisa ? 'FOREIGN' : 'LOCAL';
                currencyTypeBreakdown[type] += amountInTarget;
            });
        });

        // 3. Process Returns (Unified logic for Revenue and COGS)
        const returnsInRange = await this.prisma.return.findMany({
            where: {
                status: 'COMPLETED',
                createdAt: dateFilter
            },
            include: {
                items: {
                    include: {
                        product: { include: { currency: true } }
                    }
                },
                replacementItems: {
                    include: {
                        product: { include: { currency: true } }
                    }
                },
                originalSale: { select: { exchangeRate: true } }
            }
        });

        let totalReturnsValue = 0; // Value of items returned to stock (Revenue part)
        let totalReturnsValueNominal = 0;
        let totalReplacementValue = 0; // Value of items taken out (Revenue part)
        let totalReplacementValueNominal = 0;
        let totalMonetaryRefunds = 0;
        let totalExchangeValue = 0;
        let returnedCostOfSales = 0;
        let replacementCostOfSales = 0;

        returnsInRange.forEach(ret => {
            const returnedItemsValueVES = ret.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
            totalReturnsValueNominal += returnedItemsValueVES;

            // NOMINAL MODEL: Returns stay at nominal value
            const returnedValueTarget = currencyCode === 'VES'
                ? returnedItemsValueVES
                : returnedItemsValueVES / conversionRate;
            totalReturnsValue += returnedValueTarget;

            if (ret.returnType === 'REFUND') {
                if (ret.refundAmount && Number(ret.refundAmount) > 0) {
                    // NOMINAL MODEL: Refund stays at nominal value
                    const refundValueTarget = currencyCode === 'VES'
                        ? Number(ret.refundAmount)
                        : Number(ret.refundAmount) / conversionRate;
                    totalMonetaryRefunds += refundValueTarget;

                    if (ret.refundMethod && ret.refundMethod !== 'CREDIT_NOTE') {
                        const method = ret.refundMethod.toUpperCase();
                        paymentBreakdown[method] = (paymentBreakdown[method] || 0) - refundValueTarget;

                        const isDivisa = method === 'ZELLE' || method === 'UDT' || method.includes('_UDT') || method.includes('_USD') || method.startsWith('CURRENCY_');
                        const type = isDivisa ? 'FOREIGN' : 'LOCAL';
                        currencyTypeBreakdown[type] -= refundValueTarget;
                    }
                }
            } else {
                totalExchangeValue += returnedValueTarget;

                // NOMINAL MODEL: Use current rate for replacements
                const replacementsVES = ret.replacementItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
                totalReplacementValueNominal += replacementsVES;
                const replacementsTarget = currencyCode === 'VES'
                    ? replacementsVES
                    : replacementsVES / conversionRate;
                totalReplacementValue += replacementsTarget;

                if (ret.refundAmount && Number(ret.refundAmount) > 0) {
                    const refundValueTarget = currencyCode === 'VES'
                        ? Number(ret.refundAmount)
                        : Number(ret.refundAmount) / conversionRate;
                    totalMonetaryRefunds += refundValueTarget;

                    if (ret.refundMethod && ret.refundMethod !== 'CREDIT_NOTE') {
                        const method = ret.refundMethod.toUpperCase();
                        paymentBreakdown[method] = (paymentBreakdown[method] || 0) - refundValueTarget;
                    }
                }
            }

            // Adjust Daily Trend - NOMINAL MODEL
            const date = dayjs(ret.createdAt).format('YYYY-MM-DD');
            const adjReturnTarget = currencyCode === 'VES' ? returnedItemsValueVES : returnedItemsValueVES / conversionRate;
            const adjReplTarget = (ret.returnType.startsWith('EXCHANGE'))
                ? (currencyCode === 'VES'
                    ? Number(ret.replacementItems.reduce((sum, item) => sum + Number(item.total), 0))
                    : Number(ret.replacementItems.reduce((sum, item) => sum + Number(item.total), 0)) / conversionRate)
                : 0;

            dailySales[date] = (dailySales[date] || 0) - adjReturnTarget + adjReplTarget;

            // COGS Adjustment: Subtract returned sellable products - NOMINAL MODEL
            if (this.SELLABLE_RETURN_REASONS.includes(ret.reason)) {
                ret.items.forEach(item => {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    const itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);
                    returnedCostOfSales += currencyCode === 'VES' ? itemCostInVES : itemCostInVES / conversionRate;
                });
            }

            // COGS Adjustment: Add replacement items cost - NOMINAL MODEL
            if (ret.returnType.startsWith('EXCHANGE')) {
                ret.replacementItems.forEach(item => {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    const itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);
                    replacementCostOfSales += currencyCode === 'VES' ? itemCostInVES : itemCostInVES / conversionRate;
                });
            }
        });

        // Final Net Sales calculation
        totalSalesAmount = totalSalesAmount - totalReturnsValue + totalReplacementValue;
        totalSalesNominal = totalSalesNominal - totalReturnsValueNominal + totalReplacementValueNominal;

        // Purchases for the selected range
        const purchasesInRangeList = await this.prisma.purchase.findMany({
            where: {
                createdAt: dateFilter,
                status: 'COMPLETED'
            },
            select: { total: true, exchangeRate: true, currencyCode: true }
        });

        // Expenses for the selected range
        const expensesInRangeList = await this.prisma.expense.findMany({
            where: {
                date: dateFilter
            },
            select: { amount: true, exchangeRate: true, currencyCode: true }
        });

        let totalPurchasesAmount = 0;
        purchasesInRangeList.forEach(p => {
            let val = Number(p.total);
            const pRate = Number(p.exchangeRate) || 1;
            const valInVES = p.currencyCode === 'VES' ? val : val * pRate;

            // Fixed-Cost Projection: Use currentRefRate instead of historicalRate
            // to ensure other currencies reflect the current value of the Bs. spent.
            totalPurchasesAmount += (valInVES / currentRefRate) * crossRateFactor;
        });

        let totalExpensesAmount = 0;
        expensesInRangeList.forEach(e => {
            let val = Number(e.amount);
            const eRate = Number(e.exchangeRate) || 1;
            const valInVES = e.currencyCode === 'VES' ? val : val * eRate;

            const historicalRate = (eRate !== 1) ? eRate : currentRefRate;
            totalExpensesAmount += (valInVES / historicalRate) * crossRateFactor;
        });

        let adjustedCostOfSales = totalCostOfSales - returnedCostOfSales + replacementCostOfSales;

        // Add inventory losses (DAMAGE, LOSS) to cost of sales
        const inventoryLosses = await this.prisma.inventoryAdjustment.findMany({
            where: {
                createdAt: dateFilter,
                type: 'DECREASE',
                reason: { in: this.LOSS_ADJUSTMENT_REASONS }
            },
            include: {
                product: { include: { currency: true } }
            }
        });

        let inventoryLossCost = 0;
        inventoryLosses.forEach(adj => {
            const productRate = adj.product.currency?.isPrimary ? 1 : Number(adj.product.currency?.exchangeRate || 1);
            let lossCostInVES = Number(adj.product.costPrice || 0) * productRate * Number(adj.quantity);

            if (currencyCode !== 'VES') {
                inventoryLossCost += (lossCostInVES / currentRefRate) * crossRateFactor;
            } else {
                inventoryLossCost += lossCostInVES;
            }
        });

        adjustedCostOfSales += inventoryLossCost;

        return {
            monthlySalesTotal: Number(totalSalesAmount.toFixed(2)),
            monthlySalesNominal: Number(totalSalesNominal.toFixed(2)),
            monthlyPurchasesTotal: Number(totalPurchasesAmount.toFixed(2)),
            totalCostOfSales: Number(adjustedCostOfSales.toFixed(2)),
            returnedCostOfSales: Number(returnedCostOfSales.toFixed(2)),
            replacementCostOfSales: Number(replacementCostOfSales.toFixed(2)),
            inventoryLossCost: Number(inventoryLossCost.toFixed(2)),
            totalExpenses: Number(totalExpensesAmount.toFixed(2)),
            totalMonetaryRefunds: Number(totalMonetaryRefunds.toFixed(2)),
            totalExchangeValue: Number(totalExchangeValue.toFixed(2)),
            paymentMethodsBreakdown: Object.entries(paymentBreakdown).map(
                ([method, amount]) => ({
                    method,
                    amount: Number(amount.toFixed(2)),
                }),
            ),
            currencyTypeBreakdown: {
                LOCAL: Number(currencyTypeBreakdown.LOCAL.toFixed(2)),
                FOREIGN: Number(currencyTypeBreakdown.FOREIGN.toFixed(2)),
            },
            dailySalesData: Object.entries(dailySales).map(
                ([date, amount]) => ({
                    date: dayjs(date).format('DD/MM'),
                    amount: Number(amount.toFixed(2)),
                }),
            ),
        };
    }

    async getCOGSReport(currencyCode: string = 'VES', startDate?: string, endDate?: string) {
        const dateFilter: any = {};

        if (startDate || endDate) {
            if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
            if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
        } else {
            // Unify with getInflationReport default
            dateFilter.gte = dayjs().startOf('month').toDate();
        }

        const targetCurrency = await this.prisma.currency.findUnique({ where: { code: currencyCode } });

        // 2. Get Reference Currency (The one stored in sale.exchangeRate, usually USD)
        const companySettings = await this.prisma.companySettings.findFirst({
            include: { preferredSecondaryCurrency: true }
        });
        const refCurrency = companySettings?.preferredSecondaryCurrency;
        const currentRefRate = Number(refCurrency?.exchangeRate || 1);

        // Calculate Cross-Rate Factor (Ref -> Target)
        let crossRateFactor = 1;
        if (currencyCode === 'VES') {
            crossRateFactor = currentRefRate;
        } else if (targetCurrency && refCurrency && targetCurrency.code !== refCurrency.code) {
            const targetRate = Number(targetCurrency.exchangeRate || 1);
            if (targetRate > 0) {
                crossRateFactor = currentRefRate / targetRate;
            }
        }

        // 1. Fetch Sales and their Items for COGS
        const sales = await this.prisma.sale.findMany({
            where: { active: true, createdAt: dateFilter },
            include: {
                items: {
                    include: {
                        product: {
                            include: {
                                category: true,
                                currency: true
                            }
                        }
                    }
                }
            }
        });

        const targetRate = Number(targetCurrency?.exchangeRate || 1);
        const conversionRate = (currencyCode === 'VES') ? 1 : targetRate;

        const productBreakdown: Record<string, {
            name: string;
            sku: string | null;
            category: string;
            quantity: number;
            totalCost: number;
            totalRevenue: number;
            inflationLoss: number;
        }> = {};

        let totalSales = 0;
        let totalSalesNominal = 0;
        let totalCOGS = 0;
        let totalInflationLoss = 0;

        sales.forEach(sale => {
            const historicalRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                ? Number(sale.exchangeRate)
                : currentRefRate;

            // Calculate Inflation Loss for this sale (Portion in VES)
            let saleInflationLossVES = 0;
            const paymentStr = sale.paymentMethod || 'CASH';
            const payments = paymentStr.split(', ');

            payments.forEach(p => {
                const parts = p.trim().split(':');
                const method = parts[0].toUpperCase();
                let rawAmount = Number(sale.total);
                if (parts.length > 1) rawAmount = Number(parts[1]);

                const isDivisa =
                    method === 'ZELLE' ||
                    method === 'UDT' ||
                    method.includes('_UDT') ||
                    method.includes('_USD') ||
                    method.startsWith('CURRENCY_') ||
                    (method.startsWith('ACCOUNT_CREDIT_') && method !== 'ACCOUNT_CREDIT');

                if (!isDivisa) {
                    const nominalVES = rawAmount;
                    const revaluedVES = (nominalVES / historicalRate) * currentRefRate;
                    saleInflationLossVES += (revaluedVES - nominalVES);
                }
            });

            // Normalize Total Inflation Loss for the summary at sale level
            // To ensure it matches the dedicated report (which counts every Bs. received)
            totalInflationLoss += (saleInflationLossVES / currentRefRate) * crossRateFactor;

            const saleNominalTotalValue = Number(sale.total || 0);
            totalSalesNominal += saleNominalTotalValue;

            // USE SALE HEADER for Main Total (Consistency with Finance/Balance)
            const saleTargetValue = currencyCode === 'VES'
                ? saleNominalTotalValue
                : saleNominalTotalValue / conversionRate;
            totalSales += saleTargetValue;

            sale.items.forEach(item => {
                let itemCostInVES = Number(item.cost || 0);

                if (itemCostInVES === 0 && item.product) {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    itemCostInVES = Number(item.product.costPrice || 0) * productRate;
                }

                let cost = itemCostInVES * Number(item.quantity);
                let revenue = Number(item.total);

                // NOMINAL MODEL: Use nominal values for VES, convert at current rate for foreign
                if (currencyCode === 'VES') {
                    // Keep values as-is
                } else {
                    cost = cost / conversionRate;
                    revenue = revenue / conversionRate;
                }

                // Portion of inflation loss for this item
                // FIXED: Use currentRefRate in denominator to avoid double-revaluation
                const itemInflationLoss = (Number(item.total || 0) / (saleNominalTotalValue || 1)) * (saleInflationLossVES / currentRefRate) * crossRateFactor;

                // totalSales += revenue; // Removed: We use Sale Header for consistency now.
                totalCOGS += cost;
                // Accumulation already happened above at sale level to capture gaps (shipping/discounts)

                const pid = item.product.id;
                if (!productBreakdown[pid]) {
                    productBreakdown[pid] = {
                        name: item.product.name,
                        sku: item.product.sku,
                        category: item.product.category?.name || 'S/C',
                        quantity: 0,
                        totalCost: 0,
                        totalRevenue: 0,
                        inflationLoss: 0
                    };
                }

                productBreakdown[pid].quantity += Number(item.quantity);
                productBreakdown[pid].totalCost += cost;
                productBreakdown[pid].totalRevenue += revenue;
                productBreakdown[pid].inflationLoss += itemInflationLoss;
            });
        });

        // 2. Fetch Purchases
        const purchases = await this.prisma.purchase.findMany({
            where: { createdAt: dateFilter, status: 'COMPLETED' },
            select: { total: true, exchangeRate: true, currencyCode: true }
        });

        let totalPurchases = 0;
        purchases.forEach(p => {
            let val = Number(p.total);
            const pRate = Number(p.exchangeRate) || 1;
            const valInVES = p.currencyCode === 'VES' ? val : val * pRate;

            // Fixed-Cost Projection: (Total Bs. Spent) projected to Target Currency
            totalPurchases += (valInVES / currentRefRate) * crossRateFactor;
        });

        // 3. Fetch Expenses
        const expenses = await this.prisma.expense.findMany({
            where: { date: dateFilter },
            select: { amount: true, exchangeRate: true, currencyCode: true }
        });

        let totalExpenses = 0;
        expenses.forEach(e => {
            let val = Number(e.amount);
            const eRate = Number(e.exchangeRate) || 1;
            const valInVES = e.currencyCode === 'VES' ? val : val * eRate;

            const historicalRate = (eRate !== 1) ? eRate : currentRefRate;
            totalExpenses += (valInVES / historicalRate) * crossRateFactor;
        });

        // 4. Calculate Adjustments from Returns and Exchanges
        const completedReturns = await this.prisma.return.findMany({
            where: {
                status: 'COMPLETED',
                createdAt: dateFilter // Use createdAt for revenue consistency
            },
            include: {
                items: {
                    include: {
                        product: {
                            include: { currency: true }
                        }
                    }
                },
                replacementItems: {
                    include: {
                        product: {
                            include: { currency: true }
                        }
                    }
                },
                originalSale: { select: { exchangeRate: true } }
            }
        });

        let returnedCOGS = 0;
        let replacementCOGS = 0;
        let totalReturnsValue = 0;
        let totalReplacementValue = 0;
        let returnedValueNominal = 0;
        let replacementValueNominal = 0;

        completedReturns.forEach(ret => {
            // REVALUE RETURN: Use nominal value converted at current rate (Standardized)
            // const historicalRate = ... (Unused now for consistency with Finance Report)

            const returnedValueVES = ret.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
            const returnedValueTarget = currencyCode === 'VES' ? returnedValueVES : returnedValueVES / conversionRate;
            totalReturnsValue += returnedValueTarget;
            returnedValueNominal += returnedValueVES;

            // Only subtract from COGS if products are sellable again (use historical cost or current?)
            // COGS is generally revalued at current rate in this app for "proyectado"
            if (this.SELLABLE_RETURN_REASONS.includes(ret.reason)) {
                ret.items.forEach(item => {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    const itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);
                    // Use historical rate for consistency with how they were added to COGS
                    returnedCOGS += currencyCode === 'VES' ? itemCostInVES : itemCostInVES / conversionRate;
                });
            }

            // REVALUE REPLACEMENT: Use current rate
            if (ret.returnType.startsWith('EXCHANGE')) {
                const replacementsVES = ret.replacementItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
                const replacementsTarget = currencyCode === 'VES' ? replacementsVES : replacementsVES / conversionRate;
                totalReplacementValue += replacementsTarget;
                replacementValueNominal += replacementsVES;

                // Add replacement cost to COGS
                ret.replacementItems.forEach(item => {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    const itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);
                    replacementCOGS += currencyCode === 'VES' ? itemCostInVES : itemCostInVES / conversionRate;
                });
            }

            // ADJUST INFLATION LOSS FOR RETURNS/REFUNDS (Subtract loss from BS refunds)
            // Use same logic as getInflationReport
            const refundMethod = (ret as any).refundMethod?.toUpperCase();
            const isBSRefund = refundMethod && ![
                'ZELLE', 'UDT', 'CURRENCY_USD', 'CURRENCY_EUR'
            ].some(m => refundMethod.includes(m));

            if (isBSRefund && ret.refundAmount && Number(ret.refundAmount) > 0) {
                const nominalVES = Number(ret.refundAmount);

                // If displaying in VES, there is no "inflation loss" relevant to this specific calc (or it's 0)
                // But logic originally calculated loss vs USD ref. 
                // We'll keep inflation logic separate as it's specifically about VES value erosion against the Ref Currency.
                // However, for consistency with 'conversionRate' usage:

                const historicalRate = (Number(ret.originalSale?.exchangeRate) && Number(ret.originalSale?.exchangeRate) !== 1)
                    ? Number(ret.originalSale?.exchangeRate)
                    : currentRefRate;

                const revaluedVES = (nominalVES / historicalRate) * currentRefRate;
                // Inflation loss is always relative to Reference Currency (Base logic), so we keep crossRateFactor here
                // UNLESS we want to project that loss to the target currency. 
                // Let's use (loss / currentRefRate) * crossRateFactor as originally intended for Inflation Metric.
                const refundLoss = ((revaluedVES - nominalVES) / currentRefRate) * crossRateFactor;

                totalInflationLoss -= refundLoss;

                // Distribute refund loss back to products in this return (rough estimate)
                const returnTotal = ret.items.reduce((s, i) => s + Number(i.total), 0) || 1;
                ret.items.forEach(item => {
                    const pid = item.product.id;
                    if (productBreakdown[pid]) {
                        const itemPortion = (Number(item.total) / returnTotal) * refundLoss;
                        productBreakdown[pid].inflationLoss -= itemPortion;
                    }
                });
            }
        });

        // Net Sales calculation consistent with Finance Report
        totalSales = totalSales - totalReturnsValue + totalReplacementValue;
        totalSalesNominal = totalSalesNominal - returnedValueNominal + replacementValueNominal;

        // Add inventory losses (DAMAGE, LOSS) to COGS
        const inventoryLosses = await this.prisma.inventoryAdjustment.findMany({
            where: {
                createdAt: dateFilter,
                type: 'DECREASE',
                reason: { in: this.LOSS_ADJUSTMENT_REASONS }
            },
            include: {
                product: {
                    include: { currency: true }
                }
            }
        });

        let inventoryLossCOGS = 0;
        inventoryLosses.forEach(adj => {
            const productRate = adj.product.currency?.isPrimary ? 1 : Number(adj.product.currency?.exchangeRate || 1);
            let lossCostInVES = Number(adj.product.costPrice || 0) * productRate * Number(adj.quantity);

            inventoryLossCOGS += currencyCode === 'VES' ? lossCostInVES : lossCostInVES / conversionRate;
        });



        // Final COGS = Sales COGS - Returns + Replacements + Inventory Losses
        let adjustedCOGS = totalCOGS - returnedCOGS + replacementCOGS + inventoryLossCOGS;

        return {
            totalSales: Number(totalSales.toFixed(2)),
            totalSalesNominal: Number(totalSalesNominal.toFixed(2)),
            totalCOGS: Number(adjustedCOGS.toFixed(2)),
            totalInflationLoss: Number(totalInflationLoss.toFixed(2)),
            returnedCOGS: Number(returnedCOGS.toFixed(2)),
            replacementCOGS: Number(replacementCOGS.toFixed(2)),
            inventoryLossCOGS: Number(inventoryLossCOGS.toFixed(2)),
            totalPurchases: Number(totalPurchases.toFixed(2)),
            totalExpenses: Number(totalExpenses.toFixed(2)),
            products: Object.values(productBreakdown)
                .map(p => ({
                    ...p,
                    totalCost: Number(p.totalCost.toFixed(2)),
                    totalRevenue: Number(p.totalRevenue.toFixed(2)),
                    inflationLoss: Number(p.inflationLoss.toFixed(2)),
                }))
                .sort((a, b) => b.totalCost - a.totalCost)
        };
    }

    async getBalanceReport(currencyCode: string = 'VES') {
        const balanceData: {
            month: string;
            income: number;
            incomeNominal: number; // Added
            expenses: number;
            purchases: number;
            total: number;
            cogs: number;
            profitMargin: number;
            operatingCostRatio: number;
        }[] = [];

        const now = dayjs();

        // 1. Get Target Currency (if not VES)
        const targetCurrency = currencyCode !== 'VES'
            ? await this.prisma.currency.findUnique({ where: { code: currencyCode } })
            : null;

        // 2. Get Reference Currency (The one stored in sale.exchangeRate, usually USD)
        const companySettings = await this.prisma.companySettings.findFirst({
            include: { preferredSecondaryCurrency: true }
        });
        const refCurrency = companySettings?.preferredSecondaryCurrency;

        // Calculate Cross-Rate Factor (Ref -> Target)
        // If we have 100 USD (Ref), how many EUR (Target) is that?
        // Factor = RefRate / TargetRate. 
        // Example: USD=60, EUR=65. 1 USD = 0.92 EUR.
        let crossRateFactor = 1;
        const currentRefRate = Number(refCurrency?.exchangeRate || 1);

        if (currencyCode === 'VES') {
            crossRateFactor = currentRefRate;
        } else if (targetCurrency && refCurrency && targetCurrency.code !== refCurrency.code) {
            const tr = Number(targetCurrency.exchangeRate || 1);
            if (tr > 0) {
                crossRateFactor = currentRefRate / tr;
            }
        }

        const targetRate = Number(targetCurrency?.exchangeRate || 1);
        const conversionRate = (currencyCode === 'VES') ? 1 : targetRate;

        for (let i = 11; i >= 0; i--) {
            const currentMonth = now.subtract(i, 'month');
            const start = currentMonth.startOf('month').toDate();
            const end = currentMonth.endOf('month').toDate();

            // 1. SALES (Ingresos)
            const sales = await this.prisma.sale.findMany({
                where: { createdAt: { gte: start, lte: end }, active: true },
                select: {
                    total: true,
                    exchangeRate: true,
                    items: {
                        select: {
                            cost: true,
                            quantity: true,
                            product: {
                                select: {
                                    currency: true,
                                    costPrice: true
                                }
                            }
                        }
                    }
                }
            });

            // 2. PURCHASES (Compras - Costos de Venta)
            const purchases = await this.prisma.purchase.findMany({
                where: { createdAt: { gte: start, lte: end } },
                select: { total: true, exchangeRate: true, currencyCode: true }
            });

            // 3. EXPENSES (Gastos Operativos)
            const expenses = await this.prisma.expense.findMany({
                where: { date: { gte: start, lte: end } },
                select: { amount: true, exchangeRate: true, currencyCode: true }
            });

            // --- CONVERSION LOGIC ---
            // Rule: "Traer los datos basados en las tasas cuando registró las ventas"
            // If viewing in VES: Use amounts as stored (assuming base is VES).
            // If viewing in USD: Divide VES amount by the historical exchange rate of that transaction.

            let monthlyIncome = 0;
            let monthlyIncomeNominal = 0; // Added
            let monthlyOperationalExpenses = 0;
            let monthlyPurchases = 0;
            let monthlyCOGS = 0;

            // Calculate Income
            sales.forEach(sale => {
                let amount = Number(sale.total);
                let totalCostVES = 0;
                sale.items.forEach(item => {
                    let itemCostInVES = Number(item.cost || 0);

                    // Fallback for old sales where cost was not captured
                    // We use the current product cost converted to VES
                    if (itemCostInVES === 0 && item.product) {
                        const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                        itemCostInVES = Number(item.product.costPrice || 0) * productRate;
                    }

                    totalCostVES += (itemCostInVES * Number(item.quantity));
                });

                // NOMINAL MODEL: Use sale.total as-is for VES, convert at current rate for foreign
                const currentSaleTotal = Number(sale.total || 0);
                if (currencyCode === 'VES') {
                    monthlyIncome += currentSaleTotal;
                    monthlyCOGS += totalCostVES;
                } else {
                    monthlyIncome += currentSaleTotal / conversionRate;
                    monthlyCOGS += totalCostVES / conversionRate;
                }
                monthlyIncomeNominal += currentSaleTotal;
            });

            // Calculate Expenses (Purchases + Expenses)
            purchases.forEach(p => {
                let amount = Number(p.total);
                // If purchase was in Foreign Currency but we want VES, multiply.
                // If purchase was in VES but we want Foreign, divide.
                // Simplified assumption: System stores values in Base Currency (VES) or normalization happens.
                // However, Purchase model has currencyCode. Let's handle it:

                const rate = Number(p.exchangeRate) || 1;
                let amountInVES = p.currencyCode === 'VES' ? amount : amount * rate;

                // Fixed-Cost Projection for Purchases
                monthlyPurchases += (amountInVES / currentRefRate) * crossRateFactor;
            });

            expenses.forEach(e => {
                const amount = Number(e.amount);
                const rate = Number(e.exchangeRate) || 1;

                let amountInVES = e.currencyCode === 'VES' ? amount : amount * rate;

                const historicalRate = (rate !== 1) ? rate : currentRefRate;
                monthlyOperationalExpenses += (amountInVES / historicalRate) * crossRateFactor;
            });

            // 4. Calculate Adjustments from Returns and Exchanges
            const returnsInRange = await this.prisma.return.findMany({
                where: {
                    status: 'COMPLETED',
                    createdAt: { gte: start, lte: end } // Use createdAt for revenue consistency
                },
                include: {
                    items: {
                        include: {
                            product: {
                                include: { currency: true }
                            }
                        }
                    },
                    replacementItems: {
                        include: {
                            product: {
                                include: { currency: true }
                            }
                        }
                    },
                    originalSale: { select: { exchangeRate: true } }
                }
            });

            let monthlyReturnsValue = 0;
            let monthlyReplacementValue = 0;
            let monthlyReturnedCOGS = 0;
            let monthlyReplacementCOGS = 0;

            returnsInRange.forEach(ret => {
                // REVALUE RETURN: Use nominal value converted at current rate (Standardized)
                // const historicalRate = ... (Unused now for consistency with Finance Report)

                const returnedValueVES = ret.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
                const returnedValueTarget = currencyCode === 'VES' ? returnedValueVES : returnedValueVES / conversionRate;
                monthlyReturnsValue += returnedValueTarget;
                monthlyIncomeNominal -= returnedValueVES; // Added

                // Sync COGS adjustment
                if (this.SELLABLE_RETURN_REASONS.includes(ret.reason)) {
                    ret.items.forEach(item => {
                        const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                        const itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);
                        monthlyReturnedCOGS += currencyCode === 'VES' ? itemCostInVES : itemCostInVES / conversionRate;
                    });
                }

                // REVALUE REPLACEMENT: Use current rate
                if (ret.returnType.startsWith('EXCHANGE')) {
                    const replacementsVES = ret.replacementItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
                    const replacementsTarget = currencyCode === 'VES' ? replacementsVES : replacementsVES / conversionRate;
                    monthlyReplacementValue += replacementsTarget;
                    monthlyIncomeNominal += replacementsVES; // Added

                    // Add replacement cost to COGS
                    ret.replacementItems.forEach(item => {
                        const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                        const itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);
                        monthlyReplacementCOGS += currencyCode === 'VES' ? itemCostInVES : itemCostInVES / conversionRate;
                    });
                }
            });

            // Final Net Income compatible with Finance Report and Dashboard
            monthlyIncome = monthlyIncome - monthlyReturnsValue + monthlyReplacementValue;

            // Adjusted COGS = COGS - Returns + Replacements
            let adjustedMonthlyCOGS = monthlyCOGS - monthlyReturnedCOGS + monthlyReplacementCOGS;

            // Add inventory losses (DAMAGE, LOSS) to COGS
            const monthlyInventoryLosses = await this.prisma.inventoryAdjustment.findMany({
                where: {
                    createdAt: { gte: start, lte: end },
                    type: 'DECREASE',
                    reason: { in: this.LOSS_ADJUSTMENT_REASONS }
                },
                include: {
                    product: { include: { currency: true } }
                }
            });

            let monthlyInventoryLossCOGS = 0;
            monthlyInventoryLosses.forEach(adj => {
                const productRate = adj.product.currency?.isPrimary ? 1 : Number(adj.product.currency?.exchangeRate || 1);
                let lossCostInVES = Number(adj.product.costPrice || 0) * productRate * Number(adj.quantity);

                monthlyInventoryLossCOGS += currencyCode === 'VES' ? lossCostInVES : lossCostInVES / conversionRate;
            });

            adjustedMonthlyCOGS += monthlyInventoryLossCOGS;

            // Metrics
            // Real Profit = Income - Operational Expenses - COGS
            const realProfit = monthlyIncome - monthlyOperationalExpenses - adjustedMonthlyCOGS;
            // Profit Margin % = (Real Profit / Revenue) * 100
            const profitMargin = monthlyIncome > 0 ? (realProfit / monthlyIncome) * 100 : 0;
            // Operating Cost Ratio % = (Expenses / Revenue) * 100
            const operatingCostRatio = monthlyIncome > 0 ? (monthlyOperationalExpenses / monthlyIncome) * 100 : 0;

            balanceData.push({
                month: currentMonth.format('MMMM'), // Just Month Name
                income: Number(monthlyIncome.toFixed(2)),
                incomeNominal: Number(monthlyIncomeNominal.toFixed(2)), // Added
                expenses: Number(monthlyOperationalExpenses.toFixed(2)),
                purchases: Number(monthlyPurchases.toFixed(2)),
                total: Number(realProfit.toFixed(2)),
                cogs: Number(adjustedMonthlyCOGS.toFixed(2)),
                profitMargin: Number(profitMargin.toFixed(1)),
                operatingCostRatio: Number(operatingCostRatio.toFixed(1))
            });
        }

        return balanceData;
    }

    async getTopProducts(startDate?: string, endDate?: string, sortBy: 'units' | 'profit' = 'units', limit: number = 10, currency: string = 'VES') {
        // Default to last 30 days if no dates provided
        const start = startDate ? new Date(startDate) : dayjs().subtract(30, 'day').startOf('day').toDate();
        const end = endDate ? new Date(endDate) : dayjs().endOf('day').toDate();
        // Ensure end date covers the whole day
        const endFinal = endDate ? dayjs(endDate).endOf('day').toDate() : end;

        // Determine if we need to convert to ANY target currency
        // We will fetch the target currency's current rate to convert the Report totals.
        // This answers "What is that past revenue worth in today's X currency?"

        const rawResults = await this.prisma.$queryRaw<any[]>`
            SELECT 
                p.id,
                p.name,
                SUM(si.quantity) as units,
                
                -- Profit Calculation
                -- 1. Calculate Profit in Primary Currency (VES)
                --    Profit(VES) = Total(VES) - Cost(VES_Normalized)
                -- 2. Convert to Target Currency using Current Rate of Target Currency
                --    Profit(Target) = Profit(VES) / TargetRate
                
                SUM(
                    (si.total - (COALESCE(NULLIF(si.cost, 0), (p."costPrice" * COALESCE(c."exchangeRate", 1)), 0) * si.quantity)) 
                    / (CASE 
                        WHEN tc."isPrimary" IS TRUE THEN 1 
                        ELSE COALESCE(tc."exchangeRate", 1) 
                       END)
                ) as profit,

                -- Total Cost Calculation
                SUM(
                    (COALESCE(NULLIF(si.cost, 0), (p."costPrice" * COALESCE(c."exchangeRate", 1)), 0) * si.quantity)
                    / (CASE 
                        WHEN tc."isPrimary" IS TRUE THEN 1 
                        ELSE COALESCE(tc."exchangeRate", 1) 
                       END)
                ) as total_cost,

                -- Revenue Calculation
                SUM(
                    si.total 
                    / (CASE 
                        WHEN tc."isPrimary" IS TRUE THEN 1 
                        ELSE COALESCE(tc."exchangeRate", 1) 
                       END)
                ) as revenue

            FROM "sale_items" si
            JOIN "products" p ON si."productId" = p.id
            LEFT JOIN "currencies" c ON p."currencyId" = c.id
            CROSS JOIN "currencies" tc
            JOIN "sales" s ON si."saleId" = s.id
            WHERE s.active = true
            AND tc.code = ${currency} -- Filter to get the target currency rate
            AND s."createdAt" >= ${start}
            AND s."createdAt" <= ${endFinal}
            GROUP BY p.id, p.name, tc.id, tc."exchangeRate", tc."isPrimary"
        `;

        // Sort in JS to avoid dynamic SQL injection issues
        const sorted = rawResults.sort((a, b) => {
            const valA = Number(sortBy === 'profit' ? a.profit : a.units);
            const valB = Number(sortBy === 'profit' ? b.profit : b.units);
            return valB - valA;
        });

        return sorted.slice(0, limit).map(item => {
            const revenue = Number(item.revenue);
            const profit = Number(item.profit);
            const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

            return {
                id: item.id,
                name: item.name,
                units: Number(item.units),
                totalCost: Number(item.total_cost), // Mapped from snake_case alias
                profit: profit,
                revenue: revenue,
                margin: Number(margin.toFixed(2))
            };
        });
    }

    async getInflationReport(startDate?: string, endDate?: string) {
        const dateFilter: any = {};
        if (startDate || endDate) {
            if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
            if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
        } else {
            dateFilter.gte = dayjs().startOf('month').toDate();
        }

        const { currentRefRate } = await this.getCrossRateFactor('VES');

        // 1. Fetch all required data
        const [sales, allReturns, inventoryLosses, expenses] = await Promise.all([
            this.prisma.sale.findMany({
                where: { active: true, createdAt: dateFilter },
                select: {
                    total: true, paymentMethod: true, createdAt: true, exchangeRate: true,
                    items: {
                        select: {
                            cost: true, quantity: true,
                            product: { select: { currency: true, costPrice: true } }
                        }
                    }
                }
            }),
            this.prisma.return.findMany({
                where: { status: 'COMPLETED', createdAt: dateFilter },
                select: {
                    refundAmount: true, refundMethod: true, createdAt: true, reason: true, returnType: true,
                    originalSale: { select: { exchangeRate: true } },
                    items: { include: { product: { include: { currency: true } } } },
                    replacementItems: { include: { product: { include: { currency: true } } } }
                }
            }),
            this.prisma.inventoryAdjustment.findMany({
                where: { createdAt: dateFilter, type: 'DECREASE', reason: { in: this.LOSS_ADJUSTMENT_REASONS } },
                include: { product: { include: { currency: true } } }
            }),
            this.prisma.expense.findMany({
                where: { date: dateFilter },
                select: { amount: true, currencyCode: true, exchangeRate: true, date: true }
            })
        ]);

        // 2. Initialize processing variables
        let totalNominalVES = 0;
        let totalRevaluedVES = 0;
        const methodBreakdown: Record<string, { nominal: number, revalued: number, loss: number }> = {};
        const dailyData: Record<string, { nominal: number, revalued: number, loss: number }> = {};
        const monthlyHistory: Record<string, {
            month: string, revaluedSales: number, revaluedCOGS: number, revaluedExpenses: number,
            operatingProfit: number, inflationLoss: number, realProfit: number
        }> = {};

        const getMonthRecord = (date: Date) => {
            const monthKey = dayjs(date).format('YYYY-MM');
            if (!monthlyHistory[monthKey]) {
                monthlyHistory[monthKey] = {
                    month: dayjs(date).format('MMMM YYYY'),
                    revaluedSales: 0, revaluedCOGS: 0, revaluedExpenses: 0,
                    operatingProfit: 0, inflationLoss: 0, realProfit: 0
                };
            }
            return monthlyHistory[monthKey];
        };

        // 3. Process Sales
        sales.forEach(sale => {
            const dateStr = dayjs(sale.createdAt).format('YYYY-MM-DD');
            const m = getMonthRecord(sale.createdAt);
            const historicalRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                ? Number(sale.exchangeRate) : currentRefRate;

            // Income and COGS synchronization
            const saleRevaluedVES = (Number(sale.total) / historicalRate) * currentRefRate;
            m.revaluedSales += saleRevaluedVES;

            sale.items.forEach(item => {
                let itemCostInVES = Number(item.cost || 0);
                if (itemCostInVES === 0 && item.product) {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    itemCostInVES = Number(item.product.costPrice || 0) * productRate;
                }
                const itemTotalCostRevalued = (itemCostInVES * Number(item.quantity) / historicalRate) * currentRefRate;
                m.revaluedCOGS += itemTotalCostRevalued;
            });

            // Inflation Reporting (Nominal vs Revalued)
            const paymentStr = sale.paymentMethod || 'CASH';
            paymentStr.split(', ').forEach(p => {
                const parts = p.trim().split(':');
                const method = parts[0].toUpperCase();
                let rawAmount = parts.length > 1 ? Number(parts[1]) : Number(sale.total);

                const isDivisa = method === 'ZELLE' || method === 'UDT' || method.includes('_UDT') ||
                    method.includes('_USD') || method.startsWith('CURRENCY_') ||
                    (method.startsWith('ACCOUNT_CREDIT_') && method !== 'ACCOUNT_CREDIT');

                if (!isDivisa) {
                    const nominalVES = rawAmount;
                    const revaluedVES = (nominalVES / historicalRate) * currentRefRate;
                    const loss = revaluedVES - nominalVES;

                    totalNominalVES += nominalVES;
                    totalRevaluedVES += revaluedVES;
                    m.inflationLoss += loss;

                    if (!methodBreakdown[method]) methodBreakdown[method] = { nominal: 0, revalued: 0, loss: 0 };
                    methodBreakdown[method].nominal += nominalVES;
                    methodBreakdown[method].revalued += revaluedVES;
                    methodBreakdown[method].loss += loss;

                    if (!dailyData[dateStr]) dailyData[dateStr] = { nominal: 0, revalued: 0, loss: 0 };
                    dailyData[dateStr].nominal += nominalVES;
                    dailyData[dateStr].revalued += revaluedVES;
                    dailyData[dateStr].loss += loss;
                }
            });
        });

        // 4. Process Returns
        allReturns.forEach(ret => {
            const m = getMonthRecord(ret.createdAt);
            const historicalRate = (Number(ret.originalSale?.exchangeRate) && Number(ret.originalSale?.exchangeRate) !== 1)
                ? Number(ret.originalSale?.exchangeRate) : currentRefRate;

            // Inflation Reporting Adjustment (for BS refunds)
            if (ret.refundAmount && Number(ret.refundAmount) > 0 && ret.refundMethod) {
                const method = ret.refundMethod.toUpperCase();
                const isDivisa = method === 'ZELLE' || method === 'UDT' || method.includes('_UDT') ||
                    method.includes('_USD') || method.startsWith('CURRENCY_');

                if (!isDivisa) {
                    const nominalVES = Number(ret.refundAmount);
                    const revaluedVES = (nominalVES / historicalRate) * currentRefRate;
                    const loss = revaluedVES - nominalVES;

                    totalNominalVES -= nominalVES;
                    totalRevaluedVES -= revaluedVES;
                    m.inflationLoss -= loss;

                    if (methodBreakdown[method]) {
                        methodBreakdown[method].nominal -= nominalVES;
                        methodBreakdown[method].revalued -= revaluedVES;
                        methodBreakdown[method].loss -= loss;
                    }

                    const dateStr = dayjs(ret.createdAt).format('YYYY-MM-DD');
                    if (dailyData[dateStr]) {
                        dailyData[dateStr].nominal -= nominalVES;
                        dailyData[dateStr].revalued -= revaluedVES;
                        dailyData[dateStr].loss -= loss;
                    }
                }
            }

            // Operating Profit Synchronization
            const returnedValueVES = ret.items.reduce((sum, item) => sum + Number(item.total || 0), 0);
            m.revaluedSales -= (returnedValueVES / historicalRate) * currentRefRate;

            if (this.SELLABLE_RETURN_REASONS.includes(ret.reason)) {
                ret.items.forEach(item => {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    const itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);
                    m.revaluedCOGS -= (itemCostInVES / historicalRate) * currentRefRate;
                });
            }

            if (ret.returnType.startsWith('EXCHANGE')) {
                const replacementsVES = ret.replacementItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
                m.revaluedSales += (replacementsVES / currentRefRate) * currentRefRate;
                ret.replacementItems.forEach(item => {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    const itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);
                    m.revaluedCOGS += (itemCostInVES / currentRefRate) * currentRefRate;
                });
            }
        });

        // 5. Process Inventory Losses
        inventoryLosses.forEach(adj => {
            const m = getMonthRecord(adj.createdAt);
            const productRate = adj.product.currency?.isPrimary ? 1 : Number(adj.product.currency?.exchangeRate || 1);
            const lossCostInVES = Number(adj.product.costPrice || 0) * productRate * Number(adj.quantity);
            m.revaluedCOGS += lossCostInVES; // Revalued at current is just themselves
        });

        // 6. Process Expenses
        expenses.forEach(exp => {
            const m = getMonthRecord(exp.date);
            const eRate = Number(exp.exchangeRate) || 1;
            const valInVES = exp.currencyCode === 'VES' ? Number(exp.amount) : Number(exp.amount) * eRate;
            const historicalRate = (eRate !== 1) ? eRate : currentRefRate;
            m.revaluedExpenses += (valInVES / historicalRate) * currentRefRate;
        });

        // 7. Finalize and Return
        const finalMonthlyHistory = Object.values(monthlyHistory).map(m => {
            const operatingProfit = m.revaluedSales - m.revaluedCOGS - m.revaluedExpenses;
            return { ...m, operatingProfit, realProfit: operatingProfit - m.inflationLoss };
        }).sort((a, b) => b.month.localeCompare(a.month));

        const totalLossVES = totalRevaluedVES - totalNominalVES;
        return {
            summary: {
                totalNominalVES, totalRevaluedVES, totalLossVES,
                lossPercentage: totalRevaluedVES > 0 ? (totalLossVES / totalRevaluedVES) * 100 : 0
            },
            methodBreakdown: Object.entries(methodBreakdown).map(([method, data]) => ({ method, ...data })),
            dailyData: Object.entries(dailyData).sort((a, b) => a[0].localeCompare(b[0]))
                .map(([date, data]) => ({ date: dayjs(date).format('DD/MM'), ...data })),
            monthlyHistory: finalMonthlyHistory
        };
    }

    async getWeeklyPerformance(currencyCode: string = 'VES', startDate?: string, endDate?: string) {
        const dateFilter: any = {};
        if (startDate || endDate) {
            if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
            if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
        } else {
            dateFilter.gte = dayjs().startOf('month').toDate();
        }

        const { currentRefRate, factor: crossRateFactor } = await this.getCrossRateFactor(currencyCode);

        const sales = await this.prisma.sale.findMany({
            where: { active: true, createdAt: dateFilter },
            select: { total: true, createdAt: true, exchangeRate: true }
        });

        // Initialize weekdays (0=Sunday, 1=Monday, ... 6=Saturday)
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const performance: Record<number, { day: string, total: number, count: number }> = {};

        for (let i = 0; i < 7; i++) {
            performance[i] = { day: dayNames[i], total: 0, count: 0 };
        }

        sales.forEach(sale => {
            const dayIndex = dayjs(sale.createdAt).day();
            const historicalRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                ? Number(sale.exchangeRate)
                : currentRefRate;

            const revaluedAmount = (Number(sale.total) / historicalRate) * crossRateFactor;
            performance[dayIndex].total += revaluedAmount;
            performance[dayIndex].count += 1;
        });

        const results = Object.values(performance);
        const totalSalesSum = results.reduce((sum, d) => sum + d.total, 0);
        const averageSales = totalSalesSum / 7;

        return results.map(d => {
            let status: 'HIGH' | 'AVERAGE' | 'LOW' = 'AVERAGE';
            if (d.total > averageSales * 1.2) status = 'HIGH';
            else if (d.total < averageSales * 0.8) status = 'LOW';

            return {
                ...d,
                status,
                percentage: totalSalesSum > 0 ? (d.total / totalSalesSum) * 100 : 0
            };
        });
    }

    async getMonthlyDailyPerformance(currencyCode: string = 'VES', startDate?: string, endDate?: string) {
        const dateFilter: any = {};
        if (startDate || endDate) {
            if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
            if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
        } else {
            dateFilter.gte = dayjs().startOf('month').toDate();
        }

        const { currentRefRate, factor: crossRateFactor } = await this.getCrossRateFactor(currencyCode);

        const sales = await this.prisma.sale.findMany({
            where: { active: true, createdAt: dateFilter },
            select: { total: true, createdAt: true, exchangeRate: true }
        });

        // Use dayjs to get the month and year of the filter
        const baseDate = startDate ? dayjs(startDate) : dayjs();
        const daysInMonth = baseDate.daysInMonth();

        const performance: Record<number, { day: number, total: number, count: number }> = {};
        for (let i = 1; i <= daysInMonth; i++) {
            performance[i] = { day: i, total: 0, count: 0 };
        }

        sales.forEach(sale => {
            const dayOfMonth = dayjs(sale.createdAt).date();
            if (performance[dayOfMonth]) {
                const historicalRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                    ? Number(sale.exchangeRate)
                    : currentRefRate;

                const revaluedAmount = (Number(sale.total) / historicalRate) * crossRateFactor;
                performance[dayOfMonth].total += revaluedAmount;
                performance[dayOfMonth].count += 1;
            }
        });

        const results = Object.values(performance);
        const activeDays = results.filter(d => d.total > 0).length || 1;
        const totalSalesSum = results.reduce((sum, d) => sum + d.total, 0);
        const averageSales = totalSalesSum / activeDays;

        return results.map(d => {
            let status: 'HIGH' | 'AVERAGE' | 'LOW' = 'AVERAGE';
            if (d.total > averageSales * 1.2) status = 'HIGH';
            else if (d.total < averageSales * 0.8) status = 'LOW';
            if (d.total === 0) status = 'LOW';

            return {
                ...d,
                status,
                percentage: totalSalesSum > 0 ? (d.total / totalSalesSum) * 100 : 0
            };
        });
    }
    async getExpenseStats(currencyCode: string = 'VES', startDate?: string, endDate?: string) {
        const dateFilter: any = {};

        if (startDate || endDate) {
            if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
            if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
        } else {
            // Default to current month
            dateFilter.gte = dayjs().startOf('month').toDate();
        }

        const targetCurrency = await this.prisma.currency.findUnique({ where: { code: currencyCode } });
        const targetRate = Number(targetCurrency?.exchangeRate || 1);
        const conversionRate = (currencyCode === 'VES') ? 1 : targetRate;

        // 1. Get Reference Currency Info for Cross-Rate logic (if needed for old expenses)
        const companySettings = await this.prisma.companySettings.findFirst({
            include: { preferredSecondaryCurrency: true }
        });
        const refCurrency = companySettings?.preferredSecondaryCurrency;
        const currentRefRate = Number(refCurrency?.exchangeRate || 1);

        let crossRateFactor = 1;
        if (currencyCode === 'VES') {
            crossRateFactor = currentRefRate;
        } else if (targetCurrency && refCurrency && targetCurrency.code !== refCurrency.code) {
            const tr = Number(targetCurrency.exchangeRate || 1);
            if (tr > 0) crossRateFactor = currentRefRate / tr;
        }

        // 2. Fetch Expenses
        const expenses = await this.prisma.expense.findMany({
            where: { date: dateFilter },
            select: {
                amount: true,
                exchangeRate: true,
                currencyCode: true,
                category: true,
                date: true,
                description: true
            }
        });

        const expensesByCategory: Record<string, number> = {};
        const dailyExpenses: Record<string, number> = {};
        let totalExpenses = 0;

        expenses.forEach(e => {
            const val = Number(e.amount);
            const eRate = Number(e.exchangeRate) || 1;
            const valInVES = e.currencyCode === 'VES' ? val : val * eRate;

            // Use historical rate usually for Expenses in other reports, but let's stick to consistent revaluation
            // Actually, in Finance Report, expenses are revalued using historical rate * crossRateFactor.
            const historicalRate = (eRate !== 1) ? eRate : currentRefRate;

            // Wait, to be consistent with "Real Utility" calculation in Finance Report:
            // monthlyOperationalExpenses += (amountInVES / historicalRate) * crossRateFactor;

            const expenseValueTarget = (valInVES / historicalRate) * crossRateFactor;

            totalExpenses += expenseValueTarget;

            // Group by Category
            expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + expenseValueTarget;

            // Group by Date
            const dateStr = dayjs(e.date).format('YYYY-MM-DD');
            dailyExpenses[dateStr] = (dailyExpenses[dateStr] || 0) + expenseValueTarget;
        });

        // 3. Fetch Total Sales for Comparison (Consistency with Finance Report)

        // A. Sales
        const sales = await this.prisma.sale.findMany({
            where: { active: true, createdAt: dateFilter },
            select: { total: true }
        });
        let totalSales = 0;
        sales.forEach(sale => {
            const nominal = Number(sale.total);
            // Standardize using conversionRate (Same as other reports)
            totalSales += (currencyCode === 'VES' ? nominal : nominal / conversionRate);
        });

        // B. Returns & Replacements
        const returns = await this.prisma.return.findMany({
            where: { status: 'COMPLETED', createdAt: dateFilter },
            include: { items: true, replacementItems: true }
        });

        returns.forEach(ret => {
            const retValVES = ret.items.reduce((s, i) => s + Number(i.total), 0);
            const retTarget = currencyCode === 'VES' ? retValVES : retValVES / conversionRate;
            totalSales -= retTarget;

            if (ret.returnType.startsWith('EXCHANGE')) {
                const repValVES = ret.replacementItems.reduce((s, i) => s + Number(i.total), 0);
                const repTarget = currencyCode === 'VES' ? repValVES : repValVES / conversionRate;
                totalSales += repTarget;
            }
        });

        return {
            totalSales: Number(totalSales.toFixed(2)),
            totalExpenses: Number(totalExpenses.toFixed(2)),
            expensesByCategory: Object.entries(expensesByCategory).map(([category, amount]) => ({
                category,
                amount: Number(amount.toFixed(2)),
                percentageOfSales: totalSales > 0 ? Number(((amount / totalSales) * 100).toFixed(2)) : 0
            })).sort((a, b) => b.amount - a.amount),
            dailyExpenses: Object.entries(dailyExpenses).map(([date, amount]) => ({
                date: dayjs(date).format('DD/MM'),
                amount: Number(amount.toFixed(2))
            }))
        };
    }
}
