import { api } from './apiConfig';

export interface CompanySettings {
    id: string;
    name: string;
    rif: string;
    logoUrl?: string;
    preferredSecondaryCurrencyId?: string;
    taxEnabled: boolean;
    taxRate: number;
    roundingEnabled: boolean;
    roundingFactor: number;
    igtfEnabled: boolean;
    igtfRate: number;
    isSpecialTaxpayer: boolean;
    requireBankAccountForPayments: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateCompanySettingsDto {
    name: string;
    rif: string;
    logoUrl?: string;
    preferredSecondaryCurrencyId?: string;
    taxEnabled?: boolean;
    taxRate?: number;
    roundingEnabled?: boolean;
    roundingFactor?: number;
    igtfEnabled?: boolean;
    igtfRate?: number;
    isSpecialTaxpayer?: boolean;
    requireBankAccountForPayments?: boolean;
}

export const companySettingsApi = {
    getSettings: async (): Promise<CompanySettings> => {
        const { data } = await api.get('/company-settings');
        return data;
    },

    updateSettings: async (dto: UpdateCompanySettingsDto): Promise<CompanySettings> => {
        const { data } = await api.put('/company-settings', dto);
        return data;
    },
};
