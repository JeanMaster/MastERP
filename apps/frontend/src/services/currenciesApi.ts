import { api } from './apiConfig';

export interface Currency {
    id: string;
    name: string;
    code: string;
    symbol: string;
    isPrimary: boolean;
    exchangeRate: number | null;
    isAutomatic?: boolean;
    apiSymbol?: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCurrencyDto {
    name: string;
    code: string;
    symbol: string;
    isPrimary: boolean;
    exchangeRate?: number;
    isAutomatic?: boolean;
    apiSymbol?: string;
}

export interface UpdateCurrencyDto {
    name?: string;
    code?: string;
    symbol?: string;
    isPrimary?: boolean;
    exchangeRate?: number;
    isAutomatic?: boolean;
    apiSymbol?: string;
}

export const currenciesApi = {
    getAll: async (): Promise<Currency[]> => {
        const { data } = await api.get('/currencies');
        return data;
    },

    getOne: async (id: string): Promise<Currency> => {
        const { data } = await api.get(`/currencies/${id}`);
        return data;
    },

    create: async (dto: CreateCurrencyDto): Promise<Currency> => {
        const { data } = await api.post('/currencies', dto);
        return data;
    },

    update: async (id: string, dto: UpdateCurrencyDto): Promise<Currency> => {
        const { data } = await api.patch(`/currencies/${id}`, dto);
        return data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/currencies/${id}`);
    },
};
