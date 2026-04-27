import { api } from './apiConfig';
import type { User } from './usersApi';

export interface LoginResponse {
    access_token: string;
    user: User;
}

export interface LoginCredentials {
    username: string;
    password: string;
}

export const authApi = {
    /**
     * Authenticates a user and returns a JWT token.
     * @param credentials Username and password.
     * @returns The access token and user info.
     */
    login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
        const response = await api.post('/auth/login', credentials);
        return response.data;
    },

    /**
     * Retrieves the current user's profile from the token.
     * @returns The current user's info.
     */
    getProfile: async (): Promise<User> => {
        const response = await api.get('/auth/profile');
        return response.data;
    },
};
