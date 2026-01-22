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

    async getDashboardStats(range: string = '7days') {
        const today = dayjs().startOf('day').toDate();
        const monthStart = dayjs().startOf('month').toDate();
        const lastMonthStart = dayjs().subtract(1, 'month').startOf('month').toDate();
        const lastMonthEnd = dayjs().subtract(1, 'month').endOf('month').toDate();

        // Today's sales (Net)
        const todaySales = await this.prisma.sale.aggregate({
            where: { createdAt: { gte: today }, active: true },
            _sum: { total: true },
        });

        const todayReturns = await this.prisma.return.aggregate({
            where: { createdAt: { gte: today }, status: 'COMPLETED' },
            _sum: { refundAmount: true },
        });

        // This month's sales (Net)
        const thisMonthSales = await this.prisma.sale.aggregate({
            where: { createdAt: { gte: monthStart }, active: true },
            _sum: { total: true },
        });

        const thisMonthReturns = await this.prisma.return.aggregate({
            where: { createdAt: { gte: monthStart }, status: 'COMPLETED' },
            _sum: { refundAmount: true },
        });

        // Last month's sales (Net)
        const lastMonthSales = await this.prisma.sale.aggregate({
            where: {
                createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
                active: true
            },
            _sum: { total: true },
        });

        const lastMonthReturns = await this.prisma.return.aggregate({
            where: {
                createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
                status: 'COMPLETED'
            },
            _sum: { refundAmount: true },
        });
        // Calculate replacement items total (Add back to sales)
        const todayReplacements = await this.prisma.return.findMany({
            where: { createdAt: { gte: today }, status: 'COMPLETED', returnType: 'EXCHANGE_DIFFERENT' },
            include: { replacementItems: true }
        });
        const todayReplacementTotal = todayReplacements.reduce((sum, r) => sum + r.replacementItems.reduce((s, i) => s + Number(i.total), 0), 0);

        const thisMonthReplacements = await this.prisma.return.findMany({
            where: { createdAt: { gte: monthStart }, status: 'COMPLETED', returnType: 'EXCHANGE_DIFFERENT' },
            include: { replacementItems: true }
        });
        const thisMonthReplacementTotal = thisMonthReplacements.reduce((sum, r) => sum + r.replacementItems.reduce((s, i) => s + Number(i.total), 0), 0);

        const lastMonthReplacements = await this.prisma.return.findMany({
            where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: 'COMPLETED', returnType: 'EXCHANGE_DIFFERENT' },
            include: { replacementItems: true }
        });
        const lastMonthReplacementTotal = lastMonthReplacements.reduce((sum, r) => sum + r.replacementItems.reduce((s, i) => s + Number(i.total), 0), 0);

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

                const daySales = await this.prisma.sale.aggregate({
                    where: {
                        createdAt: { gte: date, lte: nextDate },
                        active: true
                    },
                    _sum: { total: true },
                });

                const dayReturns = await this.prisma.return.aggregate({
                    where: {
                        createdAt: { gte: date, lte: nextDate },
                        status: 'COMPLETED'
                    },
                    _sum: { refundAmount: true }
                });

                const dayReplacements = await this.prisma.return.findMany({
                    where: { createdAt: { gte: date, lte: nextDate }, status: 'COMPLETED', returnType: 'EXCHANGE_DIFFERENT' },
                    include: { replacementItems: true }
                });
                const dayReplacementTotal = dayReplacements.reduce((sum, r) => sum + r.replacementItems.reduce((s, i) => s + Number(i.total), 0), 0);

                salesTrend.push({
                    date: dayjs(date).format('DD/MM'),
                    sales: (Number(daySales._sum.total || 0) - Number(dayReturns._sum.refundAmount || 0)) + dayReplacementTotal,
                });
            }
        } else if (range === '1year') {
            for (let i = 11; i >= 0; i--) {
                const date = dayjs().subtract(i, 'month').startOf('month').toDate();
                const nextDate = dayjs().subtract(i, 'month').endOf('month').toDate();

                const monthSales = await this.prisma.sale.aggregate({
                    where: {
                        createdAt: { gte: date, lte: nextDate },
                        active: true
                    },
                    _sum: { total: true },
                });

                const monthReturns = await this.prisma.return.aggregate({
                    where: {
                        createdAt: { gte: date, lte: nextDate },
                        status: 'COMPLETED'
                    },
                    _sum: { refundAmount: true }
                });

                salesTrend.push({
                    date: dayjs(date).format('MMM YY'),
                    sales: Number(monthSales._sum.total || 0) - Number(monthReturns._sum.refundAmount || 0),
                });
            }
        } else if (range === 'all') {
            // Get first sale date
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

                const monthSales = await this.prisma.sale.aggregate({
                    where: {
                        createdAt: { gte: start, lte: end },
                        active: true
                    },
                    _sum: { total: true },
                });

                const monthReturns = await this.prisma.return.aggregate({
                    where: {
                        createdAt: { gte: start, lte: end },
                        status: 'COMPLETED'
                    },
                    _sum: { refundAmount: true }
                });

                salesTrend.push({
                    date: current.format('MMM YY'),
                    sales: Number(monthSales._sum.total || 0) - Number(monthReturns._sum.refundAmount || 0),
                });

                current = current.add(1, 'month');
            }
        }

        return {
            todaySales: (Number(todaySales._sum.total || 0) - Number(todayReturns._sum.refundAmount || 0)) + todayReplacementTotal,
            thisMonthSales: (Number(thisMonthSales._sum.total || 0) - Number(thisMonthReturns._sum.refundAmount || 0)) + thisMonthReplacementTotal,
            lastMonthSales: (Number(lastMonthSales._sum.total || 0) - Number(lastMonthReturns._sum.refundAmount || 0)) + lastMonthReplacementTotal,
            topProducts: topProductsData,
            criticalStock,
            totalProducts,
            cashBalance: activeSession ? Number(activeSession.openingBalance) : 0,
            salesTrend,
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

        return {
            stockByDepartment: stockByDept,
            lowStockProducts: lowStock,
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
        if (targetCurrency && refCurrency && targetCurrency.code !== refCurrency.code && currencyCode !== 'VES') {
            const targetRate = Number(targetCurrency.exchangeRate || 1);
            if (targetRate > 0) {
                crossRateFactor = currentRefRate / targetRate;
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
        let totalCostOfSales = 0;

        const targetRate = Number(targetCurrency?.exchangeRate || 1);

        salesInRange.forEach((sale) => {
            const date = dayjs(sale.createdAt).format('YYYY-MM-DD');
            const saleNominalTotal = Number(sale.total);
            const saleRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                ? Number(sale.exchangeRate)
                : currentRefRate;

            // 1. Normalize saleTotal to VES
            // Como Sale no tiene currencyCode, asumimos que total es en VES
            // Si la tasa es > 1, es probable que sea una venta referenciada en divisa, 
            // pero el total guardado en BD suele ser en VES.
            // SIN EMBARGO, si el usuario dice que "UDT 2.00" aparece en el dashboard,
            // significa que para ALGUNOS casos el total NO es VES.
            // Pero sin campo currencyCode, la única forma de saberlo es por el exchangeRate o paymentMethod.
            // Revisando lógica de Invoice: Invoice SI tiene currencyCode.
            // Revisando lógica de Sale: Sale no.
            // Asumiremos que sale.total ESTÁ EN VES.
            let saleTotalVES = saleNominalTotal;

            // 2. Convert to Target Currency for the report
            // Use historical rate for conversion to Ref (USD), then to Target
            const historicalRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                ? Number(sale.exchangeRate)
                : currentRefRate;

            const saleTotalTarget = (currencyCode === 'VES')
                ? saleTotalVES
                : (saleTotalVES / currentRefRate) * crossRateFactor;

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
                const itemTotalCostTarget = (currencyCode === 'VES')
                    ? itemTotalCostVES
                    : (itemTotalCostVES / currentRefRate) * crossRateFactor;

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

                // 1. Convert to VES (Base)
                let amountInVES = rawAmount;

                // CRITICAL FIX: Only multiply by rate if the amount is explicitly foreign (from the split string).
                // SANITY CHECK: If converting the amount results in a value absurdly higher than the total sale (e.g. > 1.5x),
                // then assume the rawAmount is ALREADY in VES (e.g. frontend sent the calculated amount).
                if (isForeignMethod && isExplicitForeignAmount) {
                    const effectiveRate = paymentSpecificRate || saleRate;
                    const proposedAmountInVES = rawAmount * effectiveRate;

                    // Allow for some excess (tips, change), but if it's > 1.5x the total sale, it's likely a double-conversion error.
                    // Exception: If saleNominalTotal is 0 (shouldn't happen but safe guard)
                    if (saleNominalTotal > 0 && proposedAmountInVES > (saleNominalTotal * 1.5)) {
                        // Heuristic: The conversion is too big. Assume rawAmount is already VES.
                        amountInVES = rawAmount;
                    } else {
                        amountInVES = proposedAmountInVES;
                    }
                }

                // 2. Convert from VES to Target Currency using historical rate
                const targetRateForPayment = (paymentSpecificRate || saleRate);
                const amountInTarget = (currencyCode === 'VES')
                    ? amountInVES
                    : (amountInVES / currentRefRate) * crossRateFactor;

                paymentBreakdown[method] = (paymentBreakdown[method] || 0) + amountInTarget;

                // Currency Type Categorization
                const isDivisa = isForeignMethod || method.includes('_UDT') || method.includes('_USD');
                const type = isDivisa ? 'FOREIGN' : 'LOCAL';
                currencyTypeBreakdown[type] += amountInTarget;
            });
        });

        // 3. Subtract Returns (Notes of Credit) from Revenue
        const returnsInRange = await this.prisma.return.findMany({
            where: {
                status: 'COMPLETED',
                createdAt: dateFilter
            },
            select: {
                refundAmount: true,
                createdAt: true
            }
        });

        let totalReturnsAmount = 0;
        returnsInRange.forEach(ret => {
            const refundVES = Number(ret.refundAmount || 0);
            // Returns often don't have historical rate attached directly in the model, 
            // but we can use currentRefRate as fallback or try to relate to sale.
            // For now, consistent with getBalanceReport, we use currentRefRate for returns
            // unless we want to fetch the original sale rate (more complex).
            const refundTarget = (currencyCode === 'VES')
                ? refundVES
                : (refundVES / currentRefRate) * crossRateFactor;
            totalReturnsAmount += refundTarget;

            const date = dayjs(ret.createdAt).format('YYYY-MM-DD');
            if (dailySales[date]) {
                dailySales[date] -= refundTarget;
            }
        });

        // Calculate replacement items total (Add back to sales for exchanges)
        const replacementsInRange = await this.prisma.return.findMany({
            where: {
                createdAt: dateFilter,
                status: 'COMPLETED',
                returnType: 'EXCHANGE_DIFFERENT'
            },
            include: { replacementItems: true }
        });

        let totalReplacementAmount = 0;
        replacementsInRange.forEach(ret => {
            const replacementTotalVES = ret.replacementItems.reduce((sum, item) => sum + Number(item.total), 0);
            const replacementTotalTarget = (currencyCode === 'VES')
                ? replacementTotalVES
                : (replacementTotalVES / currentRefRate) * crossRateFactor;
            totalReplacementAmount += replacementTotalTarget;

            const date = dayjs(ret.createdAt).format('YYYY-MM-DD');
            if (dailySales[date]) {
                dailySales[date] += replacementTotalTarget;
            }
        });

        // Net Sales (subtract returns, add back replacements)
        totalSalesAmount = totalSalesAmount - totalReturnsAmount + totalReplacementAmount;

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

            if (currencyCode === 'VES') {
                totalPurchasesAmount += valInVES;
            } else {
                totalPurchasesAmount += (valInVES / currentRefRate) * crossRateFactor;
            }
        });

        let totalExpensesAmount = 0;
        expensesInRangeList.forEach(e => {
            let val = Number(e.amount);
            const eRate = Number(e.exchangeRate) || 1;
            const valInVES = e.currencyCode === 'VES' ? val : val * eRate;

            if (currencyCode === 'VES') {
                totalExpensesAmount += valInVES;
            } else {
                totalExpensesAmount += (valInVES / currentRefRate) * crossRateFactor;
            }
        });

        // Subtract returned sellable products from totalCostOfSales
        const completedReturns = await this.prisma.return.findMany({
            where: {
                status: 'COMPLETED',
                updatedAt: dateFilter,
                reason: { in: this.SELLABLE_RETURN_REASONS }
            },
            include: {
                items: {
                    include: {
                        product: { include: { currency: true } }
                    }
                }
            }
        });

        let returnedCostOfSales = 0;
        completedReturns.forEach(ret => {
            ret.items.forEach(item => {
                const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                let itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);

                if (currencyCode !== 'VES') {
                    returnedCostOfSales += (itemCostInVES / currentRefRate) * crossRateFactor;
                } else {
                    returnedCostOfSales += itemCostInVES;
                }
            });
        });

        let adjustedCostOfSales = totalCostOfSales - returnedCostOfSales;

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
            monthlySalesTotal: totalSalesAmount,
            monthlyPurchasesTotal: totalPurchasesAmount,
            totalCostOfSales: adjustedCostOfSales,
            returnedCostOfSales,
            inventoryLossCost,
            totalExpenses: totalExpensesAmount,
            paymentMethodsBreakdown: Object.entries(paymentBreakdown).map(
                ([method, amount]) => ({
                    method,
                    amount,
                }),
            ),
            currencyTypeBreakdown, // Added new breakdown
            dailySalesData: Object.entries(dailySales).map(
                ([date, amount]) => ({
                    date: dayjs(date).format('DD/MM'),
                    amount,
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
        if (targetCurrency && refCurrency && targetCurrency.code !== refCurrency.code && currencyCode !== 'VES') {
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

        const productBreakdown: Record<string, {
            name: string;
            sku: string | null;
            category: string;
            quantity: number;
            totalCost: number;
            totalRevenue: number;
        }> = {};

        let totalSales = 0;
        let totalCOGS = 0;

        sales.forEach(sale => {
            const historicalRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                ? Number(sale.exchangeRate)
                : currentRefRate;

            sale.items.forEach(item => {
                let itemCostInVES = Number(item.cost || 0);

                // Fallback for old sales where cost was not captured
                if (itemCostInVES === 0 && item.product) {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    itemCostInVES = Number(item.product.costPrice || 0) * productRate;
                }

                let cost = itemCostInVES * Number(item.quantity);
                let revenue = Number(item.total);

                if (currencyCode !== 'VES') {
                    cost = (cost / currentRefRate) * crossRateFactor;
                    revenue = (revenue / currentRefRate) * crossRateFactor;
                }

                totalSales += revenue;
                totalCOGS += cost;

                const pid = item.product.id;
                if (!productBreakdown[pid]) {
                    productBreakdown[pid] = {
                        name: item.product.name,
                        sku: item.product.sku,
                        category: item.product.category?.name || 'S/C',
                        quantity: 0,
                        totalCost: 0,
                        totalRevenue: 0
                    };
                }

                productBreakdown[pid].quantity += Number(item.quantity);
                productBreakdown[pid].totalCost += cost;
                productBreakdown[pid].totalRevenue += revenue;
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

            if (currencyCode === 'VES') {
                totalPurchases += valInVES;
            } else {
                totalPurchases += (valInVES / currentRefRate) * crossRateFactor;
            }
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

            if (currencyCode === 'VES') {
                totalExpenses += valInVES;
            } else {
                totalExpenses += (valInVES / currentRefRate) * crossRateFactor;
            }
        });

        // Calculate returned COGS (products that went back to stock)
        const completedReturns = await this.prisma.return.findMany({
            where: {
                status: 'COMPLETED',
                updatedAt: dateFilter,
                reason: { in: this.SELLABLE_RETURN_REASONS }
            },
            include: {
                items: {
                    include: {
                        product: {
                            include: { currency: true }
                        }
                    }
                }
            }
        });

        let returnedCOGS = 0;
        let totalRefunds = 0;

        completedReturns.forEach(ret => {
            // Deduct from Revenue
            const refundVES = Number(ret.refundAmount || 0);
            if (currencyCode !== 'VES') {
                totalRefunds += (refundVES / currentRefRate) * crossRateFactor;
            } else {
                totalRefunds += refundVES;
            }

            ret.items.forEach(item => {
                const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                let itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);

                if (currencyCode !== 'VES') {
                    returnedCOGS += (itemCostInVES / currentRefRate) * crossRateFactor;
                } else {
                    returnedCOGS += itemCostInVES;
                }
            });
        });

        // Calculate replacement items total (Add back to sales for exchanges)
        const replacementsInRange = await this.prisma.return.findMany({
            where: {
                createdAt: dateFilter,
                status: 'COMPLETED',
                returnType: 'EXCHANGE_DIFFERENT'
            },
            include: { replacementItems: true }
        });

        let totalReplacementAmount = 0;
        replacementsInRange.forEach(ret => {
            const replacementTotalVES = ret.replacementItems.reduce((sum, item) => sum + Number(item.total), 0);

            if (currencyCode !== 'VES') {
                totalReplacementAmount += (replacementTotalVES / currentRefRate) * crossRateFactor;
            } else {
                totalReplacementAmount += replacementTotalVES;
            }
        });

        // Net Sales (subtract refunds, add back replacements)
        totalSales = totalSales - totalRefunds + totalReplacementAmount;

        // Adjusted COGS = Sales COGS - Returned COGS
        let adjustedCOGS = totalCOGS - returnedCOGS;

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

            if (currencyCode !== 'VES') {
                inventoryLossCOGS += (lossCostInVES / currentRefRate) * crossRateFactor;
            } else {
                inventoryLossCOGS += lossCostInVES;
            }
        });

        // Final COGS = Sales COGS - Returns + Inventory Losses
        adjustedCOGS += inventoryLossCOGS;

        return {
            totalSales,
            totalCOGS: adjustedCOGS,
            returnedCOGS,
            inventoryLossCOGS,
            totalPurchases,
            totalExpenses,
            products: Object.values(productBreakdown).sort((a, b) => b.totalCost - a.totalCost)
        };
    }

    async getBalanceReport(currencyCode: string = 'VES') {
        const balanceData: {
            month: string;
            income: number;
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

        if (targetCurrency && refCurrency && targetCurrency.code !== refCurrency.code) {
            const refRate = Number(refCurrency.exchangeRate || 0);
            const targetRate = Number(targetCurrency.exchangeRate || 1);
            if (targetRate > 0) {
                crossRateFactor = refRate / targetRate;
            }
        }

        for (let i = 11; i >= 0; i--) {
            const currentMonth = now.subtract(i, 'month');
            const start = currentMonth.startOf('month').toDate();
            const end = currentMonth.endOf('month').toDate();

            // 1. SALES (Ingresos)
            const sales = await this.prisma.sale.findMany({
                where: { createdAt: { gte: start, lte: end }, active: true },
                include: {
                    items: {
                        include: {
                            product: {
                                include: {
                                    currency: true
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

                if (currencyCode !== 'VES') {
                    const historicalRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                        ? Number(sale.exchangeRate)
                        : currentRefRate;

                    monthlyIncome += (amount / historicalRate) * crossRateFactor;
                    monthlyCOGS += (totalCostVES / historicalRate) * crossRateFactor;
                } else {
                    monthlyIncome += amount;
                    monthlyCOGS += totalCostVES;
                }
            });

            // Calculate Expenses (Purchases + Expenses)
            purchases.forEach(p => {
                let amount = Number(p.total);
                // If purchase was in Foreign Currency but we want VES, multiply.
                // If purchase was in VES but we want Foreign, divide.
                // Simplified assumption: System stores values in Base Currency (VES) or normalization happens.
                // However, Purchase model has currencyCode. Let's handle it:

                const rate = Number(p.exchangeRate) || 1;

                // First normalize to System Currency (VES)
                let amountInVES = p.currencyCode === 'VES' ? amount : amount * rate;

                // Then convert to Target Currency
                if (currencyCode === 'VES') {
                    monthlyPurchases += amountInVES;
                } else {
                    // Fallback to current system rate if historical is 1.0
                    const historicalRate = (Number(p.exchangeRate) && Number(p.exchangeRate) !== 1)
                        ? Number(p.exchangeRate)
                        : currentRefRate;

                    let amountInRef = amountInVES / historicalRate;

                    monthlyPurchases += (amountInRef * crossRateFactor);
                }
            });

            expenses.forEach(e => {
                const amount = Number(e.amount);
                const rate = Number(e.exchangeRate) || 1;

                let amountInVES = e.currencyCode === 'VES' ? amount : amount * rate;

                if (currencyCode === 'VES') {
                    monthlyOperationalExpenses += amountInVES;
                } else {
                    const historicalRate = (rate !== 1) ? rate : currentRefRate;
                    let amountInRef = amountInVES / historicalRate;
                    monthlyOperationalExpenses += (amountInRef * crossRateFactor);
                }
            });

            // Subtract returned sellable products from monthlyCOGS
            const monthlyReturns = await this.prisma.return.findMany({
                where: {
                    status: 'COMPLETED',
                    updatedAt: { gte: start, lte: end },
                    reason: { in: this.SELLABLE_RETURN_REASONS }
                },
                include: {
                    items: {
                        include: {
                            product: { include: { currency: true } }
                        }
                    }
                }
            });

            let monthlyReturnedCOGS = 0;
            let monthlyRefoundedAmount = 0;

            monthlyReturns.forEach(ret => {
                // Calculate Refund Amount to subtract from Income
                const refundAmount = Number(ret.refundAmount || 0);
                if (refundAmount > 0) {
                    if (currencyCode !== 'VES') {
                        // Normalize to Ref Currency (which is what monthlyIncome uses here)
                        // refundAmount (VES) / currentRefRate = refundAmount (Ref)
                        // Then * crossRateFactor to get Target
                        monthlyRefoundedAmount += (refundAmount / currentRefRate) * crossRateFactor;
                    } else {
                        monthlyRefoundedAmount += refundAmount;
                    }
                }

                ret.items.forEach(item => {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    let itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);

                    if (currencyCode !== 'VES') {
                        monthlyReturnedCOGS += (itemCostInVES / currentRefRate) * crossRateFactor;
                    } else {
                        monthlyReturnedCOGS += itemCostInVES;
                    }
                });
            });

            // Calculate replacement items total (Add back to income for exchanges)
            const monthlyReplacements = await this.prisma.return.findMany({
                where: {
                    createdAt: { gte: start, lte: end },
                    status: 'COMPLETED',
                    returnType: 'EXCHANGE_DIFFERENT'
                },
                include: { replacementItems: true }
            });

            let monthlyReplacementAmount = 0;
            monthlyReplacements.forEach(ret => {
                const replacementTotalVES = ret.replacementItems.reduce((sum, item) => sum + Number(item.total), 0);

                if (currencyCode !== 'VES') {
                    monthlyReplacementAmount += (replacementTotalVES / currentRefRate) * crossRateFactor;
                } else {
                    monthlyReplacementAmount += replacementTotalVES;
                }
            });

            // Deduct refunds from Income, add back replacements
            monthlyIncome = monthlyIncome - monthlyRefoundedAmount + monthlyReplacementAmount;

            // Adjusted COGS = COGS - Returns
            let adjustedMonthlyCOGS = monthlyCOGS - monthlyReturnedCOGS;

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

                if (currencyCode !== 'VES') {
                    monthlyInventoryLossCOGS += (lossCostInVES / currentRefRate) * crossRateFactor;
                } else {
                    monthlyInventoryLossCOGS += lossCostInVES;
                }
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
}
