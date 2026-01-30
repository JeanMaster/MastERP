import { api } from './apiConfig';

export const invoiceApi = {
    /**
     * Get the next invoice number (for display purposes)
     */
    getNextInvoiceNumber: async (): Promise<string> => {
        const response = await api.get('/invoice/next');
        return response.data.invoiceNumber;
    },

    /**
     * Get current invoice counter details
     */
    getCurrentCounter: async () => {
        const response = await api.get('/invoice/counter');
        return response.data;
    }
};
