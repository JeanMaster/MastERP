import axios from 'axios';

import { BASE_URL as API_URL } from './apiConfig';

export interface PurchaseItem {
    id: string;
    productId: string;
    product: {
        id: string;
        name: string;
        sku: string;
    };
    quantity: number;
    cost: number;
    total: number;
    oldCost?: number;
}

export interface Purchase {
    id: string;
    supplierId: string;
    supplier: {
        id: string;
        comercialName: string;
        rif: string;
    };
    invoiceDate: string;
    invoiceNumber?: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    currencyCode: string;
    exchangeRate: number;
    status: string;
    // Cuentas por Pagar
    paymentStatus: string;
    paidAmount: number;
    balance: number;
    dueDate?: string;
    items: PurchaseItem[];
    payments?: any[]; // Simplified for now
    createdAt: string;
}

export interface CreatePurchaseItemDto {
    productId: string;
    quantity: number;
    cost: number;
}

export interface CreatePurchaseDto {
    supplierId: string;
    invoiceDate: Date;
    invoiceNumber?: string;
    items: CreatePurchaseItemDto[];
    currencyCode?: string;
    exchangeRate?: number;
    // Cuentas por Pagar
    paymentStatus?: string;
    paidAmount?: number;
    dueDate?: Date;
    purchaseOrderId?: string;
}

export interface CreatePurchasePaymentDto {
    purchaseId: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
    notes?: string;
}

export const purchasesApi = {
    getAll: async (): Promise<Purchase[]> => {
        const response = await axios.get(`${API_URL}/purchases`);
        return response.data;
    },

    getById: async (id: string): Promise<Purchase> => {
        const response = await axios.get(`${API_URL}/purchases/${id}`);
        return response.data;
    },

    create: async (data: CreatePurchaseDto): Promise<Purchase> => {
        const response = await axios.post(`${API_URL}/purchases`, data);
        return response.data;
    },

    registerPayment: async (data: CreatePurchasePaymentDto): Promise<any> => {
        const response = await axios.post(`${API_URL}/purchases/payments`, data);
        return response.data;
    },
};
