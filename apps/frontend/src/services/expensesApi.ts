import { api } from './apiConfig';
import { type BankAccount } from './banksApi';

export interface Expense {
    id: string;
    description: string;
    amount: number;
    currencyCode: string;
    exchangeRate: number;
    date: string;
    category: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
    bankAccountId?: string;
    bankAccount?: BankAccount;
    createdAt: string;
    updatedAt: string;
}

export interface CreateExpenseDto {
    description: string;
    amount: number;
    currencyCode: string;
    exchangeRate: number;
    date?: string;
    category: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
    bankAccountId?: string;
}

export interface UpdateExpenseDto extends Partial<CreateExpenseDto> { }

export const expensesApi = {
    getAll: async (): Promise<Expense[]> => {
        const response = await api.get('/expenses');
        return response.data;
    },

    create: async (data: CreateExpenseDto): Promise<Expense> => {
        const response = await api.post('/expenses', data);
        return response.data;
    },

    update: async (id: string, data: UpdateExpenseDto): Promise<Expense> => {
        const response = await api.patch(`/expenses/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/expenses/${id}`);
    }
};
