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
    /**
     * Retrieves all active bank accounts.
     * @param search Optional search term (bank name, holder, or account number).
     * @returns A list of bank accounts.
     */
    getAll: async (search?: string): Promise<BankAccount[]> => {
        const params: any = {};
        if (search) params.search = search;
        const { data } = await api.get('/banks', { params });
        return data;
    },

    /**
     * Retrieves a single bank account by its ID.
     * @param id The ID of the bank account.
     * @returns The bank account record.
     */
    getOne: async (id: string): Promise<BankAccount> => {
        const { data } = await api.get(`/banks/${id}`);
        return data;
    },

    /**
     * Retrieves the movement history for a specific bank account.
     * @param id The ID of the bank account.
     * @param limit Maximum number of records to retrieve.
     * @returns A list of bank movements.
     */
    getHistory: async (id: string, limit?: number): Promise<BankMovement[]> => {
        const params: any = {};
        if (limit) params.limit = limit;
        const { data } = await api.get(`/banks/${id}/history`, { params });
        return data;
    },

    /**
     * Records a manual bank movement (manual adjustment or transfer).
     * @param dto The data for the movement.
     * @returns The created bank movement record.
     */
    addMovement: async (dto: CreateBankMovementDto): Promise<BankMovement> => {
        const { data } = await api.post('/banks/movements', dto);
        return data;
    },

    /**
     * Creates a new bank account.
     * @param dto The data for the new account.
     * @returns The created bank account record.
     */
    create: async (dto: CreateBankAccountDto): Promise<BankAccount> => {
        const { data } = await api.post('/banks', dto);
        return data;
    },

    /**
     * Updates an existing bank account's information.
     * @param id The ID of the bank account to update.
     * @param dto The updated data.
     * @returns The updated bank account record.
     */
    update: async (id: string, dto: UpdateBankAccountDto): Promise<BankAccount> => {
        const { data } = await api.patch(`/banks/${id}`, dto);
        return data;
    },

    /**
     * Deactivates a bank account (soft delete).
     * @param id The ID of the account to deactivate.
     */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/banks/${id}`);
    },

    /**
     * Liquidates a POS batch, transferring pending funds to the bank account net of commissions.
     * @param dto The liquidation data (bank account ID, commission, notes).
     * @returns The result of the liquidation.
     */
    liquidatePos: async (dto: LiquidatePosBatchDto): Promise<any> => {
        const { data } = await api.post('/banks/liquidate-pos', dto);
        return data;
    },
};
