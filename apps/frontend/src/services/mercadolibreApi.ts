import { api, BASE_URL } from './apiConfig';

export interface MlAccount {
    id: string;
    mlUserId: string;
    username: string | null;
    updatedAt: string;
    _count: { productMappings: number };
}

export interface MlProductMapping {
    id: string;
    productId: string;
    mlItemId: string;
    mlPermalink: string | null;
    syncEnabled: boolean;
    lastSync: string | null;
    syncStatus: string | null;
    syncError: string | null;
    createdAt: string;
    updatedAt: string;
    product: {
        id: string;
        name: string;
        sku: string;
        salePrice: number;
        stock: number;
        images: string[];
    };
    mlAccount: {
        id: string;
        username: string | null;
    };
}

export interface MlCategory {
    id: string;
    name: string;
}

export const mercadolibreApi = {
    // The auth URL opens in a new tab (it's a redirect, not a JSON endpoint)
    getAuthUrl: () => {
        return `${BASE_URL}/mercadolibre/auth`;
    },

    getAccounts: async (): Promise<MlAccount[]> => {
        const { data } = await api.get('/mercadolibre/accounts');
        return data;
    },

    deleteAccount: async (id: string): Promise<void> => {
        await api.delete(`/mercadolibre/accounts/${id}`);
    },

    createMockAccount: async (): Promise<MlAccount> => {
        const { data } = await api.post('/mercadolibre/mock-accounts');
        return data;
    },

    publishProduct: async (productId: string, mlAccountId: string, overrides: any = {}): Promise<MlProductMapping> => {
        const { data } = await api.post('/mercadolibre/publish', { productId, mlAccountId, ...overrides });
        return data;
    },

    getCategories: async (parentId?: string): Promise<MlCategory[]> => {
        const url = parentId ? `/mercadolibre/categories/${parentId}` : '/mercadolibre/categories';
        const { data } = await api.get(url);
        return data;
    },

    syncProduct: async (productId: string): Promise<MlProductMapping> => {
        const { data } = await api.post(`/mercadolibre/sync/${productId}`);
        return data;
    },

    unpublishProduct: async (productId: string): Promise<void> => {
        await api.delete(`/mercadolibre/unpublish/${productId}`);
    },

    pauseProduct: async (productId: string): Promise<void> => {
        await api.put(`/mercadolibre/pause/${productId}`);
    },

    getMappings: async (mlAccountId?: string): Promise<MlProductMapping[]> => {
        const params: any = {};
        if (mlAccountId) params.mlAccountId = mlAccountId;
        const { data } = await api.get('/mercadolibre/mappings', { params });
        return data;
    },
};
