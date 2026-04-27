import { api } from './apiConfig';

export interface Unit {
    id: string;
    name: string;
    abbreviation: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateUnitDto {
    name: string;
    abbreviation: string;
}

export interface UpdateUnitDto {
    name?: string;
    abbreviation?: string;
}

export const unitsApi = {
    /**
     * Retrieves all active units of measurement.
     * @returns A list of units.
     */
    getAll: async (): Promise<Unit[]> => {
        const { data } = await api.get('/units');
        return data;
    },

    /**
     * Retrieves a single unit by its ID.
     * @param id The ID of the unit.
     * @returns The unit record.
     */
    getOne: async (id: string): Promise<Unit> => {
        const { data } = await api.get(`/units/${id}`);
        return data;
    },

    /**
     * Creates a new unit of measurement.
     * @param dto The data for the new unit.
     * @returns The created unit record.
     */
    create: async (dto: CreateUnitDto): Promise<Unit> => {
        const { data } = await api.post('/units', dto);
        return data;
    },

    /**
     * Updates an existing unit's information.
     * @param id The ID of the unit to update.
     * @param dto The updated data.
     * @returns The updated unit record.
     */
    update: async (id: string, dto: UpdateUnitDto): Promise<Unit> => {
        const { data } = await api.patch(`/units/${id}`, dto);
        return data;
    },

    /**
     * Deactivates a unit (soft delete).
     * @param id The ID of the unit to deactivate.
     */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/units/${id}`);
    },
};
