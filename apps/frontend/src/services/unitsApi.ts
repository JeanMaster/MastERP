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
    getAll: async (): Promise<Unit[]> => {
        const { data } = await api.get('/units');
        return data;
    },

    getOne: async (id: string): Promise<Unit> => {
        const { data } = await api.get(`/units/${id}`);
        return data;
    },

    create: async (dto: CreateUnitDto): Promise<Unit> => {
        const { data } = await api.post('/units', dto);
        return data;
    },

    update: async (id: string, dto: UpdateUnitDto): Promise<Unit> => {
        const { data } = await api.patch(`/units/${id}`, dto);
        return data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/units/${id}`);
    },
};
