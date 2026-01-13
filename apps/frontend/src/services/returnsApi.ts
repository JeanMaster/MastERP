import { api } from './apiConfig';
import type { Product } from './productsApi';

export type ReturnType = 'REFUND' | 'EXCHANGE_SAME' | 'EXCHANGE_DIFFERENT';

export const ReturnType = {
    REFUND: 'REFUND' as ReturnType,
    EXCHANGE_SAME: 'EXCHANGE_SAME' as ReturnType,
    EXCHANGE_DIFFERENT: 'EXCHANGE_DIFFERENT' as ReturnType
};

export type ReturnReason = 'DEFECTIVE' | 'UNSATISFIED' | 'ERROR' | 'EXPIRED' | 'OTHER';

export const ReturnReason = {
    DEFECTIVE: 'DEFECTIVE' as ReturnReason,
    UNSATISFIED: 'UNSATISFIED' as ReturnReason,
    ERROR: 'ERROR' as ReturnReason,
    EXPIRED: 'EXPIRED' as ReturnReason,
    OTHER: 'OTHER' as ReturnReason
};

export type ProductCondition = 'EXCELLENT' | 'GOOD' | 'DEFECTIVE' | 'DAMAGED';

export const ProductCondition = {
    EXCELLENT: 'EXCELLENT' as ProductCondition,
    GOOD: 'GOOD' as ProductCondition,
    DEFECTIVE: 'DEFECTIVE' as ProductCondition,
    DAMAGED: 'DAMAGED' as ProductCondition
};

export type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export const ReturnStatus = {
    PENDING: 'PENDING' as ReturnStatus,
    APPROVED: 'APPROVED' as ReturnStatus,
    REJECTED: 'REJECTED' as ReturnStatus,
    COMPLETED: 'COMPLETED' as ReturnStatus
};

export interface ReturnItem {
    id: string;
    productId: string;
    product?: Product;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface CreateReturnItemDto {
    productId: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface Return {
    id: string;
    originalSaleId: string;
    creditNoteNumber: string;
    returnType: ReturnType;
    reason: ReturnReason;
    productCondition: ProductCondition;
    status: ReturnStatus;
    items: ReturnItem[];
    refundAmount: number;
    refundMethod?: string;
    notes?: string;
    requestedBy?: string;
    approvedBy?: string;
    approvedAt?: string;
    originalSale: {
        invoiceNumber: string;
        date: string;
        total: number;
        client?: {
            id: string;
            name: string;
        };
    };
    createdAt: string;
}

export interface CreateReturnDto {
    originalSaleId: string;
    returnType: ReturnType;
    reason: ReturnReason;
    productCondition: ProductCondition;
    items: CreateReturnItemDto[];
    replacementItems?: CreateReturnItemDto[];
    refundAmount: number;
    refundMethod?: string;
    notes?: string;
    requestedBy?: string;
}

export interface ReturnFilters {
    status?: string;
    returnType?: string;
    startDate?: string;
    endDate?: string;
}

export const returnsApi = {
    getAll: async (filters?: ReturnFilters): Promise<Return[]> => {
        const { data } = await api.get('/returns', { params: filters });
        return data;
    },

    getOne: async (id: string): Promise<Return> => {
        const { data } = await api.get(`/returns/${id}`);
        return data;
    },

    create: async (dto: CreateReturnDto): Promise<Return> => {
        const { data } = await api.post('/returns', dto);
        return data;
    },

    approve: async (id: string, approvedBy: string): Promise<Return> => {
        const { data } = await api.patch(`/returns/${id}/approve`, { approvedBy });
        return data;
    },

    reject: async (id: string, reason: string): Promise<Return> => {
        const { data } = await api.patch(`/returns/${id}/reject`, { reason });
        return data;
    },

    process: async (id: string): Promise<Return> => {
        const { data } = await api.post(`/returns/${id}/process`);
        return data;
    },

    validateEligibility: async (saleId: string, items: any[]): Promise<{ eligible: boolean; message?: string }> => {
        const { data } = await api.post('/returns/validate', { saleId, items });
        return data;
    }
};
