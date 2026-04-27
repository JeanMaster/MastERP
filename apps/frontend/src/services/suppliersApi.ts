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
    /**
     * Retrieves all suppliers with optional search and active status filters.
     * @param search Search term (name, RIF, email, or contact).
     * @param active Filter by active status.
     * @returns A list of suppliers.
     */
    getAll: async (search?: string, active: boolean = true): Promise<Supplier[]> => {
        const params: any = { active: String(active) };
        if (search) params.search = search;

        const response = await api.get('/suppliers', { params });
        return response.data;
    },

    /**
     * Retrieves a single supplier by its ID.
     * @param id The ID of the supplier.
     * @returns The supplier record.
     */
    getById: async (id: string): Promise<Supplier> => {
        const response = await api.get(`/suppliers/${id}`);
        return response.data;
    },

    /**
     * Creates a new supplier record.
     * @param data The data for the new supplier.
     * @returns The created supplier record.
     */
    create: async (data: CreateSupplierDto): Promise<Supplier> => {
        const response = await api.post('/suppliers', data);
        return response.data;
    },

    /**
     * Updates an existing supplier's information.
     * @param id The ID of the supplier to update.
     * @param data The updated data.
     * @returns The updated supplier record.
     */
    update: async (id: string, data: UpdateSupplierDto): Promise<Supplier> => {
        const response = await api.patch(`/suppliers/${id}`, data);
        return response.data;
    },

    /**
     * Performs a soft delete by marking the supplier as inactive.
     * @param id The ID of the supplier to deactivate.
     * @returns The deactivated supplier record.
     */
    remove: async (id: string): Promise<Supplier> => {
        const response = await api.delete(`/suppliers/${id}`);
        return response.data;
    },
};
