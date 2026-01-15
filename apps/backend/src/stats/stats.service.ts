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

        // Today's sales
        const todaySales = await this.prisma.sale.aggregate({
            where: { createdAt: { gte: today }, active: true },
            _sum: { total: true },
        });

        // This month's sales
        const thisMonthSales = await this.prisma.sale.aggregate({
            where: { createdAt: { gte: monthStart }, active: true },
            _sum: { total: true },
        });

        // Last month's sales
        const lastMonthSales = await this.prisma.sale.aggregate({
            where: {
                createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
                active: true
            },
            _sum: { total: true },
        });

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

                salesTrend.push({
                    date: dayjs(date).format('DD/MM'),
                    sales: Number(daySales._sum.total || 0),
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

                salesTrend.push({
                    date: dayjs(date).format('MMM YY'),
                    sales: Number(monthSales._sum.total || 0),
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

                salesTrend.push({
                    date: current.format('MMM YY'),
                    sales: Number(monthSales._sum.total || 0),
                });

                current = current.add(1, 'month');
            }
        }

        return {
            todaySales: Number(todaySales._sum.total || 0),
            thisMonthSales: Number(thisMonthSales._sum.total || 0),
            lastMonthSales: Number(lastMonthSales._sum.total || 0),
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

        salesInRange.forEach((sale) => {
            const date = dayjs(sale.createdAt).format('YYYY-MM-DD');
            let saleTotal = Number(sale.total);

            // CONVERSION LOGIC
            if (currencyCode !== 'VES') {
                const rate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                    ? Number(sale.exchangeRate)
                    : currentRefRate;

                if (rate > 0) {
                    saleTotal = (saleTotal / rate) * crossRateFactor;
                }
            }

            totalSalesAmount += saleTotal;
            dailySales[date] = (dailySales[date] || 0) + saleTotal;

            // Calculate COGS (normalized to target currency)
            sale.items.forEach(item => {
                let itemCostInVES = Number(item.cost || 0);

                // Fallback for old sales where cost was not captured
                if (itemCostInVES === 0 && item.product) {
                    const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                    itemCostInVES = Number(item.product.costPrice || 0) * productRate;
                }

                let itemCostTarget = itemCostInVES * Number(item.quantity);

                if (currencyCode !== 'VES') {
                    const rate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                        ? Number(sale.exchangeRate)
                        : currentRefRate;

                    if (rate > 0) {
                        itemCostTarget = (itemCostTarget / rate) * crossRateFactor;
                    }
                }
                totalCostOfSales += itemCostTarget;
            });

            const paymentStr = sale.paymentMethod || 'CASH';
            const paymentMethods = paymentStr.split(', ');

            paymentMethods.forEach((payment) => {
                const parts = payment.trim().split(':');
                const method = parts[0].trim().toUpperCase();

                let amount = parts.length > 1 ? parseFloat(parts[1]) : Number(sale.total);

                // Convert using same sale rate logic
                if (currencyCode !== 'VES') {
                    const rate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                        ? Number(sale.exchangeRate)
                        : currentRefRate;
                    if (rate > 0) amount = (amount / rate) * crossRateFactor;
                }

                paymentBreakdown[method] = (paymentBreakdown[method] || 0) + amount;

                // Currency Type Categorization
                const isDivisa = method.startsWith('CURRENCY_') || method === 'ZELLE';
                const type = isDivisa ? 'FOREIGN' : 'LOCAL';
                currencyTypeBreakdown[type] += amount;
            });
        });

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
                const targetRate = Number(targetCurrency?.exchangeRate || 1);
                if (targetRate > 0) {
                    totalPurchasesAmount += (valInVES / targetRate);
                }
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
                const targetRate = Number(targetCurrency?.exchangeRate || 1);
                if (targetRate > 0) {
                    totalExpensesAmount += (valInVES / targetRate);
                }
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
                    const targetRate = Number(targetCurrency?.exchangeRate || 1);
                    if (targetRate > 0) {
                        returnedCostOfSales += (itemCostInVES / targetRate);
                    }
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
                const targetRate = Number(targetCurrency?.exchangeRate || 1);
                if (targetRate > 0) {
                    inventoryLossCost += (lossCostInVES / targetRate);
                }
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
            const saleRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                ? Number(sale.exchangeRate)
                : Number(targetCurrency?.exchangeRate || 1);

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
                    const rate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                        ? Number(sale.exchangeRate)
                        : currentRefRate;

                    if (rate > 0) {
                        cost = (cost / rate) * crossRateFactor;
                        revenue = (revenue / rate) * crossRateFactor;
                    }
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
                const targetRate = Number(targetCurrency?.exchangeRate || 1);
                if (targetRate > 0) {
                    totalPurchases += (valInVES / targetRate);
                }
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
                const targetRate = Number(targetCurrency?.exchangeRate || 1);
                if (targetRate > 0) {
                    totalExpenses += (valInVES / targetRate);
                }
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
        completedReturns.forEach(ret => {
            ret.items.forEach(item => {
                const productRate = item.product.currency?.isPrimary ? 1 : Number(item.product.currency?.exchangeRate || 1);
                let itemCostInVES = Number(item.product.costPrice || 0) * productRate * Number(item.quantity);

                if (currencyCode !== 'VES') {
                    const targetRate = Number(targetCurrency?.exchangeRate || 1);
                    if (targetRate > 0) {
                        returnedCOGS += (itemCostInVES / targetRate);
                    }
                } else {
                    returnedCOGS += itemCostInVES;
                }
            });
        });

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
                const targetRate = Number(targetCurrency?.exchangeRate || 1);
                if (targetRate > 0) {
                    inventoryLossCOGS += (lossCostInVES / targetRate);
                }
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
                    let amountInRef = amountInVES / rate;
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
            monthlyReturns.forEach(ret => {
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
