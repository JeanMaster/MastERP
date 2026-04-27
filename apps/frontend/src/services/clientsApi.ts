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
    /**
     * Retrieves all clients with an optional search term.
     * @param search Search term (name, ID, or email).
     * @returns A list of clients.
     */
    getAll: async (search?: string): Promise<Client[]> => {
        const params: any = {};
        if (search) params.search = search;

        const { data } = await api.get('/clients', { params });
        return data;
    },

    /**
     * Retrieves a single client by its ID.
     * @param id The ID of the client.
     * @returns The client record.
     */
    getOne: async (id: string): Promise<Client> => {
        const { data } = await api.get(`/clients/${id}`);
        return data;
    },

    /**
     * Creates a new client record.
     * @param dto The data for the new client.
     * @returns The created client record.
     */
    create: async (dto: CreateClientDto): Promise<Client> => {
        const { data } = await api.post('/clients', dto);
        return data;
    },

    /**
     * Updates an existing client's information.
     * @param id The ID of the client to update.
     * @param dto The updated data.
     * @returns The updated client record.
     */
    update: async (id: string, dto: UpdateClientDto): Promise<Client> => {
        const { data } = await api.patch(`/clients/${id}`, dto);
        return data;
    },

    /**
     * Performs a soft delete by marking the client as inactive.
     * @param id The ID of the client to deactivate.
     */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/clients/${id}`);
    },
};
