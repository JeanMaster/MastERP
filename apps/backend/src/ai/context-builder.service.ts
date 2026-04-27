import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessContext } from './interfaces/ai.interfaces';
import { Decimal } from '@prisma/client/runtime/library';
import dayjs from 'dayjs';

@Injectable()
export class ContextBuilderService {
  private readonly logger = new Logger(ContextBuilderService.name);
  constructor(private prisma: PrismaService) {}

  async buildContext(
    period: 'today' | 'week' | 'month' = 'today',
  ): Promise<BusinessContext> {
    this.logger.log(
      `Building normalized business context (USD) for period: ${period}`,
    );
    const now = dayjs();
    const today = now.startOf('day').toDate();
    const yesterday = now.subtract(1, 'day').startOf('day').toDate();
    const yesterdayEnd = now.subtract(1, 'day').endOf('day').toDate();
    const monthStart = now.startOf('month').toDate();
    const lastMonthStart = now.subtract(1, 'month').startOf('month').toDate();
    const lastMonthEnd = now.subtract(1, 'month').endOf('month').toDate();

    // 0. Fetch Currencies for Normalization
    const currencies = await this.prisma.currency.findMany({
      where: { active: true },
      select: { code: true, exchangeRate: true, isPrimary: true },
    });

    const primaryCurrency = currencies.find((c) => c.isPrimary);
    const usdCurrency = currencies.find((c) => c.code === 'USD');
    const usdRate = usdCurrency ? Number(usdCurrency.exchangeRate) : 1;

    // Helper to convert any amount with its exchangeRate to USD
    const toUSD = (
      amount: number | Decimal,
      rateRelToPrimary: number | Decimal,
      currencyCode?: string,
    ) => {
      if (usdRate <= 0) return Number(amount); // Safety fallback

      // 1. If it's already USD, return it as is
      if (currencyCode === 'USD') return Number(amount);

      // 2. If it's VES, convert to USD using historical rate (if available) or current rate
      if (currencyCode === 'VES' || Number(rateRelToPrimary) === 1) {
        const historicalRate =
          Number(rateRelToPrimary) > 1 ? Number(rateRelToPrimary) : usdRate;
        return Number(amount) / historicalRate;
      }

      // 3. For other currencies (COP, EUR), convert to Primary (VES) then to USD (Current)
      const valInPrimary = Number(amount) * Number(rateRelToPrimary || 1);
      return valInPrimary / usdRate;
    };

    // 1. Sales Data (Normalizing each range to USD)
    // IMPORTANT: Sales in this system are recorded in VES (Primary Currency)
    const fetchSalesTotalUSD = async (where: any) => {
      const sales = await this.prisma.sale.findMany({
        where,
        select: { total: true, exchangeRate: true },
      });
      // Convert each sale using its historical rate (or fallback to current usdRate if 1.0)
      return sales.reduce((acc, sale) => {
        const rate =
          Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1
            ? Number(sale.exchangeRate)
            : usdRate;
        return acc + Number(sale.total) / rate;
      }, 0);
    };

    const [todayTotal, yesterdayTotal, thisMonthTotal, lastMonthTotal] =
      await Promise.all([
        fetchSalesTotalUSD({ createdAt: { gte: today }, active: true }),
        fetchSalesTotalUSD({
          createdAt: { gte: yesterday, lte: yesterdayEnd },
          active: true,
        }),
        fetchSalesTotalUSD({ createdAt: { gte: monthStart }, active: true }),
        fetchSalesTotalUSD({
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
          active: true,
        }),
      ]);

    const percentChange =
      yesterdayTotal > 0
        ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
        : 0;

    const trend: 'up' | 'down' | 'stable' =
      percentChange > 5 ? 'up' : percentChange < -5 ? 'down' : 'stable';

    // 2. Inventory Data
    const [productsCount, criticalStockProducts] = await Promise.all([
      this.prisma.product.count({ where: { active: true } }),
      this.prisma.product.findMany({
        where: { active: true, stock: { lt: 10 } },
        select: { name: true, sku: true, stock: true },
        take: 10,
      }),
    ]);

    const topProductsItems = await this.prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: monthStart }, active: true } },
      include: {
        sale: { select: { exchangeRate: true } },
        product: { select: { name: true } },
      },
    });

    const productsMap: Record<
      string,
      { name: string; totalUSD: number; units: number }
    > = {};
    topProductsItems.forEach((item) => {
      const pid = item.productId;
      if (!productsMap[pid]) {
        productsMap[pid] = {
          name: item.product?.name || 'Unknown',
          totalUSD: 0,
          units: 0,
        };
      }

      const rate =
        Number(item.sale.exchangeRate) && Number(item.sale.exchangeRate) !== 1
          ? Number(item.sale.exchangeRate)
          : usdRate;

      productsMap[pid].totalUSD += Number(item.total) / rate;
      productsMap[pid].units += Number(item.quantity);
    });

    const topProductsData = Object.values(productsMap)
      .sort((a, b) => b.totalUSD - a.totalUSD)
      .slice(0, 5)
      .map((p) => ({
        name: p.name,
        revenue: Math.round(p.totalUSD),
        units: Math.round(p.units),
      }));

    // Calculate total inventory value in USD
    const allProducts = await this.prisma.product.findMany({
      where: { active: true },
      select: {
        stock: true,
        costPrice: true,
        currency: { select: { exchangeRate: true, isPrimary: true } },
      },
    });

    let totalInventoryValueUSD = 0;
    for (const p of allProducts) {
      const rate = p.currency?.isPrimary
        ? 1
        : Number(p.currency?.exchangeRate || 1);
      totalInventoryValueUSD += toUSD(
        Number(p.stock) * Number(p.costPrice || 0),
        rate,
      );
    }

    // 3. Financial Data (Accounts Receivable/Payable and Expenses)
    const [cashSession, invoices, unpaidPurchases, monthlyPurchases, expenses] =
      await Promise.all([
        this.prisma.cashSession.findFirst({
          where: { status: 'OPEN' },
          select: { actualBalance: true, openingBalance: true },
        }),
        this.prisma.invoice.findMany({
          where: {
            status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
            active: true,
          },
          select: { balance: true, exchangeRate: true, currencyCode: true },
        }),
        this.prisma.purchase.findMany({
          where: { paymentStatus: { in: ['UNPAID', 'PARTIAL'] } },
          select: { balance: true, exchangeRate: true, currencyCode: true },
        }),
        this.prisma.purchase.findMany({
          where: { createdAt: { gte: monthStart }, status: 'COMPLETED' },
          select: { total: true, exchangeRate: true, currencyCode: true },
        }),
        this.prisma.expense.findMany({
          where: { date: { gte: monthStart } },
          select: { amount: true, exchangeRate: true, currencyCode: true },
        }),
      ]);

    // Cash balance is in VES (Primary)
    const cashBalancePrimary = Number(
      cashSession?.actualBalance || cashSession?.openingBalance || 0,
    );
    const cashBalanceUSD = cashBalancePrimary / usdRate;

    const receivableUSD = invoices.reduce(
      (acc, inv) =>
        acc + toUSD(inv.balance, inv.exchangeRate, inv.currencyCode),
      0,
    );
    const payableUSD = unpaidPurchases.reduce(
      (acc, pur) =>
        acc + toUSD(pur.balance, pur.exchangeRate, pur.currencyCode),
      0,
    );
    const totalPurchasesUSD = monthlyPurchases.reduce(
      (acc, pur) => acc + toUSD(pur.total, pur.exchangeRate, pur.currencyCode),
      0,
    );
    const monthlyExpensesUSD = expenses.reduce(
      (acc, exp) => acc + toUSD(exp.amount, exp.exchangeRate, exp.currencyCode),
      0,
    );

    const profitUSD = thisMonthTotal - monthlyExpensesUSD;
    const profitMargin =
      thisMonthTotal > 0 ? Math.round((profitUSD / thisMonthTotal) * 100) : 0;

    // 4. Generate Alerts
    const alerts: BusinessContext['alerts'] = [];

    if (criticalStockProducts.length > 0) {
      alerts.push({
        type: 'stock',
        message: `${criticalStockProducts.length} product(s) with critical stock levels`,
        severity: 'high',
      });
    }

    if (payableUSD > cashBalanceUSD + receivableUSD) {
      alerts.push({
        type: 'payment',
        message: 'Accounts payable exceed available liquidity (USD)',
        severity: 'high',
      });
    }

    if (trend === 'down') {
      alerts.push({
        type: 'sales',
        message: 'Sales are on a downward trend',
        severity: 'medium',
      });
    }

    return {
      timestamp: now.toISOString(),
      period,
      currency: 'USD',
      exchangeRateUsed: usdRate,
      sales: {
        today: Math.round(todayTotal),
        yesterday: Math.round(yesterdayTotal),
        thisMonth: Math.round(thisMonthTotal),
        lastMonth: Math.round(lastMonthTotal),
        trend,
        percentChange: Math.round(percentChange),
      },
      inventory: {
        totalValue: Math.round(totalInventoryValueUSD),
        totalProducts: productsCount,
        criticalStock: criticalStockProducts.map((p) => ({
          name: p.name,
          sku: p.sku,
          stock: Number(p.stock),
          minStock: 10,
        })),
        topProducts: topProductsData,
      },
      finances: {
        cashBalance: Math.round(cashBalanceUSD),
        accountsReceivable: Math.round(receivableUSD),
        accountsPayable: Math.round(payableUSD),
        totalExpenses: Math.round(monthlyExpensesUSD),
        totalPurchases: Math.round(totalPurchasesUSD),
        profit: Math.round(profitUSD),
        profitMargin,
      },
      alerts,
    };
  }
}
