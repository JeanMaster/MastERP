import { api } from './apiConfig';

export interface CatalogProduct {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  category: { name: string };
  department: { name: string };
  salePrice: number;
  offerPrice: number | null;
  wholesalePrice: number | null;
  currencySymbol: string;
  stock: number;
  imageUrl: string | null;
  priceInTarget: number;
  roundedPrice: number;
}

export interface CatalogCurrency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isPrimary: boolean;
  exchangeRate: number;
}

export const catalogoApi = {
  /**
   * Fetches catalog data for the given currency code.
   */
  getCatalogData: async (currencyCode: string = 'VES', categoryIds?: string[]): Promise<CatalogProduct[]> => {
    const { data } = await api.get('/catalog/data', {
      params: { currencyCode, categoryIds },
    });
    return data;
  },

  /**
   * Triggers a PDF download from the backend.
   */
  downloadPdf: async (currencyCode: string = 'VES', categoryIds?: string[]): Promise<Blob> => {
    const response = await api.get('/catalog/download', {
      params: { currencyCode, categoryIds },
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Sends the catalog PDF via WhatsApp.
   */
  sendWhatsApp: async (phone: string, currencyCode: string = 'VES', pdfBase64?: string, categoryIds?: string[]): Promise<{ success: boolean; message: string }> => {
    const { data } = await api.post('/catalog/send-whatsapp', { phone, currencyCode, pdfBase64, categoryIds });
    return data;
  },

  /**
   * Generates price tickets PDF.
   */
  generatePriceTickets: async (
    currencyCode: string,
    tickets: Array<{ productId: string; quantity: number }>,
    includeBarcode: boolean = true,
  ): Promise<Blob> => {
    const response = await api.post(
      '/catalog/price-tickets',
      { currencyCode, tickets, includeBarcode },
      { responseType: 'blob' },
    );
    return response.data;
  },
};
