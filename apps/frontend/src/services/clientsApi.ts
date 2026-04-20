import { api } from './apiConfig';

export interface Client {
    id: string; // "V-12345678"
    name: string;
    address?: string;
    phone?: string;
    hasWhatsapp?: boolean;
    email?: string;
    social1?: string;
    social2?: string;
    social3?: string;
    birthDate?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateClientDto {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    hasWhatsapp?: boolean;
    email?: string;
    social1?: string;
    social2?: string;
    social3?: string;
    birthDate?: string;
}

export interface UpdateClientDto extends Partial<CreateClientDto> { }

export const clientsApi = {
    getAll: async (search?: string): Promise<Client[]> => {
        const params: any = {};
        if (search) params.search = search;

        const { data } = await api.get('/clients', { params });
        return data;
    },

    getOne: async (id: string): Promise<Client> => {
        const { data } = await api.get(`/clients/${id}`);
        return data;
    },

    create: async (dto: CreateClientDto): Promise<Client> => {
        const { data } = await api.post('/clients', dto);
        return data;
    },

    update: async (id: string, dto: UpdateClientDto): Promise<Client> => {
        const { data } = await api.patch(`/clients/${id}`, dto);
        return data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/clients/${id}`);
    },
};
