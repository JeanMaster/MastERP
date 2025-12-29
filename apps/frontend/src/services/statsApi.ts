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
    paymentMethodsBreakdown: { method: string; amount: number }[];
    dailySalesData: { date: string; amount: number }[];
}

export interface BalanceEntry {
    month: string;
    income: number;
    expenses: number;
    purchases: number;
    total: number;
    profitMargin: number;
    operatingCostRatio: number;
}

export const statsApi = {
    getDashboardStats: async (range?: string): Promise<DashboardStats> => {
        const response = await apiClient.get('/stats/dashboard', {
            params: { range }
        });
        return response.data;
    },

    getInventoryReport: async (): Promise<InventoryReport> => {
        const response = await apiClient.get('/stats/inventory');
        return response.data;
    },

    getFinanceReport: async (): Promise<FinanceReport> => {
        const response = await apiClient.get('/stats/finance');
        return response.data;
    },

    getBalanceReport: async (currency?: string): Promise<BalanceEntry[]> => {
        const response = await apiClient.get('/stats/balance', {
            params: { currency }
        });
        return response.data;
    },
};
