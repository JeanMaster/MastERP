import { api } from '../../../services/apiConfig';
import type { Employee } from './employeesApi';

export interface PayrollPeriod {
    id: string;
    name: string;
    startDate: string; // ISO Date
    endDate: string;   // ISO Date
    status: 'DRAFT' | 'PROCESSED' | 'PAID';
    totalAmount: number;
    payments?: PayrollPayment[];
}

export interface PayrollPayment {
    id: string;
    employeeId: string;
    employee: Employee;
    baseSalary: number;
    totalIncome: number;
    totalDeductions: number;
    netAmount: number;
    items: PayrollPaymentItem[];
}

export interface PayrollPaymentItem {
    id: string;
    type: 'INCOME' | 'DEDUCTION';
    description: string;
    amount: number;
}

export const payrollApi = {
    findAllPeriods: async (): Promise<PayrollPeriod[]> => {
        const response = await api.get('/hr/payroll/period');
        return response.data;
    },

    findOnePeriod: async (id: string): Promise<PayrollPeriod> => {
        const response = await api.get(`/hr/payroll/period/${id}`);
        return response.data;
    },

    createPeriod: async (data: Partial<PayrollPeriod>): Promise<PayrollPeriod> => {
        const response = await api.post('/hr/payroll/period', data);
        return response.data;
    },

    generate: async (data: { payrollPeriodId: string, employeeIds?: string[], frequency?: string }): Promise<any> => {
        const response = await api.post('/hr/payroll/generate', data);
        return response.data;
    }
};
