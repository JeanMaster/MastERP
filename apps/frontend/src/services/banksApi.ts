import { api } from './apiConfig';

export interface BankAccount {
    id: string;
    bankName: string;
    accountNumber: string;
    accountType: string;
    holderName: string;
    holderId: string;
    currencyId: string;
    currency: {
        id: string;
        name: string;
        symbol: string;
        isPrimary: boolean;
    };
    balance: number;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateBankAccountDto {
    bankName: string;
    accountNumber: string;
    accountType: string;
    holderName: string;
    holderId: string;
    currencyId: string;
    initialBalance?: number;
}

export interface UpdateBankAccountDto {
    bankName?: string;
    accountNumber?: string;
    accountType?: string;
    holderName?: string;
    holderId?: string;
    currencyId?: string;
    active?: boolean;
}

export const banksApi = {
    getAll: async (search?: string): Promise<BankAccount[]> => {
        const params: any = {};
        if (search) params.search = search;
        const { data } = await api.get('/banks', { params });
        return data;
    },

    getOne: async (id: string): Promise<BankAccount> => {
        const { data } = await api.get(`/banks/${id}`);
        return data;
    },

    create: async (dto: CreateBankAccountDto): Promise<BankAccount> => {
        const { data } = await api.post('/banks', dto);
        return data;
    },

    update: async (id: string, dto: UpdateBankAccountDto): Promise<BankAccount> => {
        const { data } = await api.patch(`/banks/${id}`, dto);
        return data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/banks/${id}`);
    },
};
