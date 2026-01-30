import { api } from './apiConfig';
import type { Invoice, Payment } from './invoicesApi';

export type { Payment };

export interface CreatePaymentDto {
    invoiceId: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
    notes?: string;
}

export const paymentsApi = {
    createPayment: async (data: CreatePaymentDto): Promise<{ payment: Payment; invoice: Invoice }> => {
        const response = await api.post('/payments', data);
        return response.data;
    },

    getPaymentsByInvoice: async (invoiceId: string): Promise<Payment[]> => {
        const response = await api.get(`/payments/invoice/${invoiceId}`);
        return response.data;
    },

    getAllPayments: async (): Promise<Payment[]> => {
        const response = await api.get('/payments');
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/payments/${id}`);
    },
};
