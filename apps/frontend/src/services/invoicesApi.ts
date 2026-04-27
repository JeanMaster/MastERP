import { api } from './apiConfig';

export interface Invoice {
    id: string;
    number: string;
    clientId: string;
    client?: {
        id: string;
        name: string;
    };
    saleId?: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    status: string;
    dueDate?: string;
    paidAmount: number;
    balance: number;
    currencyCode: string;
    exchangeRate: number;
    notes?: string;
    payments?: Payment[];
    createdAt: string;
    updatedAt: string;
}

export interface Payment {
    id: string;
    invoiceId: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
    createdAt: string;
}

export interface CreateInvoiceDto {
    clientId: string;
    saleId?: string;
    subtotal: number;
    discount?: number;
    tax?: number;
    total: number;
    dueDate?: string;
    notes?: string;
    currencyCode?: string;
    exchangeRate?: number;
}

export const invoicesApi = {
    /**
     * Retrieves the next available invoice number (without incrementing).
     */
    getNextInvoiceNumber: async (): Promise<string> => {
        const response = await api.get('/invoice/next');
        return response.data.invoiceNumber;
    },

    /**
     * Retrieves the current invoice counter status.
     */
    getCurrentCounter: async () => {
        const response = await api.get('/invoice/counter');
        return response.data;
    },

    /**
     * Creates a new credit invoice.
     * @param data The data for the new credit invoice.
     * @returns The created invoice record.
     */
    createCreditInvoice: async (data: CreateInvoiceDto): Promise<Invoice> => {
        const response = await api.post('/invoice', data);
        return response.data;
    },

    /**
     * Retrieves all invoices for a specific client.
     * @param clientId The ID of the client.
     * @returns A list of invoices for the client.
     */
    getClientInvoices: async (clientId: string): Promise<Invoice[]> => {
        const response = await api.get(`/invoice/client/${clientId}`);
        return response.data;
    },

    /**
     * Retrieves all pending and partially paid invoices.
     * @returns A list of pending invoices.
     */
    getPendingInvoices: async (): Promise<Invoice[]> => {
        const response = await api.get('/invoice/pending');
        return response.data;
    },

    /**
     * Retrieves all overdue invoices.
     * @returns A list of overdue invoices.
     */
    getOverdueInvoices: async (): Promise<Invoice[]> => {
        const response = await api.get('/invoice/overdue');
        return response.data;
    },

    /**
     * Retrieves a single invoice by its ID.
     * @param id The ID of the invoice.
     * @returns The invoice record.
     */
    getInvoiceById: async (id: string): Promise<Invoice> => {
        const response = await api.get(`/invoice/${id}`);
        return response.data;
    },
};
