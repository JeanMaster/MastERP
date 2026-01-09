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
    createCreditInvoice: async (data: CreateInvoiceDto): Promise<Invoice> => {
        const response = await api.post('/invoice', data);
        return response.data;
    },

    getClientInvoices: async (clientId: string): Promise<Invoice[]> => {
        const response = await api.get(`/invoice/client/${clientId}`);
        return response.data;
    },

    getPendingInvoices: async (): Promise<Invoice[]> => {
        const response = await api.get('/invoice/pending');
        return response.data;
    },

    getOverdueInvoices: async (): Promise<Invoice[]> => {
        const response = await api.get('/invoice/overdue');
        return response.data;
    },

    getInvoiceById: async (id: string): Promise<Invoice> => {
        const response = await api.get(`/invoice/${id}`);
        return response.data;
    },
};
