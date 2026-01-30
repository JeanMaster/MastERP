import { api } from './apiConfig';

export interface Department {
    id: string;
    name: string;
    description?: string;
    parentId?: string;
    parent?: {
        id: string;
        name: string;
    };
    children?: Department[];
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface CreateDepartmentDto {
    name: string;
    description?: string;
    parentId?: string;
}

export interface UpdateDepartmentDto {
    name?: string;
    description?: string;
    parentId?: string;
}

export const departmentsApi = {
    getAll: async (): Promise<Department[]> => {
        const { data } = await api.get('/departments');
        return data;
    },

    getTree: async (): Promise<Department[]> => {
        const { data } = await api.get('/departments/tree');
        return data;
    },

    getOne: async (id: string): Promise<Department> => {
        const { data } = await api.get(`/departments/${id}`);
        return data;
    },

    create: async (dto: CreateDepartmentDto): Promise<Department> => {
        const { data } = await api.post('/departments', dto);
        return data;
    },

    update: async (id: string, dto: UpdateDepartmentDto): Promise<Department> => {
        const { data } = await api.patch(`/departments/${id}`, dto);
        return data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/departments/${id}`);
    },
};
