import { api } from './apiConfig';

export interface CashRegister {
    id: string;
    name: string;
    location?: string;
    isActive: boolean;
    activeSession?: {
        id: string;
        status: 'OPEN' | 'AWAITING_CLOSE' | 'CLOSED';
        openedBy: string;
        cashierId?: string;
        openedAt: string;
        currentBalance: number;
    } | null;
}

export interface CashMovement {
    id: string;
    sessionId: string;
    type: 'SALE' | 'EXPENSE' | 'DEPOSIT' | 'WITHDRAWAL' | 'OPENING' | 'CLOSING' | 'ADJUSTMENT' | 'CHANGE';
    amount: number;
    currencyCode: string;
    exchangeRate: number;
    description: string;
    notes?: string;
    performedBy: string;
    saleId?: string;
    sale?: any;
    createdAt: string;
}

export interface SessionCashCount {
    id: string;
    sessionId: string;
    type: 'VERIFICATION' | 'CLOSING';
    currencyCode: string;
    value: number;
    quantity: number;
    total: number;
    createdAt: string;
}

export interface CashSession {
    id: string;
    registerId: string;
    register: CashRegister;
    openedBy: string;
    cashierId?: string;
    closedBy?: string;
    openedAt: string;
    closedAt?: string;
    status: 'OPEN' | 'CLOSED' | 'AWAITING_CLOSE';
    openingBalance: number;
    openingNotes?: string;
    expectedBalance?: number;
    actualBalance?: number;
    variance?: number;
    closingNotes?: string;
    movements: CashMovement[];
    sales?: any[];
    verifiedAt?: string;
    verifiedBy?: string;
    verificationDiff?: number;
    cashCounts?: SessionCashCount[];
}

export interface OpenSessionDto {
    registerId: string;
    openingBalance?: number;
    openedBy?: string;
    cashierId?: string;
    openingNotes?: string;
    items?: CashCountItemDto[];
    exchangeRate?: number;
}

export interface CashCountItemDto {
    denominationId: string;
    quantity: number;
}

export interface CloseSessionDto {
    actualBalance: number;
    closedBy?: string;
    closingNotes?: string;
    items?: CashCountItemDto[];
    exchangeRate?: number;
}

export interface CreateMovementDto {
    sessionId: string;
    type: 'EXPENSE' | 'DEPOSIT' | 'WITHDRAWAL' | 'ADJUSTMENT';
    amount: number;
    currencyCode?: string;
    description: string;
    notes?: string;
    performedBy?: string;
    exchangeRate?: number;
}

export const cashRegisterApi = {
    getMainRegister: async (): Promise<CashRegister> => {
        const { data } = await api.get('/cash-register/registers/main');
        return data;
    },

    openSession: async (dto: OpenSessionDto): Promise<CashSession> => {
        const { data } = await api.post('/cash-register/sessions/open', dto);
        return data;
    },

    closeSession: async (sessionId: string, dto: CloseSessionDto): Promise<CashSession> => {
        const { data } = await api.post(`/cash-register/sessions/${sessionId}/close`, dto);
        return data;
    },

    requestClose: async (sessionId: string, dto: CloseSessionDto): Promise<CashSession> => {
        const { data } = await api.post(`/cash-register/sessions/${sessionId}/request-close`, dto);
        return data;
    },

    approveClose: async (sessionId: string, adminUser: string): Promise<CashSession> => {
        const { data } = await api.post(`/cash-register/sessions/${sessionId}/approve-close`, { adminUser });
        return data;
    },

    getActiveSession: async (registerId?: string, cashierId?: string): Promise<CashSession | null> => {
        const params: any = {};
        if (registerId) params.registerId = registerId;
        if (cashierId) params.cashierId = cashierId;
        const { data } = await api.get('/cash-register/sessions/active', { params });
        return data;
    },

    getSession: async (id: string): Promise<CashSession> => {
        const { data } = await api.get(`/cash-register/sessions/${id}`);
        return data;
    },

    listSessions: async (filters?: any): Promise<CashSession[]> => {
        const params: any = {};
        if (filters?.registerId) params.registerId = filters.registerId;
        if (filters?.status) params.status = filters.status;
        if (filters?.startDate) params.startDate = filters.startDate;
        if (filters?.endDate) params.endDate = filters.endDate;

        const { data } = await api.get('/cash-register/sessions', { params });
        return data;
    },

    createMovement: async (dto: CreateMovementDto): Promise<CashMovement> => {
        const { data } = await api.post('/cash-register/movements', dto);
        return data;
    },

    transferToTreasury: async (sessionId: string, dto: { bankAccountId: string, amount: number, description: string, performedBy?: string }): Promise<any> => {
        const { data } = await api.post(`/cash-register/sessions/${sessionId}/transfer-to-treasury`, dto);
        return data;
    },

    getDenominations: async (): Promise<any[]> => {
        const { data } = await api.get('/cash-register/denominations');
        return data;
    },

    verifySession: async (sessionId: string, dto: any): Promise<any> => {
        const { data } = await api.post(`/cash-register/sessions/${sessionId}/verify`, dto);
        return data;
    },

    listRegisters: async (): Promise<CashRegister[]> => {
        const { data } = await api.get('/cash-register/registers');
        return data;
    },

    createRegister: async (data: { name: string, location?: string }): Promise<CashRegister> => {
        const { data: result } = await api.post('/cash-register/registers', data);
        return result;
    },

    updateRegister: async (id: string, data: { name?: string, location?: string, isActive?: boolean }): Promise<CashRegister> => {
        const { data: result } = await api.patch(`/cash-register/registers/${id}`, data);
        return result;
    },

    deleteRegister: async (id: string): Promise<CashRegister> => {
        const { data } = await api.delete(`/cash-register/registers/${id}`);
        return data;
    }
};
