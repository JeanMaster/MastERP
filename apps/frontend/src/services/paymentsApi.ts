import axios from 'axios';
import { BASE_URL } from './apiConfig';
import type { Invoice, Payment } from './invoicesApi';

export type { Payment };

const apiClient = axios.create({
    baseURL: BASE_URL,
});

export interface CreatePaymentDto {
    invoiceId: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
    notes?: string;
}

export const paymentsApi = {
    createPayment: async (data: CreatePaymentDto): Promise<{ payment: Payment; invoice: Invoice }> => {
        const response = await apiClient.post('/payments', data);
        return response.data;
    },

    getPaymentsByInvoice: async (invoiceId: string): Promise<Payment[]> => {
        const response = await apiClient.get(`/payments/invoice/${invoiceId}`);
        return response.data;
    },

    getAllPayments: async (): Promise<Payment[]> => {
        const response = await apiClient.get('/payments');
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/payments/${id}`);
    },
};
