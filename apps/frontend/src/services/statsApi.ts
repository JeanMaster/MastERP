import axios from 'axios';
import { BASE_URL } from './apiConfig';

const apiClient = axios.create({
    baseURL: BASE_URL,
});

export interface DashboardStats {
    todaySales: number;
    thisMonthSales: number;
    lastMonthSales: number;
    topProducts: { name: string; quantity: number }[];
    criticalStock: number;
    totalProducts: number;
    cashBalance: number;
    salesTrend: { date: string; sales: number }[];
}

export interface InventoryReport {
    stockByDepartment: { department: string; units: number; value: number }[];
    lowStockProducts: { name: string; stock: number; category: { name: string } }[];
    totalInventoryValue: number;
}

export interface FinanceReport {
    monthlySalesTotal: number;
    monthlyPurchasesTotal: number;
    totalCostOfSales: number;
    totalExpenses: number;
    paymentMethodsBreakdown: { method: string; amount: number }[];
    currencyTypeBreakdown: { LOCAL: number; FOREIGN: number };
    dailySalesData: { date: string; amount: number }[];
}

export interface BalanceEntry {
    month: string;
    income: number;
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
    }[];
}

export const statsApi = {
    getDashboardStats: async (range?: string): Promise<DashboardStats> => {
        const response = await apiClient.get('/stats/dashboard', {
            params: { range }
        });
        return response.data;
    },

    getInventoryReport: async (currency?: string): Promise<InventoryReport> => {
        const response = await apiClient.get('/stats/inventory', { params: { currency } });
        return response.data;
    },

    getFinanceReport: async (currency?: string, startDate?: string, endDate?: string): Promise<FinanceReport> => {
        const response = await apiClient.get('/stats/finance', {
            params: { currency, startDate, endDate }
        });
        return response.data;
    },

    getBalanceReport: async (currency?: string): Promise<BalanceEntry[]> => {
        const response = await apiClient.get('/stats/balance', {
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
        const response = await apiClient.get('/stats/top-products', { params: filters });
        return response.data;
    },

    getCOGSReport: async (currency?: string, startDate?: string, endDate?: string): Promise<COGSReport> => {
        const response = await apiClient.get('/stats/cogs', {
            params: { currency, startDate, endDate }
        });
        return response.data;
    },
};
