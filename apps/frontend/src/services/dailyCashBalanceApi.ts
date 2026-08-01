import { api } from './apiConfig';

export interface DailyCashBalance {
    id: string;
    date: string;
    balance: number;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface UpsertDailyCashBalanceDto {
    date: string;
    balance: number;
    notes?: string;
}

export interface CashBalanceTransition {
    fromDate: string;
    toDate: string;
    balance: number;
    rateFrom: number;
    rateTo: number;
    loss: number;
}

export interface CashBalanceInflationImpact {
    hasEnoughData: boolean;
    daysCovered: number;
    totalLoss: number;
    bsRevenueInWindow: number;
    lossPercentageOverBsRevenue: number;
    transitions: CashBalanceTransition[];
}

export const dailyCashBalanceApi = {
    upsert: async (dto: UpsertDailyCashBalanceDto): Promise<DailyCashBalance> => {
        const response = await api.post('/daily-cash-balance', dto);
        return response.data;
    },

    getAll: async (startDate?: string, endDate?: string): Promise<DailyCashBalance[]> => {
        const response = await api.get('/daily-cash-balance', {
            params: { startDate, endDate }
        });
        return response.data;
    },

    getToday: async (): Promise<DailyCashBalance | null> => {
        const response = await api.get('/daily-cash-balance/today');
        return response.data;
    },

    getInflationImpact: async (startDate?: string, endDate?: string): Promise<CashBalanceInflationImpact> => {
        const response = await api.get('/daily-cash-balance/inflation-impact', {
            params: { startDate, endDate }
        });
        return response.data;
    },
};
