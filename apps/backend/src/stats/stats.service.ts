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
      include: { preferredSecondaryCurrency: true },
    });
    const refCurrency = companySettings?.preferredSecondaryCurrency;
    const currentRefRate = Number(refCurrency?.exchangeRate || 1);

    let factor = 1;
    if (currencyCode === 'VES') {
      factor = currentRefRate;
    } else {
      const targetCurrency = await this.prisma.currency.findUnique({
        where: { code: currencyCode },
      });
      if (
        targetCurrency &&
        refCurrency &&
        targetCurrency.code !== refCurrency.code
      ) {
        const tr = Number(targetCurrency.exchangeRate || 1);
        if (tr > 0) factor = currentRefRate / tr;
      }
    }
    return { factor, currentRefRate };
  }

  public async calculateNetSalesRevalued(
    dateFilter: any,
    currencyCode: string = 'VES',
    nominal: boolean = false,
    allCurrenciesInput?: any[],
  ) {
    // 1. Get All Currencies for revaluation
    const allCurrencies =
      allCurrenciesInput ||
      (await this.prisma.currency.findMany({ where: { active: true } }));

    const { factor: crossRateFactor, currentRefRate } =
      await this.getCrossRateFactor(currencyCode);

    // 2. Get Gross Sales revalued
    const sales = await this.prisma.sale.findMany({
      where: { active: true, createdAt: dateFilter },
      select: { total: true, exchangeRate: true, paymentMethod: true },
    });

    let grossSalesTarget = 0;
    let grossSalesNominal = 0;
    sales.forEach((sale) => {
      const { totalInTarget } = this.revalueSaleByPayments(
        sale,
        currentRefRate,
        crossRateFactor,
        currencyCode === 'VES',
        allCurrencies,
      );

      grossSalesNominal += Number(sale.total);
      grossSalesTarget += totalInTarget;
    });

    // 2. Get Returns Adjustments (Exchanges and Refunds)
    const returns = await this.prisma.return.findMany({
      where: { status: 'COMPLETED', createdAt: dateFilter },
      include: {
        items: true,
        replacementItems: true,
        originalSale: {
          select: { exchangeRate: true, paymentMethod: true, total: true },
        },
      },
    });

    let totalAdjustmentsTarget = 0;
    let totalAdjustmentsNominal = 0;
    returns.forEach((ret) => {
      const returnedValueVES = ret.items.reduce(
        (sum, item) => sum + Number(item.total),
        0,
      );

      // Revalue RETURN items using current rate (for consistency in "Real Value" model)
      const returnedValueTarget =
        (returnedValueVES / currentRefRate) * crossRateFactor;

      totalAdjustmentsTarget -= returnedValueTarget;
      totalAdjustmentsNominal -= returnedValueVES;

      // 2. Revalue REPLACEMENT items using current rate (New inventory out)
      if (ret.returnType.startsWith('EXCHANGE')) {
        const replacementValueVES = ret.replacementItems.reduce(
          (sum, item) => sum + Number(item.total),
          0,
        );
        totalAdjustmentsTarget +=
          (replacementValueVES / currentRefRate) * crossRateFactor;
        totalAdjustmentsNominal += replacementValueVES;
      }
    });

    return nominal
      ? grossSalesNominal + totalAdjustmentsNominal
      : grossSalesTarget + totalAdjustmentsTarget;
  }

  async getDashboardStats(range: string = '7days') {
    const today = dayjs().startOf('day').toDate();
    const monthStart = dayjs().startOf('month').toDate();
    const lastMonthStart = dayjs()
      .subtract(1, 'month')
      .startOf('month')
      .toDate();
    const lastMonthEnd = dayjs().subtract(1, 'month').endOf('month').toDate();

    const allCurrencies = await this.prisma.currency.findMany({
      where: { active: true },
    });

    // All sales in dashboard are now revalued to current rate for coherence
    const todaySales = await this.calculateNetSalesRevalued(
      { gte: today },
      'VES',
      false,
      allCurrencies,
    ); // Mixed Revalued
    const thisMonthSales = await this.calculateNetSalesRevalued(
      { gte: monthStart },
      'VES',
      false,
      allCurrencies,
    ); // Mixed Revalued
    const thisMonthSalesNominal = await this.calculateNetSalesRevalued(
      { gte: monthStart },
      'VES',
      true,
      allCurrencies,
    );
    const lastMonthSales = await this.calculateNetSalesRevalued(
      { gte: lastMonthStart, lte: lastMonthEnd },
      'VES',
      false,
      allCurrencies,
    );
    const lastMonthSalesNominal = await this.calculateNetSalesRevalued(
      { gte: lastMonthStart, lte: lastMonthEnd },
      'VES',
      true,
      allCurrencies,
    );

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
    const totalProducts = await this.prisma.product.count({
      where: { active: true },
    });

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
          sales: await this.calculateNetSalesRevalued(
            { gte: date, lte: nextDate },
            'VES',
            false,
            allCurrencies,
          ),
        });
      }
    } else if (range === '1year') {
      for (let i = 11; i >= 0; i--) {
        const date = dayjs().subtract(i, 'month').startOf('month').toDate();
        const nextDate = dayjs().subtract(i, 'month').endOf('month').toDate();

        salesTrend.push({
          date: dayjs(date).format('MMM YY'),
          sales: await this.calculateNetSalesRevalued(
            { gte: date, lte: nextDate },
            'VES',
            false,
            allCurrencies,
          ),
        });
      }
    } else if (range === 'all') {
      const firstSale = await this.prisma.sale.findFirst({
        where: { active: true },
        orderBy: { createdAt: 'asc' },
      });

      const startDate = firstSale
        ? dayjs(firstSale.createdAt).startOf('month')
        : dayjs().subtract(5, 'month').startOf('month');
      const now = dayjs().endOf('month');

      let current = startDate;
      while (current.isBefore(now)) {
        const start = current.startOf('month').toDate();
        const end = current.endOf('month').toDate();

        salesTrend.push({
          date: current.format('MMM YY'),
          sales: await this.calculateNetSalesRevalued(
            { gte: start, lte: end },
            'VES',
            false,
            allCurrencies,
          ),
        });

        current = current.add(1, 'month');
      }
    }

    // Calculate Returns/Refunds for current month
    const monthReturns = await this.prisma.return.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: monthStart },
      },
      select: {
        returnType: true,
        refundAmount: true,
        items: {
          select: { total: true },
        },
        replacementItems: {
          select: { total: true },
        },
      },
    });

    let totalReturnsValue = 0;
    let totalExchangeValue = 0;
    let totalRefundsPaid = 0;
    let netReplacementValue = 0;

    monthReturns.forEach((ret) => {
      const returnValue = ret.items.reduce(
        (sum, i) => sum + Number(i.total || 0),
        0,
      );

      // NOMINAL MODEL: Use exact values without revaluation
      if (ret.returnType.startsWith('REFUND')) {
        totalReturnsValue += returnValue;
        if (ret.refundAmount) totalRefundsPaid += Number(ret.refundAmount);
      } else if (ret.returnType.startsWith('EXCHANGE')) {
        totalExchangeValue += returnValue;
        const replacementValue = ret.replacementItems.reduce(
          (sum, i) => sum + Number(i.total || 0),
          0,
        );
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
        netImpact: totalReturnsValue + totalExchangeValue - netReplacementValue,
      },
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
        currency: { select: { isPrimary: true, exchangeRate: true } },
      },
    });

    const targetCurrency = await this.prisma.currency.findUnique({
      where: { code: currencyCode },
    });
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
      const rate = p.currency?.isPrimary
        ? 1
        : Number(p.currency?.exchangeRate || 1);
      const costInPrimary = Number(p.costPrice || 0) * rate;

      // Convert to Target Currency
      // Primary -> Target: Primary / TargetRate
      // (Assumes TargetRate is Primary per Target Unit, e.g. 50 Bs/$)
      const costInTarget = targetCurrency?.isPrimary
        ? costInPrimary
        : costInPrimary / targetRate;

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

    // Depletion Forecast: Products that will run out soon based on last 180 days velocity
    const projectionDays = 180;
    const sixMonthsAgo = dayjs().subtract(180, 'days').toDate();
    const salesInLast180Days = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        createdAt: { gte: sixMonthsAgo },
        sale: { isCancelled: false },
      },
      _sum: {
        quantity: true,
      },
    });

    const velocityMap = new Map<string, number>();
    salesInLast180Days.forEach((item) => {
      const totalSold = Number(item._sum.quantity || 0);
      velocityMap.set(item.productId, totalSold / 180);
    });

    // Get all active products with their current stock and sales info
    const allProducts = await this.prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        stock: true,
        category: { select: { name: true } },
      },
    });

    const depletionForecast = allProducts
      .flatMap((p) => {
        const velocity = velocityMap.get(p.id) || 0;
        const stock = Number(p.stock);

        if (velocity <= 0) return []; // No sales, no forecast

        const daysRemaining = Math.ceil(stock / velocity);
        if (daysRemaining > 20) return []; // Only critical ones

        return [
          {
            name: p.name,
            stock: stock,
            dailySalesVelocity: velocity,
            daysRemaining,
            unitsNeeded6Months: Math.ceil(velocity * projectionDays),
            category: p.category?.name || 'Sin Categoría',
          },
        ];
      })
      .sort((a, b) => Number(a.daysRemaining) - Number(b.daysRemaining));

    return {
      stockByDepartment: stockByDept,
      lowStockProducts: lowStock,
      depletionForecast: depletionForecast,
      totalInventoryValue: totalValue,
    };
  }

  async getFinanceReport(
    currencyCode: string = 'VES',
    startDate?: string,
    endDate?: string,
  ) {
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
    const allCurrencies = await this.prisma.currency.findMany({
      where: { active: true },
    });
    const targetCurrency = allCurrencies.find((c) => c.code === currencyCode);

    // 2. Get Reference Currency (The one stored in sale.exchangeRate, usually USD)
    const companySettings = await this.prisma.companySettings.findFirst({
      include: { preferredSecondaryCurrency: true },
    });
    const refCurrency = companySettings?.preferredSecondaryCurrency;
    const currentRefRate = Number(refCurrency?.exchangeRate || 1);

    // Calculate Cross-Rate Factor (Ref -> Target)
    let crossRateFactor = 1;
    if (currencyCode === 'VES') {
      crossRateFactor = currentRefRate;
    } else if (
      targetCurrency &&
      refCurrency &&
      targetCurrency.code !== refCurrency.code
    ) {
      const tr = Number(targetCurrency.exchangeRate || 1);
      if (tr > 0) {
        crossRateFactor = currentRefRate / tr;
      }
    }

    // Sales for the selected range
    const salesInRange = await this.prisma.sale.findMany({
      where: {
        active: true,
        createdAt: dateFilter,
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
                currency: true,
              },
            },
          },
        },
      },
    });

    // Payment methods breakdown
    const paymentBreakdown: Record<string, number> = {};
    const currencyTypeBreakdown: Record<'LOCAL' | 'FOREIGN', number> = {
      LOCAL: 0,
      FOREIGN: 0,
    };
    const dailySales: Record<string, number> = {};
    // 2.1 Determine "Closing Rates" for each month
    const monthClosingRates = this.calculateMonthClosingRates(
      salesInRange,
      currentRefRate,
    );
    const getMonthRate = (date: Date) => {
      const monthKey = dayjs(date).format('YYYY-MM');
      return monthClosingRates[monthKey] || currentRefRate;
    };

    let totalSalesAmount = 0;
    let totalSalesNominal = 0;
    let totalCostOfSales = 0;

    salesInRange.forEach((sale) => {
      const date = dayjs(sale.createdAt).format('YYYY-MM-DD');
      const saleNominalTotal = Number(sale.total || 0);
      totalSalesNominal += saleNominalTotal;

      const closingRate = getMonthRate(sale.createdAt);
      // Adjust cross-rate factor for this specific month
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;

      // ECONOMIC MODEL: Calculate Real Value of this sale in Target Currency
      const { totalInTarget, breakdown, typeBreakdown } =
        this.revalueSaleByPayments(
          sale,
          closingRate,
          monthCrossRateFactor,
          currencyCode === 'VES',
          allCurrencies,
        );

      totalSalesAmount += totalInTarget;
      dailySales[date] = (dailySales[date] || 0) + totalInTarget;

      // Merge breakdowns
      Object.entries(breakdown).forEach(([method, amount]) => {
        paymentBreakdown[method] = (paymentBreakdown[method] || 0) + amount;
      });
      currencyTypeBreakdown.LOCAL += typeBreakdown.LOCAL;
      currencyTypeBreakdown.FOREIGN += typeBreakdown.FOREIGN;

      // Calculate COGS (normalized to target currency using CURRENT rate)
      sale.items.forEach((item) => {
        let itemCostInVES = Number(item.cost || 0);

        if (itemCostInVES === 0 && item.product) {
          const productRate = item.product.currency?.isPrimary
            ? 1
            : Number(item.product.currency?.exchangeRate || 1);
          itemCostInVES = Number(item.product.costPrice || 0) * productRate;
        }

        const itemTotalCostVES = itemCostInVES * Number(item.quantity);
        const itemTotalCostTarget =
          (itemTotalCostVES / closingRate) * monthCrossRateFactor;

        totalCostOfSales += itemTotalCostTarget;
      });
    });

    // 3. Process Returns
    const returnsInRange = await this.prisma.return.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: dateFilter,
      },
      include: {
        items: {
          include: {
            product: { include: { currency: true } },
          },
        },
        replacementItems: {
          include: {
            product: { include: { currency: true } },
          },
        },
        originalSale: {
          select: { exchangeRate: true, paymentMethod: true, total: true },
        },
      },
    });

    let totalReturnsValueNominal = 0;
    let totalReplacementValueNominal = 0;
    let totalMonetaryRefunds = 0;
    let totalExchangeValue = 0;
    let returnedCostOfSales = 0;
    let replacementCostOfSales = 0;

    returnsInRange.forEach((ret) => {
      const returnedValueVES = ret.items.reduce(
        (sum, item) => sum + Number(item.total || 0),
        0,
      );
      const replacementsVES = ret.replacementItems.reduce(
        (sum, item) => sum + Number(item.total || 0),
        0,
      );

      totalReturnsValueNominal += returnedValueVES;
      totalReplacementValueNominal += replacementsVES;

      const closingRate = getMonthRate(ret.createdAt);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;

      const returnedValueTarget =
        (returnedValueVES / closingRate) * monthCrossRateFactor;
      const replacementValueTarget =
        (replacementsVES / closingRate) * monthCrossRateFactor;

      // Adjust Net Sales
      totalSalesAmount =
        totalSalesAmount - returnedValueTarget + replacementValueTarget;
      totalSalesNominal =
        totalSalesNominal - returnedValueVES + replacementsVES;

      if (ret.returnType === 'REFUND') {
        const refundTarget =
          (Number(ret.refundAmount || 0) / closingRate) * monthCrossRateFactor;
        totalMonetaryRefunds += refundTarget;

        if (ret.refundMethod && ret.refundMethod !== 'CREDIT_NOTE') {
          const method = ret.refundMethod.toUpperCase();
          paymentBreakdown[method] =
            (paymentBreakdown[method] || 0) - refundTarget;
        }
      } else {
        totalExchangeValue += returnedValueTarget;
      }

      // Trend Adjustment
      const date = dayjs(ret.createdAt).format('YYYY-MM-DD');
      dailySales[date] =
        (dailySales[date] || 0) - returnedValueTarget + replacementValueTarget;

      // COGS Adjustment
      if (this.SELLABLE_RETURN_REASONS.includes(ret.reason)) {
        ret.items.forEach((item) => {
          const productRate = item.product.currency?.isPrimary
            ? 1
            : Number(item.product.currency?.exchangeRate || 1);
          const itemCostVES =
            Number(item.product.costPrice || 0) *
            productRate *
            Number(item.quantity);
          returnedCostOfSales +=
            (itemCostVES / closingRate) * monthCrossRateFactor;
        });
      }

      if (ret.returnType.startsWith('EXCHANGE')) {
        ret.replacementItems.forEach((item) => {
          const productRate = item.product.currency?.isPrimary
            ? 1
            : Number(item.product.currency?.exchangeRate || 1);
          const itemCostVES =
            Number(item.product.costPrice || 0) *
            productRate *
            Number(item.quantity);
          replacementCostOfSales +=
            (itemCostVES / closingRate) * monthCrossRateFactor;
        });
      }
    });

    // 4. Purchases and Expenses revalued at current rate
    const purchasesInRangeList = await this.prisma.purchase.findMany({
      where: {
        createdAt: dateFilter,
        status: 'COMPLETED',
      },
      select: {
        total: true,
        exchangeRate: true,
        currencyCode: true,
        createdAt: true,
      },
    });

    // Expenses for the selected range
    const expensesInRangeList = await this.prisma.expense.findMany({
      where: {
        date: dateFilter,
      },
      select: {
        amount: true,
        exchangeRate: true,
        currencyCode: true,
        date: true,
      },
    });

    let totalPurchasesAmount = 0;
    purchasesInRangeList.forEach((p) => {
      const val = Number(p.total);
      const pCurrency = allCurrencies.find((c) => c.code === p.currencyCode);
      const isForeign = pCurrency && !pCurrency.isPrimary;

      const closingRate = getMonthRate(p.createdAt);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;

      let valTarget = 0;
      if (isForeign) {
        // Revalued: Original Divisa Amount * Today's Cross-Rate to Target
        // Today's USD value of this purchase: val * (todayRateOfForeign / todayRefRate)
        // (e.g. 10 EUR * (1.1 EUR/USD) = 11 USD)
        // Then convert to target: USD * crossRateFactor
        const foreignRate = Number(pCurrency.exchangeRate || 1);
        const usdValue = (val * foreignRate) / closingRate;
        valTarget = usdValue * monthCrossRateFactor;
      } else {
        // Nominal BS: Original BS / currentRefRate * crossRateFactor
        // (If target is BS, it's just val / rate * rate = val)
        valTarget = (val / closingRate) * monthCrossRateFactor;
      }

      totalPurchasesAmount += valTarget;
    });

    let totalExpensesAmount = 0;
    expensesInRangeList.forEach((e) => {
      const val = Number(e.amount);
      const eCurrency = allCurrencies.find((c) => c.code === e.currencyCode);
      const isLocal = !eCurrency || eCurrency.isPrimary;

      const closingRate = getMonthRate(e.date);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;

      let expTarget = 0;
      if (isLocal && currencyCode === 'VES') {
        expTarget = val;
      } else {
        // All other revalued at closingRate
        const eRate = Number(e.exchangeRate) || 1;
        const valVES = isLocal ? val : val * eRate;
        expTarget = (valVES / closingRate) * monthCrossRateFactor;
      }
      totalExpensesAmount += expTarget;
    });

    let adjustedCostOfSales =
      totalCostOfSales - returnedCostOfSales + replacementCostOfSales;

    // Add inventory losses (DAMAGE, LOSS) to cost of sales
    const inventoryLosses = await this.prisma.inventoryAdjustment.findMany({
      where: {
        createdAt: dateFilter,
        type: 'DECREASE',
        reason: { in: this.LOSS_ADJUSTMENT_REASONS },
      },
      include: {
        product: { include: { currency: true } },
      },
    });

    let inventoryLossCost = 0;
    inventoryLosses.forEach((adj) => {
      const productRate = adj.product.currency?.isPrimary
        ? 1
        : Number(adj.product.currency?.exchangeRate || 1);
      const lossCostInVES =
        Number(adj.product.costPrice || 0) * productRate * Number(adj.quantity);

      inventoryLossCost += (lossCostInVES / currentRefRate) * crossRateFactor;
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
      paymentMethodsBreakdown: Object.entries(paymentBreakdown)
        .map(([method, amount]) => ({
          method,
          amount: Number(amount.toFixed(2)),
        }))
        .sort((a, b) => b.amount - a.amount),
      currencyTypeBreakdown: {
        LOCAL: Number(currencyTypeBreakdown.LOCAL.toFixed(2)),
        FOREIGN: Number(currencyTypeBreakdown.FOREIGN.toFixed(2)),
      },
      dailySalesData: Object.entries(dailySales).map(([date, amount]) => ({
        date: dayjs(date).format('DD/MM'),
        amount: Number(amount.toFixed(2)),
      })),
    };
  }

  async getCOGSReport(
    currencyCode: string = 'VES',
    startDate?: string,
    endDate?: string,
  ) {
    const dateFilter: any = {};

    if (startDate || endDate) {
      if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
      if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
    } else {
      // Unify with getInflationReport default
      dateFilter.gte = dayjs().startOf('month').toDate();
    }

    const allCurrencies = await this.prisma.currency.findMany({
      where: { active: true },
    });
    const targetCurrency = allCurrencies.find((c) => c.code === currencyCode);

    // 2. Get Reference Currency (The one stored in sale.exchangeRate, usually USD)
    const companySettings = await this.prisma.companySettings.findFirst({
      include: { preferredSecondaryCurrency: true },
    });
    const refCurrency = companySettings?.preferredSecondaryCurrency;
    const currentRefRate = Number(refCurrency?.exchangeRate || 1);

    // Calculate Cross-Rate Factor (Ref -> Target)
    let crossRateFactor = 1;
    if (currencyCode === 'VES') {
      crossRateFactor = currentRefRate;
    } else if (
      targetCurrency &&
      refCurrency &&
      targetCurrency.code !== refCurrency.code
    ) {
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
            product: { include: { category: true, currency: true } },
          },
        },
      },
    });

    const productBreakdown: Record<
      string,
      {
        name: string;
        sku: string | null;
        category: string;
        quantity: number;
        totalCost: number;
        totalRevenue: number;
        inflationLoss: number;
      }
    > = {};

    // 1.1 Determine "Closing Rates" for each month
    const monthClosingRates = this.calculateMonthClosingRates(
      sales,
      currentRefRate,
    );
    const getMonthRate = (date: Date) => {
      const monthKey = dayjs(date).format('YYYY-MM');
      return monthClosingRates[monthKey] || currentRefRate;
    };

    let totalSales = 0;
    let totalSalesNominal = 0;
    let totalCOGS = 0;
    let totalInflationLoss = 0;

    sales.forEach((sale) => {
      const saleNominalTotal = Number(sale.total || 0);
      totalSalesNominal += saleNominalTotal;

      // ECONOMIC MODEL: Calculate Real Value of this sale using monthly closing rate
      const closingRate = getMonthRate(sale.createdAt);

      // Adjust cross-rate factor for this specific month closing rate if target is VES
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;

      const { totalInTarget, typeBreakdown } = this.revalueSaleByPayments(
        sale,
        closingRate,
        monthCrossRateFactor,
        currencyCode === 'VES',
        allCurrencies,
      );

      totalSales += totalInTarget;

      // Calculate Inflation Loss (Portion in local currency that devalued)
      const historicalRate =
        Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1
          ? Number(sale.exchangeRate)
          : closingRate;

      // Inflation Loss is only relevant for the LOCAL portion
      const localPortionVES =
        currencyCode === 'VES'
          ? typeBreakdown.LOCAL
          : (typeBreakdown.LOCAL / monthCrossRateFactor) * closingRate;

      const revaluedVES = (localPortionVES / historicalRate) * closingRate;
      const saleInflationLossVES = revaluedVES - localPortionVES;
      const saleInflationLossTarget =
        (saleInflationLossVES / closingRate) * monthCrossRateFactor;

      totalInflationLoss += saleInflationLossTarget;

      sale.items.forEach((item) => {
        let itemCostInVES = Number(item.cost || 0);

        if (itemCostInVES === 0 && item.product) {
          const productRate = item.product.currency?.isPrimary
            ? 1
            : Number(item.product.currency?.exchangeRate || 1);
          itemCostInVES = Number(item.product.costPrice || 0) * productRate;
        }

        // Costs are ALWAYS revalued at current rate (replacement cost)
        // but for historical closure we use the closing rate of that month
        const cost =
          ((itemCostInVES * Number(item.quantity)) / closingRate) *
          monthCrossRateFactor;

        // Revenue is proportionally distributed from the revalued total
        const revenue =
          saleNominalTotal > 0
            ? (Number(item.total) / saleNominalTotal) * totalInTarget
            : 0;

        // inflation loss for this item
        const itemInflationLoss =
          saleNominalTotal > 0
            ? (Number(item.total) / saleNominalTotal) * saleInflationLossTarget
            : 0;

        totalCOGS += cost;

        const pid = item.product.id;
        if (!productBreakdown[pid]) {
          productBreakdown[pid] = {
            name: item.product.name,
            sku: item.product.sku,
            category: item.product.category?.name || 'S/C',
            quantity: 0,
            totalCost: 0,
            totalRevenue: 0,
            inflationLoss: 0,
          };
        }

        productBreakdown[pid].quantity += Number(item.quantity);
        productBreakdown[pid].totalCost += cost;
        productBreakdown[pid].totalRevenue += revenue;
        productBreakdown[pid].inflationLoss += itemInflationLoss;
      });
    });

    // 2. Fetch Purchases and Expenses revalued at current rate
    const purchases = await this.prisma.purchase.findMany({
      where: { createdAt: dateFilter, status: 'COMPLETED' },
      select: {
        total: true,
        exchangeRate: true,
        currencyCode: true,
        createdAt: true,
      },
    });

    let totalPurchases = 0;
    purchases.forEach((p) => {
      const val = Number(p.total);
      const rate = Number(p.exchangeRate) || 1;
      const valVES = p.currencyCode === 'VES' ? val : val * rate;
      const closingRate = getMonthRate(p.createdAt);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;
      totalPurchases += (valVES / closingRate) * monthCrossRateFactor;
    });

    const expenses = await this.prisma.expense.findMany({
      where: { date: dateFilter },
      select: {
        amount: true,
        exchangeRate: true,
        currencyCode: true,
        date: true,
      },
    });

    let totalExpenses = 0;
    expenses.forEach((e) => {
      const val = Number(e.amount);
      const rate = Number(e.exchangeRate) || 1;
      const valVES = e.currencyCode === 'VES' ? val : val * rate;
      const closingRate = getMonthRate(e.date);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;
      totalExpenses += (valVES / closingRate) * monthCrossRateFactor;
    });

    // 3. Process Returns Consistency
    const completedReturns = await this.prisma.return.findMany({
      where: { status: 'COMPLETED', createdAt: dateFilter },
      include: {
        items: { include: { product: { include: { currency: true } } } },
        replacementItems: {
          include: { product: { include: { currency: true } } },
        },
        originalSale: { select: { exchangeRate: true } },
      },
    });

    let returnedCOGS = 0;
    let replacementCOGS = 0;
    let totalReturnsValue = 0;
    let totalReplacementValue = 0;
    let returnedValueNominal = 0;
    let replacementValueNominal = 0;

    completedReturns.forEach((ret) => {
      const returnedValueVES = ret.items.reduce(
        (sum, item) => sum + Number(item.total || 0),
        0,
      );
      const replacementsVES = ret.replacementItems.reduce(
        (sum, item) => sum + Number(item.total || 0),
        0,
      );

      const closingRate = getMonthRate(ret.createdAt);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;

      const historicalRate =
        Number(ret.originalSale?.exchangeRate) &&
          Number(ret.originalSale?.exchangeRate) !== 1
          ? Number(ret.originalSale?.exchangeRate)
          : closingRate;

      const returnedValueRevaluedVES =
        (returnedValueVES / historicalRate) * closingRate;
      const replacementsRevaluedVES =
        (replacementsVES / historicalRate) * closingRate;

      const returnedValueTarget =
        (returnedValueRevaluedVES / closingRate) * monthCrossRateFactor;
      const replacementsTarget =
        (replacementsRevaluedVES / closingRate) * monthCrossRateFactor;

      totalReturnsValue += returnedValueTarget;
      returnedValueNominal += returnedValueVES;

      // Sychronize Inflation Loss subtraction for returns (mirroring getInflationReport)
      if (ret.refundAmount && Number(ret.refundAmount) > 0 && ret.refundMethod) {
        const method = ret.refundMethod.toUpperCase();
        const isDivisa =
          method === 'ZELLE' ||
          method === 'USDT' ||
          method === 'UDT' ||
          method.includes('_UDT') ||
          method.includes('_USD') ||
          method.startsWith('CURRENCY_');

        if (!isDivisa) {
          const historicalRate =
            Number(ret.originalSale?.exchangeRate) &&
              Number(ret.originalSale?.exchangeRate) !== 1
              ? Number(ret.originalSale?.exchangeRate)
              : closingRate;

          const nominalVES = Number(ret.refundAmount);
          const revaluedVES = (nominalVES / historicalRate) * closingRate;
          const loss = revaluedVES - nominalVES;

          // Convert loss to Target if necessary (usually target is VES here)
          const lossTarget = (loss / closingRate) * monthCrossRateFactor;
          totalInflationLoss -= lossTarget;
        }
      }

      if (this.SELLABLE_RETURN_REASONS.includes(ret.reason)) {
        ret.items.forEach((item) => {
          const productRate = item.product.currency?.isPrimary
            ? 1
            : Number(item.product.currency?.exchangeRate || 1);
          const itemCostVES =
            Number(item.product.costPrice || 0) *
            productRate *
            Number(item.quantity);
          returnedCOGS += (itemCostVES / closingRate) * monthCrossRateFactor;
        });
      }

      if (ret.returnType.startsWith('EXCHANGE')) {
        totalReplacementValue += replacementsTarget;
        replacementValueNominal += replacementsVES;

        ret.replacementItems.forEach((item) => {
          const productRate = item.product.currency?.isPrimary
            ? 1
            : Number(item.product.currency?.exchangeRate || 1);
          const itemCostVES =
            Number(item.product.costPrice || 0) *
            productRate *
            Number(item.quantity);
          replacementCOGS += (itemCostVES / closingRate) * monthCrossRateFactor;
        });
      }
    });

    // Net Sales calculation consistent with Finance Report
    totalSales = totalSales - totalReturnsValue + totalReplacementValue;
    totalSalesNominal =
      totalSalesNominal - returnedValueNominal + replacementValueNominal;

    // Add inventory losses
    const inventoryLosses = await this.prisma.inventoryAdjustment.findMany({
      where: {
        createdAt: dateFilter,
        type: 'DECREASE',
        reason: { in: this.LOSS_ADJUSTMENT_REASONS },
      },
      include: { product: { include: { currency: true } } },
    });

    let inventoryLossCOGS = 0;
    inventoryLosses.forEach((adj) => {
      const productRate = adj.product.currency?.isPrimary
        ? 1
        : Number(adj.product.currency?.exchangeRate || 1);
      const lossCostVES =
        Number(adj.product.costPrice || 0) * productRate * Number(adj.quantity);
      const closingRate = getMonthRate(adj.createdAt);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;
      inventoryLossCOGS += (lossCostVES / closingRate) * monthCrossRateFactor;
    });

    const finalCOGS =
      totalCOGS - returnedCOGS + replacementCOGS + inventoryLossCOGS;

    return {
      totalSales: Number(totalSales.toFixed(2)),
      totalSalesNominal: Number(totalSalesNominal.toFixed(2)),
      totalCOGS: Number(finalCOGS.toFixed(2)),
      grossProfit: Number((totalSales - finalCOGS).toFixed(2)),
      totalInflationLoss: Number(totalInflationLoss.toFixed(2)),
      returnedCOGS: Number(returnedCOGS.toFixed(2)),
      replacementCOGS: Number(replacementCOGS.toFixed(2)),
      inventoryLossCOGS: Number(inventoryLossCOGS.toFixed(2)),
      totalPurchases: Number(totalPurchases.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      products: Object.values(productBreakdown)
        .map((p) => ({
          ...p,
          totalCost: Number(p.totalCost.toFixed(2)),
          totalRevenue: Number(p.totalRevenue.toFixed(2)),
          inflationLoss: Number(p.inflationLoss.toFixed(2)),
        }))
        .sort((a, b) => b.totalCost - a.totalCost),
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

    const allCurrencies = await this.prisma.currency.findMany({
      where: { active: true },
    });
    const targetCurrency = allCurrencies.find((c) => c.code === currencyCode);

    const companySettings = await this.prisma.companySettings.findFirst({
      include: { preferredSecondaryCurrency: true },
    });
    const refCurrency = companySettings?.preferredSecondaryCurrency;
    const currentRefRate = Number(refCurrency?.exchangeRate || 1);

    let crossRateFactor = 1;
    if (currencyCode === 'VES') {
      crossRateFactor = currentRefRate;
    } else if (
      targetCurrency &&
      refCurrency &&
      targetCurrency.code !== refCurrency.code
    ) {
      const tr = Number(targetCurrency.exchangeRate || 1);
      if (tr > 0) {
        crossRateFactor = currentRefRate / tr;
      }
    }

    for (let i = 11; i >= 0; i--) {
      const currentMonth = now.subtract(i, 'month');
      const start = currentMonth.startOf('month').toDate();
      const end = currentMonth.endOf('month').toDate();

      const sales = await this.prisma.sale.findMany({
        where: { createdAt: { gte: start, lte: end }, active: true },
        include: {
          items: {
            include: {
              product: { include: { currency: true } },
            },
          },
        },
      });

      const purchases = await this.prisma.purchase.findMany({
        where: { createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
        select: { total: true, exchangeRate: true, currencyCode: true },
      });

      const expenses = await this.prisma.expense.findMany({
        where: { date: { gte: start, lte: end } },
        select: { amount: true, exchangeRate: true, currencyCode: true },
      });

      let monthlyIncome = 0;
      let monthlyIncomeNominal = 0;
      let monthlyOperationalExpenses = 0;
      let monthlyPurchases = 0;
      let monthlyCOGS = 0;

      sales.forEach((sale) => {
        const { totalInTarget } = this.revalueSaleByPayments(
          sale,
          currentRefRate,
          crossRateFactor,
          currencyCode === 'VES',
          allCurrencies,
        );

        monthlyIncome += totalInTarget;
        monthlyIncomeNominal += Number(sale.total || 0);

        sale.items.forEach((item) => {
          let itemCostInVES = Number(item.cost || 0);
          if (itemCostInVES === 0 && item.product) {
            const productRate = item.product.currency?.isPrimary
              ? 1
              : Number(item.product.currency?.exchangeRate || 1);
            itemCostInVES = Number(item.product.costPrice || 0) * productRate;
          }
          // Costs are ALWAYS revalued at current rate
          monthlyCOGS +=
            ((itemCostInVES * Number(item.quantity)) / currentRefRate) *
            crossRateFactor;
        });
      });

      purchases.forEach((p) => {
        const val = Number(p.total);
        const rate = Number(p.exchangeRate) || 1;
        const valVES = p.currencyCode === 'VES' ? val : val * rate;
        monthlyPurchases += (valVES / currentRefRate) * crossRateFactor;
      });

      expenses.forEach((e) => {
        const val = Number(e.amount);
        const rate = Number(e.exchangeRate) || 1;
        const valVES = e.currencyCode === 'VES' ? val : val * rate;
        monthlyOperationalExpenses +=
          (valVES / currentRefRate) * crossRateFactor;
      });

      const returnsInRange = await this.prisma.return.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: start, lte: end } },
        include: {
          items: { include: { product: { include: { currency: true } } } },
          replacementItems: {
            include: { product: { include: { currency: true } } },
          },
          originalSale: { select: { exchangeRate: true } },
        },
      });

      let monthlyReturnsValue = 0;
      let monthlyReplacementValue = 0;
      let monthlyReturnedCOGS = 0;
      let monthlyReplacementCOGS = 0;

      returnsInRange.forEach((ret) => {
        const returnedValueVES = ret.items.reduce(
          (sum, item) => sum + Number(item.total || 0),
          0,
        );
        const replacementsVES = ret.replacementItems.reduce(
          (sum, item) => sum + Number(item.total || 0),
          0,
        );

        const returnedValueTarget =
          (returnedValueVES / currentRefRate) * crossRateFactor;
        const replacementsTarget =
          (replacementsVES / currentRefRate) * crossRateFactor;

        monthlyReturnsValue += returnedValueTarget;
        monthlyIncomeNominal -= returnedValueVES;

        if (this.SELLABLE_RETURN_REASONS.includes(ret.reason)) {
          ret.items.forEach((item) => {
            const productRate = item.product.currency?.isPrimary
              ? 1
              : Number(item.product.currency?.exchangeRate || 1);
            const itemCostVES =
              Number(item.product.costPrice || 0) *
              productRate *
              Number(item.quantity);
            monthlyReturnedCOGS +=
              (itemCostVES / currentRefRate) * crossRateFactor;
          });
        }

        if (ret.returnType.startsWith('EXCHANGE')) {
          monthlyReplacementValue += replacementsTarget;
          monthlyIncomeNominal += replacementsVES;

          ret.replacementItems.forEach((item) => {
            const productRate = item.product.currency?.isPrimary
              ? 1
              : Number(item.product.currency?.exchangeRate || 1);
            const itemCostVES =
              Number(item.product.costPrice || 0) *
              productRate *
              Number(item.quantity);
            monthlyReplacementCOGS +=
              (itemCostVES / currentRefRate) * crossRateFactor;
          });
        }
      });

      monthlyIncome =
        monthlyIncome - monthlyReturnsValue + monthlyReplacementValue;
      let adjustedMonthlyCOGS =
        monthlyCOGS - monthlyReturnedCOGS + monthlyReplacementCOGS;

      const monthlyInventoryLosses =
        await this.prisma.inventoryAdjustment.findMany({
          where: {
            createdAt: { gte: start, lte: end },
            type: 'DECREASE',
            reason: { in: this.LOSS_ADJUSTMENT_REASONS },
          },
          include: { product: { include: { currency: true } } },
        });

      monthlyInventoryLosses.forEach((adj) => {
        const productRate = adj.product.currency?.isPrimary
          ? 1
          : Number(adj.product.currency?.exchangeRate || 1);
        const lossCostVES =
          Number(adj.product.costPrice || 0) *
          productRate *
          Number(adj.quantity);
        adjustedMonthlyCOGS += (lossCostVES / currentRefRate) * crossRateFactor;
      });

      const realProfit =
        monthlyIncome - monthlyOperationalExpenses - adjustedMonthlyCOGS;
      const profitMargin =
        monthlyIncome > 0 ? (realProfit / monthlyIncome) * 100 : 0;
      const operatingCostRatio =
        monthlyIncome > 0
          ? (monthlyOperationalExpenses / monthlyIncome) * 100
          : 0;

      balanceData.push({
        month: currentMonth.format('MMMM'),
        income: Number(monthlyIncome.toFixed(2)),
        incomeNominal: Number(monthlyIncomeNominal.toFixed(2)),
        expenses: Number(monthlyOperationalExpenses.toFixed(2)),
        purchases: Number(monthlyPurchases.toFixed(2)),
        total: Number(realProfit.toFixed(2)),
        cogs: Number(adjustedMonthlyCOGS.toFixed(2)),
        profitMargin: Number(profitMargin.toFixed(1)),
        operatingCostRatio: Number(operatingCostRatio.toFixed(1)),
      });
    }

    return balanceData;
  }

  async getTopProducts(
    startDate?: string,
    endDate?: string,
    sortBy: 'units' | 'profit' = 'units',
    limit: number = 10,
    currencyCode: string = 'VES',
  ) {
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
      if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
    } else {
      // Default to current month
      dateFilter.gte = dayjs().startOf('month').toDate();
    }

    const allCurrencies = await this.prisma.currency.findMany({
      where: { active: true },
    });
    const targetCurrency = allCurrencies.find((c) => c.code === currencyCode);

    const companySettings = await this.prisma.companySettings.findFirst({
      include: { preferredSecondaryCurrency: true },
    });
    const refCurrency = companySettings?.preferredSecondaryCurrency;
    const currentRefRate = Number(refCurrency?.exchangeRate || 1);

    let crossRateFactor = 1;
    if (currencyCode === 'VES') {
      crossRateFactor = currentRefRate;
    } else if (
      targetCurrency &&
      refCurrency &&
      targetCurrency.code !== refCurrency.code
    ) {
      const tr = Number(targetCurrency.exchangeRate || 1);
      if (tr > 0) crossRateFactor = currentRefRate / tr;
    }

    const sales = await this.prisma.sale.findMany({
      where: {
        active: true,
        createdAt: dateFilter,
      },
      include: {
        items: {
          include: {
            product: { include: { category: true, currency: true } },
          },
        },
      },
    });

    const productMap: Record<
      string,
      {
        id: string;
        name: string;
        units: number;
        profit: number;
        revenue: number;
        totalCost: number;
      }
    > = {};

    // 2.1 Determine "Closing Rates" for each month
    const monthClosingRates = this.calculateMonthClosingRates(
      sales,
      currentRefRate,
    );
    const getMonthRate = (date: Date) => {
      const monthKey = dayjs(date).format('YYYY-MM');
      return monthClosingRates[monthKey] || currentRefRate;
    };

    sales.forEach((sale) => {
      const saleNominalTotal = Number(sale.total || 0);
      const closingRate = getMonthRate(sale.createdAt);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;

      const { totalInTarget } = this.revalueSaleByPayments(
        sale,
        closingRate,
        monthCrossRateFactor,
        currencyCode === 'VES',
        allCurrencies,
      );

      sale.items.forEach((item) => {
        const pid = item.product.id;
        if (!productMap[pid]) {
          productMap[pid] = {
            id: pid,
            name: item.product.name,
            units: 0,
            profit: 0,
            revenue: 0,
            totalCost: 0,
          };
        }

        const qty = Number(item.quantity);
        productMap[pid].units += qty;

        // Revenue is proportional part of revalued sale total
        const itemRevenue =
          saleNominalTotal > 0
            ? (Number(item.total) / saleNominalTotal) * totalInTarget
            : 0;

        productMap[pid].revenue += itemRevenue;

        // Profit calculation: revaluedRevenue - replacementCost
        let itemCostInVES = Number(item.cost || 0);
        if (itemCostInVES === 0 && item.product) {
          const productRate = item.product.currency?.isPrimary
            ? 1
            : Number(item.product.currency?.exchangeRate || 1);
          itemCostInVES = Number(item.product.costPrice || 0) * productRate;
        }
        // For historical months, we use the closingRate to determine the "replacement cost" at that time
        const currentCostTarget =
          ((itemCostInVES * qty) / closingRate) * monthCrossRateFactor;

        productMap[pid].totalCost += currentCostTarget;
        productMap[pid].profit += itemRevenue - currentCostTarget;
      });
    });

    return Object.values(productMap)
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, limit)
      .map((item) => ({
        ...item,
        margin:
          item.revenue > 0
            ? Number(((item.profit / item.revenue) * 100).toFixed(2))
            : 0,
      }));
  }

  async getInflationReport(startDate?: string, endDate?: string) {
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
      if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
    } else {
      dateFilter.gte = dayjs().startOf('month').toDate();
    }

    const allCurrencies = await this.prisma.currency.findMany({
      where: { active: true },
    });
    const { currentRefRate } = await this.getCrossRateFactor('VES');

    // 1. Fetch all required data
    const [sales, allReturns, inventoryLosses, expenses] = await Promise.all([
      this.prisma.sale.findMany({
        where: { active: true, createdAt: dateFilter },
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
                select: { id: true, currency: true, costPrice: true },
              },
            },
          },
        },
      }),
      this.prisma.return.findMany({
        where: { status: 'COMPLETED', createdAt: dateFilter },
        select: {
          refundAmount: true,
          refundMethod: true,
          createdAt: true,
          reason: true,
          returnType: true,
          originalSale: { select: { exchangeRate: true } },
          items: { include: { product: { include: { currency: true } } } },
          replacementItems: {
            include: { product: { include: { currency: true } } },
          },
        },
      }),
      this.prisma.inventoryAdjustment.findMany({
        where: {
          createdAt: dateFilter,
          type: 'DECREASE',
          reason: { in: this.LOSS_ADJUSTMENT_REASONS },
        },
        include: { product: { include: { currency: true } } },
      }),
      this.prisma.expense.findMany({
        where: { date: dateFilter },
        select: {
          amount: true,
          currencyCode: true,
          exchangeRate: true,
          date: true,
        },
      }),
    ]);

    // 2. Initialize processing variables
    const totalNominalVES = 0;
    let totalRevaluedVES = 0;
    let totalInflationLoss = 0;
    const methodBreakdown: Record<
      string,
      { nominal: number; revalued: number; loss: number }
    > = {};
    const dailyData: Record<
      string,
      { nominal: number; revalued: number; loss: number }
    > = {};
    const monthlyHistory: Record<
      string,
      {
        month: string;
        revaluedSales: number;
        revaluedCOGS: number;
        revaluedExpenses: number;
        operatingProfit: number;
        inflationLoss: number;
        realProfit: number;
        closingRateUsed: number;
      }
    > = {};

    // 2.1 Determine "Closing Rates" for each month
    const monthClosingRates = this.calculateMonthClosingRates(
      sales,
      currentRefRate,
    );

    const getMonthRate = (date: Date) => {
      const monthKey = dayjs(date).format('YYYY-MM');
      return monthClosingRates[monthKey] || currentRefRate;
    };

    const getMonthRecord = (date: Date) => {
      const monthKey = dayjs(date).format('YYYY-MM');
      if (!monthlyHistory[monthKey]) {
        monthlyHistory[monthKey] = {
          month: dayjs(date).format('MMMM YYYY'),
          revaluedSales: 0,
          revaluedCOGS: 0,
          revaluedExpenses: 0,
          operatingProfit: 0,
          inflationLoss: 0,
          realProfit: 0,
          closingRateUsed: getMonthRate(date),
        };
      }
      return monthlyHistory[monthKey];
    };

    // 3. Process Sales
    sales.forEach((sale) => {
      const dateStr = dayjs(sale.createdAt).format('YYYY-MM-DD');
      const m = getMonthRecord(sale.createdAt);
      const closingRate = getMonthRate(sale.createdAt);

      // Use revalueSaleByPayments (Target VES) using CLOSING RATE
      const { totalInTarget: saleRevaluedVES, breakdown: methodPayments } =
        this.revalueSaleByPayments(
          sale,
          closingRate,
          1, // crossRateFactor is 1 since target is VES
          true, // target is VES
          allCurrencies,
        );

      m.revaluedSales += saleRevaluedVES;
      totalRevaluedVES += saleRevaluedVES;

      const historicalRate =
        Number(sale.exchangeRate) && Number(sale.exchangeRate) !== 1
          ? Number(sale.exchangeRate)
          : closingRate;

      // Process method breakdown and inflation loss per payment method
      Object.entries(methodPayments).forEach(([method, amountInVES]) => {
        const paymentParts = (sale.paymentMethod || '').split(', ');
        const match = paymentParts.find((p) =>
          p.toUpperCase().startsWith(method),
        );
        if (match) {
          const parts = match.split(':');
          const nominalAmountAtTime =
            parts.length > 1 ? Number(parts[1]) : Number(sale.total);

          const isDivisa =
            method === 'ZELLE' ||
            method === 'USDT' ||
            method === 'UDT' ||
            method.includes('_UDT') ||
            method.includes('_USD') ||
            method.startsWith('CURRENCY_') ||
            (method.startsWith('ACCOUNT_CREDIT_') &&
              method !== 'ACCOUNT_CREDIT');

          if (!isDivisa) {
            // Loss is (Nominal / Historical * Closing) - Nominal
            const loss =
              (nominalAmountAtTime / historicalRate) * closingRate -
              nominalAmountAtTime;
            m.inflationLoss += loss;
            totalInflationLoss += loss;

            if (!methodBreakdown[method])
              methodBreakdown[method] = { nominal: 0, revalued: 0, loss: 0 };
            methodBreakdown[method].nominal += nominalAmountAtTime;
            methodBreakdown[method].revalued += nominalAmountAtTime + loss;
            methodBreakdown[method].loss += loss;

            if (!dailyData[dateStr])
              dailyData[dateStr] = { nominal: 0, revalued: 0, loss: 0 };
            dailyData[dateStr].nominal += nominalAmountAtTime;
            dailyData[dateStr].revalued += nominalAmountAtTime + loss;
            dailyData[dateStr].loss += loss;
          } else {
            // Divisa: value is preserved. Nominal in report context = Revalued.
            if (!methodBreakdown[method])
              methodBreakdown[method] = { nominal: 0, revalued: 0, loss: 0 };
            methodBreakdown[method].nominal += amountInVES;
            methodBreakdown[method].revalued += amountInVES;

            if (!dailyData[dateStr])
              dailyData[dateStr] = { nominal: 0, revalued: 0, loss: 0 };
            dailyData[dateStr].nominal += amountInVES;
            dailyData[dateStr].revalued += amountInVES;
          }
        }
      });

      // COGS Revaluation using Closing Rate
      sale.items.forEach((item) => {
        let itemCostInVES = Number(item.cost || 0);
        if (itemCostInVES === 0 && item.product) {
          const productRate = item.product.currency?.isPrimary
            ? 1
            : Number(item.product.currency?.exchangeRate || 1);
          itemCostInVES = Number(item.product.costPrice || 0) * productRate;
        }
        const itemTotalCostRevalued =
          itemCostInVES *
          Number(item.quantity) *
          (closingRate / currentRefRate);
        m.revaluedCOGS += itemTotalCostRevalued;
      });
    });

    // 4. Process Returns
    allReturns.forEach((ret) => {
      const m = getMonthRecord(ret.createdAt);
      const closingRate = getMonthRate(ret.createdAt);
      const historicalRate =
        Number(ret.originalSale?.exchangeRate) &&
          Number(ret.originalSale?.exchangeRate) !== 1
          ? Number(ret.originalSale?.exchangeRate)
          : closingRate;

      if (
        ret.refundAmount &&
        Number(ret.refundAmount) > 0 &&
        ret.refundMethod
      ) {
        const method = ret.refundMethod.toUpperCase();
        const isDivisa =
          method === 'ZELLE' ||
          method === 'USDT' ||
          method === 'UDT' ||
          method.includes('_UDT') ||
          method.includes('_USD') ||
          method.startsWith('CURRENCY_');

        if (!isDivisa) {
          const nominalVES = Number(ret.refundAmount);
          const revaluedVES = (nominalVES / historicalRate) * closingRate;
          const loss = revaluedVES - nominalVES;

          totalRevaluedVES -= revaluedVES;
          totalInflationLoss -= loss;
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
        } else {
          const amountVES = Number(ret.refundAmount) * historicalRate;
          // For USD returns, we subtract the amount at the historical rate?
          // revalueSaleByPayments used closingRate. Let's be consistent.
          const revaluedVES =
            Number(ret.refundAmount) *
            (Number(ret.originalSale?.exchangeRate) || closingRate);
          // Actually the return revaluation should also use the closingRate.
          // To keep it simple, it's Divisa, value preserved.
          const amountRevalued = Number(ret.refundAmount) * closingRate;
          totalRevaluedVES -= amountRevalued;
        }
      }

      const returnedValueVES = ret.items.reduce(
        (sum, item) => sum + Number(item.total || 0),
        0,
      );
      const returnedValueRevaluedVES =
        (returnedValueVES / historicalRate) * closingRate;
      m.revaluedSales -= returnedValueRevaluedVES;

      if (this.SELLABLE_RETURN_REASONS.includes(ret.reason)) {
        ret.items.forEach((item) => {
          const productRate = item.product.currency?.isPrimary
            ? 1
            : Number(item.product.currency?.exchangeRate || 1);
          const itemCostInVES =
            Number(item.product.costPrice || 0) *
            productRate *
            Number(item.quantity);
          m.revaluedCOGS -= itemCostInVES * (closingRate / currentRefRate);
        });
      }

      if (ret.returnType.startsWith('EXCHANGE')) {
        const replacementsVES = ret.replacementItems.reduce(
          (sum, item) => sum + Number(item.total || 0),
          0,
        );
        const replacementsRevaluedVES =
          (replacementsVES / historicalRate) * closingRate;
        m.revaluedSales += replacementsRevaluedVES;
        ret.replacementItems.forEach((item) => {
          const productRate = item.product.currency?.isPrimary
            ? 1
            : Number(item.product.currency?.exchangeRate || 1);
          const itemCostInVES =
            Number(item.product.costPrice || 0) *
            productRate *
            Number(item.quantity);
          m.revaluedCOGS += itemCostInVES * (closingRate / currentRefRate);
        });
      }
    });

    // 5. Process Inventory Losses
    inventoryLosses.forEach((adj) => {
      const m = getMonthRecord(adj.createdAt);
      const closingRate = getMonthRate(adj.createdAt);
      const productRate = adj.product.currency?.isPrimary
        ? 1
        : Number(adj.product.currency?.exchangeRate || 1);
      const lossCostInVES =
        Number(adj.product.costPrice || 0) * productRate * Number(adj.quantity);
      m.revaluedCOGS += lossCostInVES * (closingRate / currentRefRate);
    });

    // 6. Process Expenses
    expenses.forEach((exp) => {
      const m = getMonthRecord(exp.date);
      const closingRate = getMonthRate(exp.date);
      const eRate = Number(exp.exchangeRate) || 1;
      const valInVES =
        exp.currencyCode === 'VES'
          ? Number(exp.amount)
          : Number(exp.amount) * eRate;
      const expHistoricalRate = eRate !== 1 ? eRate : closingRate;
      m.revaluedExpenses += (valInVES / expHistoricalRate) * closingRate;
    });

    // 7. Finalize
    const finalMonthlyHistory = Object.values(monthlyHistory)
      .map((m) => {
        const operatingProfit =
          m.revaluedSales - m.revaluedCOGS - m.revaluedExpenses;
        return {
          ...m,
          operatingProfit,
          realProfit: operatingProfit - m.inflationLoss,
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));

    // SUMMARY CONSISTENCY: totalRevaluedVES must equal the sum of monthly revalued sales
    // to match the net volume calculation in Finance and COGS reports.
    const summaryRevaluedVES = Object.values(monthlyHistory).reduce(
      (sum, m) => sum + m.revaluedSales,
      0,
    );
    const totalLossVES = totalInflationLoss;
    const summaryNominal = summaryRevaluedVES - totalLossVES;

    return {
      summary: {
        totalNominalVES: summaryNominal,
        totalRevaluedVES: summaryRevaluedVES,
        totalLossVES,
        lossPercentage:
          summaryRevaluedVES > 0 ? (totalLossVES / summaryRevaluedVES) * 100 : 0,
      },
      methodBreakdown: Object.entries(methodBreakdown).map(
        ([method, data]) => ({ method, ...data }),
      ),
      dailyData: Object.entries(dailyData)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, data]) => ({
          date: dayjs(date).format('DD/MM'),
          ...data,
        })),
      monthlyHistory: finalMonthlyHistory,
    };
  }

  async getWeeklyPerformance(
    currencyCode: string = 'VES',
    startDate?: string,
    endDate?: string,
  ) {
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
      if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
    } else {
      dateFilter.gte = dayjs().startOf('month').toDate();
    }

    const allCurrencies = await this.prisma.currency.findMany({
      where: { active: true },
    });
    const targetCurrency = allCurrencies.find((c) => c.code === currencyCode);

    const companySettings = await this.prisma.companySettings.findFirst({
      include: { preferredSecondaryCurrency: true },
    });
    const refCurrency = companySettings?.preferredSecondaryCurrency;
    const currentRefRate = Number(refCurrency?.exchangeRate || 1);

    let crossRateFactor = 1;
    if (currencyCode === 'VES') {
      crossRateFactor = currentRefRate;
    } else if (
      targetCurrency &&
      refCurrency &&
      targetCurrency.code !== refCurrency.code
    ) {
      const tr = Number(targetCurrency.exchangeRate || 1);
      if (tr > 0) crossRateFactor = currentRefRate / tr;
    }

    const sales = await this.prisma.sale.findMany({
      where: { active: true, createdAt: dateFilter },
      select: {
        total: true,
        createdAt: true,
        exchangeRate: true,
        paymentMethod: true,
      },
    });

    // Initialize weekdays (0=Sunday, 1=Monday, ... 6=Saturday)
    const dayNames = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];
    const performance: Record<
      number,
      { day: string; total: number; count: number }
    > = {};

    for (let i = 0; i < 7; i++) {
      performance[i] = { day: dayNames[i], total: 0, count: 0 };
    }

    // 2.1 Determine "Closing Rates" for each month
    const monthClosingRates = this.calculateMonthClosingRates(
      sales,
      currentRefRate,
    );
    const getMonthRate = (date: Date) => {
      const monthKey = dayjs(date).format('YYYY-MM');
      return monthClosingRates[monthKey] || currentRefRate;
    };

    sales.forEach((sale) => {
      const dayIndex = dayjs(sale.createdAt).day();
      const closingRate = getMonthRate(sale.createdAt);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;

      const { totalInTarget } = this.revalueSaleByPayments(
        sale,
        closingRate,
        monthCrossRateFactor,
        currencyCode === 'VES',
        allCurrencies,
      );

      performance[dayIndex].total += totalInTarget;
      performance[dayIndex].count += 1;
    });

    const results = Object.values(performance);
    const totalSalesSum = results.reduce((sum, d) => sum + d.total, 0);
    const averageSales = totalSalesSum / 7;

    return results.map((d) => {
      let status: 'HIGH' | 'AVERAGE' | 'LOW' = 'AVERAGE';
      if (d.total > averageSales * 1.2) status = 'HIGH';
      else if (d.total < averageSales * 0.8) status = 'LOW';

      return {
        ...d,
        status,
        percentage: totalSalesSum > 0 ? (d.total / totalSalesSum) * 100 : 0,
      };
    });
  }

  async getMonthlyDailyPerformance(
    currencyCode: string = 'VES',
    startDate?: string,
    endDate?: string,
  ) {
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
      if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
    } else {
      dateFilter.gte = dayjs().startOf('month').toDate();
    }

    const allCurrencies = await this.prisma.currency.findMany({
      where: { active: true },
    });
    const targetCurrency = allCurrencies.find((c) => c.code === currencyCode);

    const companySettings = await this.prisma.companySettings.findFirst({
      include: { preferredSecondaryCurrency: true },
    });
    const refCurrency = companySettings?.preferredSecondaryCurrency;
    const currentRefRate = Number(refCurrency?.exchangeRate || 1);

    let crossRateFactor = 1;
    if (currencyCode === 'VES') {
      crossRateFactor = currentRefRate;
    } else if (
      targetCurrency &&
      refCurrency &&
      targetCurrency.code !== refCurrency.code
    ) {
      const tr = Number(targetCurrency.exchangeRate || 1);
      if (tr > 0) crossRateFactor = currentRefRate / tr;
    }

    const sales = await this.prisma.sale.findMany({
      where: { active: true, createdAt: dateFilter },
      select: {
        total: true,
        createdAt: true,
        exchangeRate: true,
        paymentMethod: true,
      },
    });

    // Use dayjs to get the month and year of the filter
    const baseDate = startDate ? dayjs(startDate) : dayjs();
    const daysInMonth = baseDate.daysInMonth();

    const performance: Record<
      number,
      { day: number; total: number; count: number }
    > = {};
    for (let i = 1; i <= daysInMonth; i++) {
      performance[i] = { day: i, total: 0, count: 0 };
    }

    // 2.1 Determine "Closing Rates" for each month
    const monthClosingRates = this.calculateMonthClosingRates(
      sales,
      currentRefRate,
    );
    const getMonthRate = (date: Date) => {
      const monthKey = dayjs(date).format('YYYY-MM');
      return monthClosingRates[monthKey] || currentRefRate;
    };

    sales.forEach((sale) => {
      const dayOfMonth = dayjs(sale.createdAt).date();
      if (performance[dayOfMonth]) {
        const closingRate = getMonthRate(sale.createdAt);
        const monthCrossRateFactor =
          currencyCode === 'VES' ? closingRate : crossRateFactor;

        const { totalInTarget } = this.revalueSaleByPayments(
          sale,
          closingRate,
          monthCrossRateFactor,
          currencyCode === 'VES',
          allCurrencies,
        );

        performance[dayOfMonth].total += totalInTarget;
        performance[dayOfMonth].count += 1;
      }
    });

    const results = Object.values(performance);
    const activeDays = results.filter((d) => d.total > 0).length || 1;
    const totalSalesSum = results.reduce((sum, d) => sum + d.total, 0);
    const averageSales = totalSalesSum / activeDays;

    return results.map((d) => {
      let status: 'HIGH' | 'AVERAGE' | 'LOW' = 'AVERAGE';
      if (d.total > averageSales * 1.2) status = 'HIGH';
      else if (d.total < averageSales * 0.8) status = 'LOW';
      if (d.total === 0) status = 'LOW';

      return {
        ...d,
        status,
        percentage: totalSalesSum > 0 ? (d.total / totalSalesSum) * 100 : 0,
      };
    });
  }
  async getExpenseStats(
    currencyCode: string = 'VES',
    startDate?: string,
    endDate?: string,
  ) {
    const dateFilter: any = {};

    if (startDate || endDate) {
      if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
      if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
    } else {
      // Default to current month
      dateFilter.gte = dayjs().startOf('month').toDate();
    }

    const allCurrencies = await this.prisma.currency.findMany({
      where: { active: true },
    });
    const targetCurrency = allCurrencies.find((c) => c.code === currencyCode);
    const targetRate = Number(targetCurrency?.exchangeRate || 1);
    const conversionRate = currencyCode === 'VES' ? 1 : targetRate;

    // 1. Get Reference Currency Info for Cross-Rate logic (if needed for old expenses)
    const companySettings = await this.prisma.companySettings.findFirst({
      include: { preferredSecondaryCurrency: true },
    });
    const refCurrency = companySettings?.preferredSecondaryCurrency;
    const currentRefRate = Number(refCurrency?.exchangeRate || 1);

    let crossRateFactor = 1;
    if (currencyCode === 'VES') {
      crossRateFactor = currentRefRate;
    } else if (
      targetCurrency &&
      refCurrency &&
      targetCurrency.code !== refCurrency.code
    ) {
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
        description: true,
      },
    });

    const expensesByCategory: Record<string, number> = {};
    const dailyExpenses: Record<string, number> = {};
    let totalExpenses = 0;

    expenses.forEach((e) => {
      const val = Number(e.amount);
      const eCurrency = allCurrencies.find((c) => c.code === e.currencyCode);
      const isLocal = !eCurrency || eCurrency.isPrimary;

      let expenseValueTarget = 0;
      if (currencyCode === 'VES' && isLocal) {
        // VES Expense -> Nominal value
        expenseValueTarget = val;
      } else {
        // Foreign Expense or Target is Foreign -> Revalued
        const currentCurrencyRate = eCurrency?.isPrimary
          ? 1
          : Number(eCurrency?.exchangeRate || 1);
        expenseValueTarget =
          ((val * currentCurrencyRate) / currentRefRate) * crossRateFactor;
      }

      totalExpenses += expenseValueTarget;

      // Group by Category
      expensesByCategory[e.category] =
        (expensesByCategory[e.category] || 0) + expenseValueTarget;

      // Group by Date
      const dateStr = dayjs(e.date).format('YYYY-MM-DD');
      dailyExpenses[dateStr] =
        (dailyExpenses[dateStr] || 0) + expenseValueTarget;
    });

    // 3. Fetch Total Sales for Comparison
    const sales = await this.prisma.sale.findMany({
      where: { active: true, createdAt: dateFilter },
      select: {
        total: true,
        paymentMethod: true,
        exchangeRate: true,
        createdAt: true,
      },
    });

    // Use closing rates for comparison sales consistency
    const monthClosingRates = this.calculateMonthClosingRates(
      sales,
      currentRefRate,
    );
    const getMonthRate = (date: Date) => {
      const monthKey = dayjs(date).format('YYYY-MM');
      return monthClosingRates[monthKey] || currentRefRate;
    };

    let totalSales = 0;
    sales.forEach((sale) => {
      const closingRate = getMonthRate(sale.createdAt);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;

      const { totalInTarget } = this.revalueSaleByPayments(
        sale,
        closingRate,
        monthCrossRateFactor,
        currencyCode === 'VES',
        allCurrencies,
      );
      totalSales += totalInTarget;
    });

    // B. Returns & Replacements
    const returns = await this.prisma.return.findMany({
      where: { status: 'COMPLETED', createdAt: dateFilter },
      include: { items: true, replacementItems: true },
    });

    returns.forEach((ret) => {
      const retValVES = ret.items.reduce((s, i) => s + Number(i.total), 0);
      const retTarget =
        currencyCode === 'VES' ? retValVES : retValVES / conversionRate;
      totalSales -= retTarget;

      if (ret.returnType.startsWith('EXCHANGE')) {
        const repValVES = ret.replacementItems.reduce(
          (s, i) => s + Number(i.total),
          0,
        );
        const repTarget =
          currencyCode === 'VES' ? repValVES : repValVES / conversionRate;
        totalSales += repTarget;
      }
    });

    return {
      totalSales: Number(totalSales.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      expensesByCategory: Object.entries(expensesByCategory)
        .map(([category, amount]) => ({
          category,
          amount: Number(amount.toFixed(2)),
          percentageOfSales:
            totalSales > 0
              ? Number(((amount / totalSales) * 100).toFixed(2))
              : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
      dailyExpenses: Object.entries(dailyExpenses).map(([date, amount]) => ({
        date: dayjs(date).format('DD/MM'),
        amount: Number(amount.toFixed(2)),
      })),
    };
  }

  async getHourlyPerformance(
    currencyCode: string = 'VES',
    startDate?: string,
    endDate?: string,
    includeSundays: boolean = false,
  ) {
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = dayjs(startDate).startOf('day').toDate();
      if (endDate) dateFilter.lte = dayjs(endDate).endOf('day').toDate();
    } else {
      dateFilter.gte = dayjs().startOf('month').toDate();
    }

    const allCurrencies = await this.prisma.currency.findMany({
      where: { active: true },
    });
    const targetCurrency = allCurrencies.find((c) => c.code === currencyCode);

    const companySettings = await this.prisma.companySettings.findFirst({
      include: { preferredSecondaryCurrency: true },
    });
    const refCurrency = companySettings?.preferredSecondaryCurrency;
    const currentRefRate = Number(refCurrency?.exchangeRate || 1);

    let crossRateFactor = 1;
    if (currencyCode === 'VES') {
      crossRateFactor = currentRefRate;
    } else if (
      targetCurrency &&
      refCurrency &&
      targetCurrency.code !== refCurrency.code
    ) {
      const tr = Number(targetCurrency.exchangeRate || 1);
      if (tr > 0) crossRateFactor = currentRefRate / tr;
    }

    const sales = await this.prisma.sale.findMany({
      where: { active: true, createdAt: dateFilter },
      select: {
        total: true,
        createdAt: true,
        exchangeRate: true,
        paymentMethod: true,
      },
    });

    // Initialize hours (0-23)
    const performance: Record<
      number,
      { hour: number; total: number; count: number }
    > = {};
    for (let i = 0; i < 24; i++) {
      performance[i] = { hour: i, total: 0, count: 0 };
    }

    // 2.1 Determine "Closing Rates" for each month
    const monthClosingRates = this.calculateMonthClosingRates(
      sales,
      currentRefRate,
    );
    const getMonthRate = (date: Date) => {
      const monthKey = dayjs(date).format('YYYY-MM');
      return monthClosingRates[monthKey] || currentRefRate;
    };

    sales.forEach((sale) => {
      const saleDate = dayjs(sale.createdAt);
      const dayOfWeek = saleDate.day(); // 0 = Sunday

      if (!includeSundays && dayOfWeek === 0) return;

      const hour = saleDate.hour();
      const closingRate = getMonthRate(sale.createdAt);
      const monthCrossRateFactor =
        currencyCode === 'VES' ? closingRate : crossRateFactor;

      const { totalInTarget } = this.revalueSaleByPayments(
        sale,
        closingRate,
        monthCrossRateFactor,
        currencyCode === 'VES',
        allCurrencies,
      );

      performance[hour].total += totalInTarget;
      performance[hour].count += 1;
    });

    const results = Object.values(performance);
    const totalSalesSum = results.reduce((sum, h) => sum + h.total, 0);

    // Find peak hour
    const peakHour = results.reduce(
      (prev, current) => (prev.total > current.total ? prev : current),
      results[0],
    );

    return {
      data: results.map((h) => ({
        ...h,
        label: `${h.hour}:00`,
        percentage: totalSalesSum > 0 ? (h.total / totalSalesSum) * 100 : 0,
      })),
      stats: {
        totalSalesSum,
        peakHour: peakHour.hour,
        peakAmount: peakHour.total,
        excludedSundays: !includeSundays,
      },
    };
  }

  /**
   * Helper to calculate closing rates for each month based on sales history.
   */
  private calculateMonthClosingRates(
    sales: any[],
    currentRefRate: number,
  ): Record<string, number> {
    const monthClosingRates: Record<string, number> = {};
    const currentMonthKey = dayjs().format('YYYY-MM');
    const monthDates: Record<string, Date> = {};

    sales.forEach((sale) => {
      const monthKey = dayjs(sale.createdAt).format('YYYY-MM');
      const rate = Number(sale.exchangeRate) || currentRefRate;
      if (
        !monthClosingRates[monthKey] ||
        dayjs(sale.createdAt).isAfter(dayjs(monthDates[monthKey]))
      ) {
        monthClosingRates[monthKey] = rate;
        monthDates[monthKey] = sale.createdAt;
      }
    });

    // Override current month with real-time rate
    monthClosingRates[currentMonthKey] = currentRefRate;
    return monthClosingRates;
  }

  /**
   * Helper to revalue a sale based on its payment methods.
   * Treats Divisas as value-preserved (converted at current rate)
   * Treats Bolivares as nominal (converted at current rate for foreign reports)
   */
  private revalueSaleByPayments(
    sale: any,
    currentRefRate: number,
    crossRateFactor: number,
    isTargetVES: boolean,
    currencies: any[] = [],
  ) {
    const paymentStr = sale.paymentMethod || 'CASH';
    const parts = paymentStr.split(', ');
    const saleNominalTotal = Number(sale.total);
    const saleRate = Number(sale.exchangeRate) || currentRefRate;

    let totalInTarget = 0;
    const breakdown: Record<string, number> = {};
    const typeBreakdown: Record<'LOCAL' | 'FOREIGN', number> = {
      LOCAL: 0,
      FOREIGN: 0,
    };

    parts.forEach((p) => {
      const subparts = p.trim().split(':');
      const method = subparts[0].trim().toUpperCase();
      const subpartsLength = subparts.length;

      let rawAmount = saleNominalTotal;
      if (subpartsLength > 1) {
        rawAmount = parseFloat(subparts[1]);
      } else if (parts.length > 1) {
        rawAmount = saleNominalTotal / parts.length;
      }

      let isForeign =
        method === 'ZELLE' ||
        method === 'USDT' ||
        method === 'UDT' || // Backwards compatibility for typo
        method.startsWith('CURRENCY_') ||
        (method.startsWith('ACCOUNT_CREDIT_') && method !== 'ACCOUNT_CREDIT');

      // More precise detection: check if method starts with CURRENCY_ and the code is not isPrimary
      if (method.startsWith('CURRENCY_')) {
        const code = method.replace('CURRENCY_', '');
        const curr = currencies.find((c) => c.code === code || c.id === code);
        if (curr && curr.isPrimary) isForeign = false;
      }

      let paymentVES = 0;
      let paymentUSD = 0;

      if (isForeign) {
        // For foreign methods, rawAmount is the divisa (e.g. 10.00 for $10)
        // We revalue using TODAY's rates
        let foreignRate = currentRefRate; // Default to USD
        if (method.startsWith('CURRENCY_')) {
          const code = method.replace('CURRENCY_', '');
          const curr = currencies.find((c) => c.code === code || c.id === code);
          if (curr) foreignRate = Number(curr.exchangeRate || currentRefRate);
        } else if (method.startsWith('ACCOUNT_CREDIT_')) {
          const code = method.replace('ACCOUNT_CREDIT_', '');
          const curr = currencies.find((c) => c.code === code || c.id === code);
          if (curr) foreignRate = Number(curr.exchangeRate || currentRefRate);
        }

        // If rawAmount looks like BS (e.g. 300 for a $10 sale), it was mislabeled
        const expectedTotalInUSD = saleNominalTotal / saleRate;
        const isLikelyMisrepresented =
          rawAmount > expectedTotalInUSD * 1.5 && rawAmount > 5;

        if (isLikelyMisrepresented) {
          paymentVES = rawAmount;
          paymentUSD = rawAmount / currentRefRate;
        } else {
          // Correct logic: amount is divisa. revalue to USD today then to target.
          paymentUSD = (rawAmount * foreignRate) / currentRefRate;
          paymentVES = rawAmount * foreignRate;
        }
      } else {
        // Local payment: Use nominal Bs directly (no revaluation)
        paymentVES = rawAmount;
        paymentUSD = rawAmount / currentRefRate;
      }

      const amountInTarget = isTargetVES
        ? paymentVES
        : paymentUSD * crossRateFactor;

      totalInTarget += amountInTarget;
      breakdown[method] = (breakdown[method] || 0) + amountInTarget;
      typeBreakdown[isForeign ? 'FOREIGN' : 'LOCAL'] += amountInTarget;
    });

    return { totalInTarget, breakdown, typeBreakdown };
  }
}
