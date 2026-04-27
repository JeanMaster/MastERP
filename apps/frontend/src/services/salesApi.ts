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
        totalSales: number;
        grossRevenue: number;
        nominalRevenue: number;
        discounts: number;
        averageTicket: number;
    };
}

export const salesApi = {
    /**
     * Retrieves all sales records.
     * @returns A list of sales.
     */
    getAll: async (): Promise<Sale[]> => {
        const { data } = await api.get(`/sales`);
        // Handle both new format { sales: [], summary: {} } and old format []
        if (data && typeof data === 'object' && Array.isArray(data.sales)) {
            return data.sales;
        }
        return Array.isArray(data) ? data : [];
    },

    /**
     * Retrieves sales records matching specific filters.
     * @param filters Filtering criteria (dates, client, product, etc.).
     * @returns Filtered sales and summary statistics.
     */
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

    /**
     * Retrieves a single sale record by its ID.
     * @param id The ID of the sale.
     * @returns The sale record.
     */
    getOne: async (id: string): Promise<Sale> => {
        const { data } = await api.get(`/sales/${id}`);
        return data;
    },

    /**
     * Retrieves the next available invoice number.
     * @returns The next invoice number string.
     */
    getNextInvoiceNumber: async (): Promise<string> => {
        const { data } = await api.get(`/sales/next-invoice-number`);
        return data;
    },

    /**
     * Reserves an invoice number for immediate use.
     * @returns The reserved invoice number string.
     */
    reserveInvoiceNumber: async (): Promise<string> => {
        const { data } = await api.get(`/sales/reserve-invoice-number`);
        return data;
    },

    /**
     * Creates a new sale record.
     * @param dto The data for the new sale.
     * @returns The created sale record.
     */
    create: async (dto: CreateSaleDto): Promise<Sale> => {
        const { data } = await api.post(`/sales`, dto);
        return data;
    },

    /**
     * Retrieves a client's recent purchases.
     * @param clientId The ID of the client.
     * @param limit Maximum number of records.
     * @returns A list of recent purchases.
     */
    getClientRecentPurchases: async (clientId: string, limit: number = 5): Promise<Sale[]> => {
        const { data } = await api.get(`/sales/client/${clientId}/recent?limit=${limit}`);
        return data;
    },

    /**
     * Updates the payment method of an existing sale.
     * @param id The ID of the sale.
     * @param paymentMethod The new payment method string.
     * @returns The updated sale record.
     */
    updatePaymentMethod: async (id: string, paymentMethod: string): Promise<Sale> => {
        const { data } = await api.patch(`/sales/${id}/payment-method`, { paymentMethod });
        return data;
    },

    /**
     * Deletes a sale record and restores stock.
     * @param id The ID of the sale to delete.
     */
    remove: async (id: string): Promise<void> => {
        await api.delete(`/sales/${id}`);
    },

    /**
     * Marks a sale as uncollectible (no stock restoral).
     * @param id The ID of the sale.
     */
    markAsUncollectible: async (id: string): Promise<void> => {
        await api.delete(`/sales/${id}/uncollectible`);
    },
};