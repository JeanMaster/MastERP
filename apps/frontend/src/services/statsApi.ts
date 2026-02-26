import { api } from './apiConfig';

export interface DashboardStats {
    todaySales: number;
    thisMonthSales: number;
    thisMonthSalesNominal: number;
    lastMonthSales: number;
    lastMonthSalesNominal: number;
    topProducts: { name: string; quantity: number }[];
    criticalStock: number;
    totalProducts: number;
    cashBalance: number;
    salesTrend: { date: string; sales: number }[];
    monthReturns: {
        totalReturnsValue: number;
        totalExchangeValue: number;
        totalRefundsPaid: number;
        netReplacementValue: number;
        netImpact: number;
    };
}

export interface InventoryReport {
    stockByDepartment: { department: string; units: number; value: number }[];
    lowStockProducts: { name: string; stock: number; category: { name: string } }[];
    depletionForecast: {
        name: string;
        stock: number;
        category: string;
        dailySalesVelocity: number;
        daysRemaining: number;
        unitsNeeded6Months: number;
    }[];
    totalInventoryValue: number;
}

export interface FinanceReport {
    monthlySalesTotal: number;
    monthlySalesNominal: number;
    monthlyPurchasesTotal: number;
    totalCostOfSales: number;
    totalExpenses: number;
    totalMonetaryRefunds: number;
    totalExchangeValue: number;
    paymentMethodsBreakdown: { method: string; amount: number }[];
    currencyTypeBreakdown: { LOCAL: number; FOREIGN: number };
    dailySalesData: { date: string; amount: number }[];
}

export interface BalanceEntry {
    month: string;
    income: number;
    incomeNominal: number;
    expenses: number;
    purchases: number;
    total: number;
    cogs: number;
    profitMargin: number;
    operatingCostRatio: number;
}

export interface TopProduct {
    id: string;
    name: string;
    units: number;
    profit: number;
    revenue: number;
    totalCost: number;
    margin: number;
}

export interface COGSReport {
    totalSales: number;
    totalSalesNominal: number;
    totalCOGS: number;
    totalPurchases: number;
    totalExpenses: number;
    products: {
        name: string;
        sku: string | null;
        category: string;
        quantity: number;
        totalCost: number;
        totalRevenue: number;
        inflationLoss: number;
    }[];
    totalInflationLoss: number;
}

export interface InflationReport {
    summary: {
        totalNominalVES: number;
        totalRevaluedVES: number;
        totalLossVES: number;
        lossPercentage: number;
    };
    methodBreakdown: {
        method: string;
        nominal: number;
        revalued: number;
        loss: number;
    }[];
    dailyData: {
        date: string;
        nominal: number;
        revalued: number;
        loss: number;
    }[];
    monthlyHistory: {
        month: string;
        revaluedSales: number;
        revaluedCOGS: number;
        revaluedExpenses: number;
        operatingProfit: number;
        inflationLoss: number;
        realProfit: number;
    }[];
}

export interface WeeklyPerformance {
    day: string;
    total: number;
    count: number;
    status: 'HIGH' | 'AVERAGE' | 'LOW';
    percentage: number;
}

export const statsApi = {
    getDashboardStats: async (range?: string): Promise<DashboardStats> => {
        const response = await api.get('/stats/dashboard', {
            params: { range }
        });
        return response.data;
    },

    getInventoryReport: async (currency?: string): Promise<InventoryReport> => {
        const response = await api.get('/stats/inventory', { params: { currency } });
        return response.data;
    },

    getFinanceReport: async (currency?: string, startDate?: string, endDate?: string): Promise<FinanceReport> => {
        const response = await api.get('/stats/finance', {
            params: { currency, startDate, endDate }
        });
        return response.data;
    },

    getBalanceReport: async (currency?: string): Promise<BalanceEntry[]> => {
        const response = await api.get('/stats/balance', {
            params: { currency }
        });
        return response.data;
    },

    getTopProducts: async (filters: {
        startDate?: string;
        endDate?: string;
        sortBy?: 'units' | 'profit';
        limit?: number;
        currency?: string;
    }): Promise<TopProduct[]> => {
        const response = await api.get('/stats/top-products', { params: filters });
        return response.data;
    },

    getCOGSReport: async (currency?: string, startDate?: string, endDate?: string): Promise<COGSReport> => {
        const response = await api.get('/stats/cogs', {
            params: { currency, startDate, endDate }
        });
        return response.data;
    },

    getInflationReport: async (startDate?: string, endDate?: string): Promise<InflationReport> => {
        const response = await api.get('/stats/inflation', {
            params: { startDate, endDate }
        });
        return response.data;
    },

    getWeeklyPerformance: async (currency: string, startDate?: string, endDate?: string): Promise<WeeklyPerformance[]> => {
        const response = await api.get('/stats/weekly-performance', {
            params: { currency, startDate, endDate }
        });
        return response.data;
    },

    getMonthlyDailyPerformance: async (currency: string, startDate?: string, endDate?: string): Promise<MonthlyDailyPerformance[]> => {
        const response = await api.get('/stats/monthly-daily-performance', {
            params: { currency, startDate, endDate }
        });
        return response.data;
    },

    getExpensesReport: async (currency: string, startDate?: string, endDate?: string): Promise<ExpenseReport> => {
        const response = await api.get('/stats/expenses', {
            params: { currency, startDate, endDate }
        });
        return response.data;
    },

    getHourlyPerformance: async (currency: string, includeSundays: boolean, startDate?: string, endDate?: string): Promise<HourlyPerformanceResponse> => {
        const response = await api.get('/stats/hourly-performance', {
            params: { currency, includeSundays, startDate, endDate }
        });
        return response.data;
    },
};

export interface HourlyPerformanceResponse {
    data: {
        hour: number;
        label: string;
        total: number;
        count: number;
        percentage: number;
    }[];
    stats: {
        totalSalesSum: number;
        peakHour: number;
        peakAmount: number;
        excludedSundays: boolean;
    };
}

export interface ExpenseReport {
    totalSales: number;
    totalExpenses: number;
    expensesByCategory: {
        category: string;
        amount: number;
        percentageOfSales: number;
    }[];
    dailyExpenses: {
        date: string;
        amount: number;
    }[];
}

export interface MonthlyDailyPerformance {
    day: number;
    total: number;
    count: number;
    status: 'HIGH' | 'AVERAGE' | 'LOW';
    percentage: number;
}
