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
        code: string;
        isPrimary: boolean;
    };
    balance: number;
    active: boolean;
    receivesPosLiquidation: boolean;
    pendingLiquidation: number;
    receivesMobilePayment: boolean;
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
    receivesPosLiquidation?: boolean;
    receivesMobilePayment?: boolean;
}

export interface UpdateBankAccountDto {
    bankName?: string;
    accountNumber?: string;
    accountType?: string;
    holderName?: string;
    active?: boolean;
    receivesPosLiquidation?: boolean;
    receivesMobilePayment?: boolean;
}

export interface LiquidatePosBatchDto {
    bankAccountId: string;
    commissionAmount: number;
    notes?: string;
}

export interface BankMovement {
    id: string;
    bankAccountId: string;
    type: 'IN' | 'OUT';
    amount: number;
    category: string;
    description: string;
    reference?: string;
    cashSessionId?: string;
    createdAt: string;
}

export interface CreateBankMovementDto {
    bankAccountId: string;
    type: 'IN' | 'OUT';
    amount: number;
    category: string;
    description: string;
    reference?: string;
    cashSessionId?: string;
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

    getHistory: async (id: string, limit?: number): Promise<BankMovement[]> => {
        const params: any = {};
        if (limit) params.limit = limit;
        const { data } = await api.get(`/banks/${id}/history`, { params });
        return data;
    },

    addMovement: async (dto: CreateBankMovementDto): Promise<BankMovement> => {
        const { data } = await api.post('/banks/movements', dto);
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

    liquidatePos: async (dto: LiquidatePosBatchDto): Promise<any> => {
        const { data } = await api.post('/banks/liquidate-pos', dto);
        return data;
    },
};
