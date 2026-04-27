import { api } from './apiConfig';

export interface User {
    id: string;
    username: string;
    name: string;
    role: string;
    permissions: string[];
    isActive: boolean;
    createdAt?: string;
}

export interface CreateUserDto {
    username: string;
    password?: string;
    name: string;
    role: string;
    permissions?: string[];
    isActive?: boolean;
}

export const usersApi = {
    /**
     * Retrieves all user records.
     * @returns A list of users.
     */
    getAll: async (): Promise<User[]> => {
        const response = await api.get('/users');
        return response.data;
    },

    /**
     * Retrieves a single user record by its ID.
     * @param id The ID of the user.
     * @returns The user record.
     */
    getById: async (id: string): Promise<User> => {
        const response = await api.get(`/users/${id}`);
        return response.data;
    },

    /**
     * Creates a new user record.
     * @param data The data for the new user.
     * @returns The created user record.
     */
    create: async (data: CreateUserDto): Promise<User> => {
        const response = await api.post('/users', data);
        return response.data;
    },

    /**
     * Updates an existing user record.
     * @param id The ID of the user to update.
     * @param data The new data for the user.
     * @returns The updated user record.
     */
    update: async (id: string, data: Partial<CreateUserDto>): Promise<User> => {
        const response = await api.patch(`/users/${id}`, data);
        return response.data;
    },

    /**
     * Deletes a user record.
     * @param id The ID of the user to delete.
     */
    remove: async (id: string): Promise<void> => {
        await api.delete(`/users/${id}`);
    },
};
