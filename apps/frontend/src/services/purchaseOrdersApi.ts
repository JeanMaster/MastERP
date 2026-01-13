import { api } from './apiConfig';

export interface PurchaseOrderItem {
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
}

export interface PurchaseOrder {
    id: string;
    supplierId: string;
    supplier: {
        id: string;
        comercialName: string;
        phone?: string;
        rif?: string;
    };
    orderDate: string;
    expectedDate?: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    currencyCode: string;
    exchangeRate: number;
    status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'SENT';
    notes?: string;
    items: PurchaseOrderItem[];
    createdAt: string;
}

export interface CreatePurchaseOrderDto {
    supplierId: string;
    items: {
        productId: string;
        quantity: number;
        cost: number;
    }[];
    orderDate?: Date;
    expectedDate?: Date;
    currencyCode?: string;
    exchangeRate?: number;
    notes?: string;
}

export const purchaseOrdersApi = {
    getAll: async () => {
        const response = await api.get<PurchaseOrder[]>('/purchase-orders');
        return response.data;
    },

    getOne: async (id: string) => {
        const response = await api.get<PurchaseOrder>(`/purchase-orders/${id}`);
        return response.data;
    },

    create: async (data: CreatePurchaseOrderDto) => {
        const response = await api.post<PurchaseOrder>('/purchase-orders', data);
        return response.data;
    },

    updateStatus: async (id: string, status: string) => {
        const response = await api.patch<PurchaseOrder>(`/purchase-orders/${id}/status`, { status });
        return response.data;
    },

    delete: async (id: string) => {
        const response = await api.delete(`/purchase-orders/${id}`);
        return response.data;
    },
};
