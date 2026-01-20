import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessContext } from './interfaces/ai.interfaces';
import dayjs from 'dayjs';

@Injectable()
export class ContextBuilderService {
    constructor(private prisma: PrismaService) { }

    async buildContext(period: 'today' | 'week' | 'month' = 'today'): Promise<BusinessContext> {
        const now = dayjs();
        const today = now.startOf('day').toDate();
        const yesterday = now.subtract(1, 'day').startOf('day').toDate();
        const yesterdayEnd = now.subtract(1, 'day').endOf('day').toDate();
        const monthStart = now.startOf('month').toDate();
        const lastMonthStart = now.subtract(1, 'month').startOf('month').toDate();
        const lastMonthEnd = now.subtract(1, 'month').endOf('month').toDate();

        // Sales Data
        const [todaySales, yesterdaySales, thisMonthSales, lastMonthSales] = await Promise.all([
            this.prisma.sale.aggregate({
                where: { createdAt: { gte: today }, active: true },
                _sum: { total: true },
            }),
            this.prisma.sale.aggregate({
                where: { createdAt: { gte: yesterday, lte: yesterdayEnd }, active: true },
                _sum: { total: true },
            }),
            this.prisma.sale.aggregate({
                where: { createdAt: { gte: monthStart }, active: true },
                _sum: { total: true },
            }),
            this.prisma.sale.aggregate({
                where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, active: true },
                _sum: { total: true },
            }),
        ]);

        const todayTotal = Number(todaySales._sum.total || 0);
        const yesterdayTotal = Number(yesterdaySales._sum.total || 0);
        const thisMonthTotal = Number(thisMonthSales._sum.total || 0);
        const lastMonthTotal = Number(lastMonthSales._sum.total || 0);

        const percentChange = yesterdayTotal > 0
            ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
            : 0;

        const trend: 'up' | 'down' | 'stable' =
            percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'stable';

        // Inventory Data
        const [products, criticalStockProducts, topProducts] = await Promise.all([
            this.prisma.product.count({ where: { active: true } }),
            this.prisma.product.findMany({
                where: {
                    active: true,
                    stock: { lt: 10 }, // Stock below 10
                },
                select: { name: true, sku: true, stock: true },
                take: 10,
            }),
            this.prisma.saleItem.groupBy({
                by: ['productId'],
                _sum: { total: true, quantity: true },
                where: { sale: { createdAt: { gte: monthStart }, active: true } },
                orderBy: { _sum: { total: 'desc' } },
                take: 5,
            }),
        ]);

        const topProductsData = await Promise.all(
            topProducts.map(async (item) => {
                const product = await this.prisma.product.findUnique({
                    where: { id: item.productId },
                    select: { name: true },
                });
                return {
                    name: product?.name || 'Unknown',
                    revenue: Number(item._sum.total || 0),
                    units: Number(item._sum.quantity || 0),
                };
            })
        );

        // Calculate total inventory value
        const allProducts = await this.prisma.product.findMany({
            where: { active: true },
            select: { stock: true, costPrice: true, currency: true },
        });

        const totalInventoryValue = allProducts.reduce((sum, p) => {
            const rate = p.currency?.isPrimary ? 1 : Number(p.currency?.exchangeRate || 1);
            return sum + (Number(p.stock) * Number(p.costPrice) * rate);
        }, 0);

        // Financial Data
        const [cashSession, accountsReceivable, accountsPayable, expenses] = await Promise.all([
            this.prisma.cashSession.findFirst({
                where: { status: 'OPEN' },
                select: { actualBalance: true, openingBalance: true },
            }),
            this.prisma.sale.aggregate({
                where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] }, active: true },
                _sum: { total: true },
            }),
            this.prisma.purchase.aggregate({
                where: { paymentStatus: { in: ['PENDING', 'PARTIAL'] } },
                _sum: { total: true },
            }),
            this.prisma.expense.aggregate({
                where: { date: { gte: monthStart } },
                _sum: { amount: true },
            }),
        ]);

        const cashBalance = Number(cashSession?.actualBalance || cashSession?.openingBalance || 0);
        const receivable = Number(accountsReceivable._sum?.total || 0);
        const payable = Number(accountsPayable._sum?.total || 0);
        const monthlyExpenses = Number(expenses._sum?.amount || 0);

        // Calculate profit (simplified)
        const profit = thisMonthTotal - monthlyExpenses;
        const profitMargin = thisMonthTotal > 0 ? (profit / thisMonthTotal) * 100 : 0;

        // Generate Alerts
        const alerts: BusinessContext['alerts'] = [];

        if (criticalStockProducts.length > 0) {
            alerts.push({
                type: 'stock',
                message: `${criticalStockProducts.length} productos con stock crítico`,
                severity: 'high',
            });
        }

        if (payable > cashBalance + receivable) {
            alerts.push({
                type: 'payment',
                message: 'Cuentas por pagar exceden liquidez disponible',
                severity: 'high',
            });
        }

        if (trend === 'down') {
            alerts.push({
                type: 'sales',
                message: 'Ventas en tendencia bajista',
                severity: 'medium',
            });
        }

        return {
            timestamp: now.toISOString(),
            period,
            sales: {
                today: todayTotal,
                yesterday: yesterdayTotal,
                thisMonth: thisMonthTotal,
                lastMonth: lastMonthTotal,
                trend,
                percentChange,
            },
            inventory: {
                totalValue: totalInventoryValue,
                totalProducts: products,
                criticalStock: criticalStockProducts.map(p => ({
                    name: p.name,
                    sku: p.sku,
                    stock: Number(p.stock),
                    minStock: 10, // Simplified
                })),
                topProducts: topProductsData,
            },
            finances: {
                cashBalance,
                accountsReceivable: receivable,
                accountsPayable: payable,
                profit,
                profitMargin,
            },
            alerts,
        };
    }
}
