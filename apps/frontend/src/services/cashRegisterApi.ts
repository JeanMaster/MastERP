import { api } from './apiConfig';

/**
 * Interface representing a physical cash register.
 */
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

/**
 * Interface representing a financial movement within a cash session.
 */
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

/**
 * Interface representing a physical count of cash (breakdown).
 */
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

/**
 * Interface representing a cash register session.
 */
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

/**
 * DTO for opening a new session.
 */
export interface OpenSessionDto {
    registerId: string;
    openingBalance?: number;
    openedBy?: string;
    cashierId?: string;
    openingNotes?: string;
    items?: CashCountItemDto[];
    exchangeRate?: number;
}

/**
 * DTO for an individual cash count item.
 */
export interface CashCountItemDto {
    denominationId: string;
    quantity: number;
}

/**
 * DTO for closing a session.
 */
export interface CloseSessionDto {
    actualBalance: number;
    closedBy?: string;
    closingNotes?: string;
    items?: CashCountItemDto[];
    exchangeRate?: number;
}

/**
 * DTO for creating a manual movement.
 */
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

/**
 * API service for cash register and session management.
 */
export const cashRegisterApi = {
    /**
     * Retrieves the main cash register.
     */
    getMainRegister: async (): Promise<CashRegister> => {
        const { data } = await api.get('/cash-register/main');
        return data;
    },

    /**
     * Opens a new cash session.
     */
    openSession: async (dto: OpenSessionDto): Promise<CashSession> => {
        const { data } = await api.post('/cash-register/sessions/open', dto);
        return data;
    },

    /**
     * Directly closes a cash session.
     */
    closeSession: async (sessionId: string, dto: CloseSessionDto): Promise<CashSession> => {
        const { data } = await api.post(`/cash-register/sessions/${sessionId}/close`, dto);
        return data;
    },

    /**
     * Requests a session closure (Cashier action).
     */

    requestClose: async (sessionId: string, dto: CloseSessionDto): Promise<CashSession> => {
        const { data } = await api.post(`/cash-register/sessions/${sessionId}/request-close`, dto);
        return data;
    },

    /**
     * Approves a session closure (Admin action).
     */
    approveClose: async (sessionId: string, adminUser: string): Promise<CashSession> => {
        const { data } = await api.post(`/cash-register/sessions/${sessionId}/approve-close`, { adminUser });
        return data;
    },

    /**
     * Retrieves the active session for a register or cashier.
     */
    getActiveSession: async (registerId?: string, cashierId?: string): Promise<CashSession | null> => {
        const params: any = {};
        if (registerId) params.registerId = registerId;
        if (cashierId) params.cashierId = cashierId;
        const { data } = await api.get('/cash-register/sessions/active', { params });
        return data;
    },

    /**
     * Retrieves a single session by its ID.
     */
    getSession: async (id: string): Promise<CashSession> => {
        const { data } = await api.get(`/cash-register/sessions/${id}`);
        return data;
    },

    /**
     * Lists cash sessions based on filters.
     */
    listSessions: async (filters?: any): Promise<CashSession[]> => {
        const params: any = {};
        if (filters?.registerId) params.registerId = filters.registerId;
        if (filters?.status) params.status = filters.status;
        if (filters?.startDate) params.startDate = filters.startDate;
        if (filters?.endDate) params.endDate = filters.endDate;

        const { data } = await api.get('/cash-register/sessions', { params });
        return data;
    },

    /**
     * Records a manual cash movement.
     */
    createMovement: async (dto: CreateMovementDto): Promise<CashMovement> => {
        const { data } = await api.post('/cash-register/movement', dto);
        return data;
    },

    /**
     * Transfers funds from cash to treasury.
     */
    transferToTreasury: async (sessionId: string, dto: { bankAccountId: string, amount: number, description: string, performedBy?: string }): Promise<any> => {
        const { data } = await api.post(`/cash-register/sessions/${sessionId}/transfer-treasury`, dto);
        return data;
    },

    /**
     * Retrieves all active currency denominations.
     */
    getDenominations: async (): Promise<any[]> => {
        const { data } = await api.get('/cash-register/denominations');
        return data;
    },

    /**
     * Verifies an open session (Opening audit).
     */
    verifySession: async (sessionId: string, dto: any): Promise<any> => {
        const { data } = await api.post(`/cash-register/sessions/${sessionId}/verify`, dto);
        return data;
    },

    /**
     * Lists all cash registers.
     */
    listRegisters: async (): Promise<CashRegister[]> => {
        const { data } = await api.get('/cash-register/registers');
        return data;
    },

    /**
     * Creates a new cash register.
     */
    createRegister: async (data: { name: string, location?: string }): Promise<CashRegister> => {
        const { data: result } = await api.post('/cash-register/registers', data);
        return result;
    },

    /**
     * Updates an existing cash register.
     */
    updateRegister: async (id: string, data: { name?: string, location?: string, isActive?: boolean }): Promise<CashRegister> => {
        const { data: result } = await api.patch(`/cash-register/registers/${id}`, data);
        return result;
    },

    /**
     * Deletes (deactivates) a cash register.
     */
    deleteRegister: async (id: string): Promise<CashRegister> => {
        const { data } = await api.delete(`/cash-register/registers/${id}`);
        return data;
    }
};
