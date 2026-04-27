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
    taxAmount?: number;
    isTaxable?: boolean;
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
    taxAmount?: number;
    isTaxable?: boolean;
}

export interface UpdateExpenseDto extends Partial<CreateExpenseDto> { }

export const expensesApi = {
    /**
     * Retrieves all expenses, ordered by date descending.
     * @returns A list of expenses.
     */
    getAll: async (): Promise<Expense[]> => {
        const response = await api.get('/expenses');
        return response.data;
    },

    /**
     * Creates a new expense record.
     * @param data The data for the new expense.
     * @returns The created expense record.
     */
    create: async (data: CreateExpenseDto): Promise<Expense> => {
        const response = await api.post('/expenses', data);
        return response.data;
    },

    /**
     * Updates an existing expense record.
     * @param id The ID of the expense to update.
     * @param data The updated data.
     * @returns The updated expense record.
     */
    update: async (id: string, data: UpdateExpenseDto): Promise<Expense> => {
        const response = await api.patch(`/expenses/${id}`, data);
        return response.data;
    },

    /**
     * Deletes an expense record.
     * @param id The ID of the expense to delete.
     */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/expenses/${id}`);
    }
};
