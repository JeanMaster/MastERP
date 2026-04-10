import { api } from './apiConfig';

export interface TaxRetention {
    id: string;
    type: string;
    voucherNumber: string;
    voucherDate: string;
    amount: number;
    baseAmount: number;
    retentionPercent: number;
    invoiceId?: string;
    purchaseId?: string;
    invoice?: any;
    purchase?: any;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTaxRetentionDto {
    type: string;
    voucherNumber: string;
    voucherDate: Date;
    amount: number;
    baseAmount: number;
    retentionPercent: number;
    invoiceId?: string;
    purchaseId?: string;
}

export const taxRetentionsApi = {
    create: async (dto: CreateTaxRetentionDto): Promise<TaxRetention> => {
        const { data } = await api.post('/tax-retentions', dto);
        return data;
    },

    findAll: async (): Promise<TaxRetention[]> => {
        const { data } = await api.get('/tax-retentions');
        return data;
    },

    findOne: async (id: string): Promise<TaxRetention> => {
        const { data } = await api.get(`/tax-retentions/${id}`);
        return data;
    },

    remove: async (id: string): Promise<void> => {
        await api.delete(`/tax-retentions/${id}`);
    },

    exportTxt: async (startDate?: string, endDate?: string): Promise<string> => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        
        const { data } = await api.get(`/tax-retentions/export/txt?${params.toString()}`);
        return data;
    },
};
