import { api } from './apiConfig';

export interface CompanySettings {
    id: string;
    name: string;
    rif: string;
    logoUrl?: string;
    preferredSecondaryCurrencyId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateCompanySettingsDto {
    name: string;
    rif: string;
    logoUrl?: string;
    preferredSecondaryCurrencyId?: string;
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
