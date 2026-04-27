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
    /**
     * Retrieves all active currencies.
     * @returns A list of currencies.
     */
    getAll: async (): Promise<Currency[]> => {
        const { data } = await api.get('/currencies');
        return data;
    },

    /**
     * Retrieves a single currency by its ID.
     * @param id The ID of the currency.
     * @returns The currency record.
     */
    getOne: async (id: string): Promise<Currency> => {
        const { data } = await api.get(`/currencies/${id}`);
        return data;
    },

    /**
     * Creates a new currency.
     * @param dto The data for the new currency.
     * @returns The created currency record.
     */
    create: async (dto: CreateCurrencyDto): Promise<Currency> => {
        const { data } = await api.post('/currencies', dto);
        return data;
    },

    /**
     * Updates an existing currency's information.
     * @param id The ID of the currency to update.
     * @param dto The updated data.
     * @returns The updated currency record.
     */
    update: async (id: string, dto: UpdateCurrencyDto): Promise<Currency> => {
        const { data } = await api.patch(`/currencies/${id}`, dto);
        return data;
    },

    /**
     * Deactivates a currency (soft delete).
     * @param id The ID of the currency to deactivate.
     */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/currencies/${id}`);
    },
};
