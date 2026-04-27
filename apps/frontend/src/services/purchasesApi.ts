import { api } from './apiConfig';

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
    taxAmount?: number;
    purchaseOrderId?: string;
}

export interface CreatePurchasePaymentDto {
    purchaseId: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
    notes?: string;
    paymentAmount?: number;
    currencyCode?: string;
    exchangeRate?: number;
    bankAccountId?: string;
}

export const purchasesApi = {
    /**
     * Retrieves all purchase records.
     * @returns A list of purchases.
     */
    getAll: async (): Promise<Purchase[]> => {
        const response = await api.get('/purchases');
        return response.data;
    },

    /**
     * Retrieves a single purchase record by its ID.
     * @param id The ID of the purchase.
     * @returns The purchase record.
     */
    getById: async (id: string): Promise<Purchase> => {
        const response = await api.get(`/purchases/${id}`);
        return response.data;
    },

    /**
     * Registers a new purchase from a supplier.
     * @param data The data for the new purchase.
     * @returns The created purchase record.
     */
    create: async (data: CreatePurchaseDto): Promise<Purchase> => {
        const response = await api.post('/purchases', data);
        return response.data;
    },

    /**
     * Registers a payment for an existing purchase.
     * @param data The payment data.
     * @returns The result of the payment registration.
     */
    registerPayment: async (data: CreatePurchasePaymentDto): Promise<any> => {
        const response = await api.post('/purchases/payments', data);
        return response.data;
    },
};

