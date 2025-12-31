import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import dayjs from 'dayjs';

@Injectable()
export class StatsService {
    constructor(private prisma: PrismaService) { }

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

    async getInventoryReport() {
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
            const productValue = p.stock * costInPrimary;

            existing.units += p.stock;
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

    async getFinanceReport() {
        const monthStart = dayjs().startOf('month').toDate();

        // Monthly sales
        const monthlySales = await this.prisma.sale.findMany({
            where: { createdAt: { gte: monthStart } },
            select: {
                total: true,
                paymentMethod: true,
                createdAt: true,
            },
        });

        // Payment methods breakdown - properly parse multi-payment sales
        // Format can be: "CASH" or "CASH:600, DEBIT:300, TRANSFER:300"
        const paymentBreakdown: Record<string, number> = {};

        monthlySales.forEach((sale) => {
            const paymentStr = sale.paymentMethod || 'CASH';

            // Split by comma to handle multi-payment sales
            const paymentMethods = paymentStr.split(', ');

            paymentMethods.forEach((payment) => {
                // Extract method and amount if format is "METHOD:amount"
                const parts = payment.trim().split(':');
                const method = parts[0].trim();
                const amount = parts.length > 1 ? parseFloat(parts[1]) : Number(sale.total);

                paymentBreakdown[method] = (paymentBreakdown[method] || 0) + amount;
            });
        });

        // Monthly purchases
        const monthlyPurchases = await this.prisma.purchase.aggregate({
            where: { createdAt: { gte: monthStart } },
            _sum: { total: true },
        });

        // Daily sales this month
        const dailySales = monthlySales.reduce(
            (acc, sale) => {
                const date = dayjs(sale.createdAt).format('YYYY-MM-DD');
                acc[date] = (acc[date] || 0) + Number(sale.total);
                return acc;
            },
            {} as Record<string, number>,
        );

        return {
            monthlySalesTotal: monthlySales.reduce(
                (sum, s) => sum + Number(s.total),
                0,
            ),
            monthlyPurchasesTotal: Number(monthlyPurchases._sum.total || 0),
            paymentMethodsBreakdown: Object.entries(paymentBreakdown).map(
                ([method, amount]) => ({
                    method,
                    amount,
                }),
            ),
            dailySalesData: Object.entries(dailySales).map(
                ([date, amount]) => ({
                    date: dayjs(date).format('DD/MM'),
                    amount,
                }),
            ),
        };
    }

    async getBalanceReport(currencyCode: string = 'VES') {
        const balanceData: {
            month: string;
            income: number;
            expenses: number;
            purchases: number;
            total: number;
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
                select: { total: true, exchangeRate: true }
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

            // Calculate Income
            sales.forEach(sale => {
                let amount = Number(sale.total);
                if (currencyCode !== 'VES') {
                    // 1. Convert VES to Historical Reference Currency (USD)
                    // Fallback to current system rate if historical is 1.0 (error case)
                    const historicalRate = (Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1)
                        ? Number(sale.exchangeRate)
                        : currentRefRate;

                    let amountInRef = amount / historicalRate;

                    // 2. Convert Reference to Target (if different) using current cross-rate
                    // If Target is Ref (USD), factor is 1. If Target is EUR, factor is ~0.9.
                    amount = amountInRef * crossRateFactor;
                }
                monthlyIncome += amount;
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

            // Metrics
            const totalExpenses = monthlyOperationalExpenses + monthlyPurchases;
            const profit = monthlyIncome - totalExpenses;
            // Profit Margin % = (Net Income / Revenue) * 100
            const profitMargin = monthlyIncome > 0 ? (profit / monthlyIncome) * 100 : 0;
            // Operating Cost Ratio % = (Expenses / Revenue) * 100
            const operatingCostRatio = monthlyIncome > 0 ? (monthlyOperationalExpenses / monthlyIncome) * 100 : 0;

            balanceData.push({
                month: currentMonth.format('MMMM'), // Just Month Name
                income: Number(monthlyIncome.toFixed(2)),
                expenses: Number(monthlyOperationalExpenses.toFixed(2)),
                purchases: Number(monthlyPurchases.toFixed(2)),
                total: Number(profit.toFixed(2)),
                profitMargin: Number(profitMargin.toFixed(1)),
                operatingCostRatio: Number(operatingCostRatio.toFixed(1))
            });
        }

        return balanceData;
    }
}
