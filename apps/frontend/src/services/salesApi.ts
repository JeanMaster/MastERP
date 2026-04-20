import { api } from './apiConfig';

export interface SaleItem {
    id: string;
    productId: string;
    product: {
        id: string;
        name: string;
        sku: string;
    };
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface Sale {
    id: string;
    date: string;
    invoiceNumber: string;
    clientId?: string;
    client?: {
        id: string;
        name: string;
    };
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string;
    tendered?: number;
    change?: number;
    exchangeRate: number;
    items: SaleItem[];
    active: boolean;
    createdAt: string;
    updatedAt: string;
    revaluedTotal?: number;
    netTotal?: number;
}

export interface CreateSaleDto {
    clientId?: string;
    items: {
        productId: string;
        quantity: number;
        unitPrice: number;
        total: number;
    }[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string;
    tendered?: number;
    change?: number;
    invoiceNumber?: string;
    exchangeRate?: number;
    cashSessionId?: string;
    couponId?: string;
}

export interface SalesFilters {
    startDate?: string;
    endDate?: string;
    clientId?: string;
    productId?: string;
    paymentMethod?: string;
    minAmount?: number;
    maxAmount?: number;
    invoiceNumber?: string;
}

export interface SalesResponse {
    sales: Sale[];
    summary: {
        totalVentas: number;
        ingresoBruto: number;
        ingresoNominal: number;
        descuentos: number;
        ticketPromedio: number;
    };
}

export const salesApi = {
    getAll: async (): Promise<Sale[]> => {
        const { data } = await api.get(`/sales`);
        // Handle both new format { sales: [], summary: {} } and old format []
        if (data && typeof data === 'object' && Array.isArray(data.sales)) {
            return data.sales;
        }
        return Array.isArray(data) ? data : [];
    },

    getWithFilters: async (filters: SalesFilters): Promise<SalesResponse> => {
        const params = new URLSearchParams();

        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.clientId) params.append('clientId', filters.clientId);
        if (filters.productId) params.append('productId', filters.productId);
        if (filters.paymentMethod) params.append('paymentMethod', filters.paymentMethod);
        if (filters.minAmount) params.append('minAmount', filters.minAmount.toString());
        if (filters.maxAmount) params.append('maxAmount', filters.maxAmount.toString());
        if (filters.invoiceNumber) params.append('invoiceNumber', filters.invoiceNumber);

        const { data } = await api.get(`/sales?${params.toString()}`);
        return data;
    },

    getOne: async (id: string): Promise<Sale> => {
        const { data } = await api.get(`/sales/${id}`);
        return data;
    },

    getNextInvoiceNumber: async (): Promise<string> => {
        const { data } = await api.get(`/sales/next-invoice-number`);
        return data;
    },

    reserveInvoiceNumber: async (): Promise<string> => {
        const { data } = await api.get(`/sales/reserve-invoice-number`);
        return data;
    },

    create: async (dto: CreateSaleDto): Promise<Sale> => {
        const { data } = await api.post(`/sales`, dto);
        return data;
    },

    getClientRecentPurchases: async (clientId: string, limit: number = 5): Promise<Sale[]> => {
        const { data } = await api.get(`/sales/client/${clientId}/recent?limit=${limit}`);
        return data;
    },

    updatePaymentMethod: async (id: string, paymentMethod: string): Promise<Sale> => {
        const { data } = await api.patch(`/sales/${id}/payment-method`, { paymentMethod });
        return data;
    },

    remove: async (id: string): Promise<void> => {
        await api.delete(`/sales/${id}`);
    },

    markAsUncollectible: async (id: string): Promise<void> => {
        await api.delete(`/sales/${id}/uncollectible`);
    },
};