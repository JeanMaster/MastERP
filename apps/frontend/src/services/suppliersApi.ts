import { api } from './apiConfig';

export interface Supplier {
    id: string;
    rif: string;
    comercialName: string;
    legalName?: string;
    contactName?: string;
    address?: string;
    phone?: string;
    email?: string;
    category?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateSupplierDto {
    rif: string;
    comercialName: string;
    legalName?: string;
    contactName?: string;
    address?: string;
    phone?: string;
    email?: string;
    category?: string;
    active?: boolean;
}

export interface UpdateSupplierDto extends Partial<CreateSupplierDto> { }

export const suppliersApi = {
    getAll: async (search?: string, active: boolean = true): Promise<Supplier[]> => {
        const params: any = { active: String(active) };
        if (search) params.search = search;

        const response = await api.get('/suppliers', { params });
        return response.data;
    },

    getById: async (id: string): Promise<Supplier> => {
        const response = await api.get(`/suppliers/${id}`);
        return response.data;
    },

    create: async (data: CreateSupplierDto): Promise<Supplier> => {
        const response = await api.post('/suppliers', data);
        return response.data;
    },

    update: async (id: string, data: UpdateSupplierDto): Promise<Supplier> => {
        const response = await api.patch(`/suppliers/${id}`, data);
        return response.data;
    },

    remove: async (id: string): Promise<Supplier> => {
        const response = await api.delete(`/suppliers/${id}`);
        return response.data;
    },
};
