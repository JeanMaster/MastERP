import axios from 'axios';

/**
 * Centralized API configuration for Zenith
 */

const getApiBaseUrl = () => {
    // Check for custom override (set via UI Settings)
    const customUrl = localStorage.getItem('CUSTOM_API_URL');
    if (customUrl) return customUrl;

    // Check for environment variable
    const envUrl = (import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_APP_URL;
    if (envUrl) return envUrl;

    // Default development fallback
    return 'http://localhost:3000/api';
};

export const BASE_URL = getApiBaseUrl();

// Create centralized axios instance
export const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor: add token if exists
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor: handle token expiration (401)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Redirect to login (only if not already there)
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const setCustomApiUrl = (url: string | null) => {
    if (url) {
        localStorage.setItem('CUSTOM_API_URL', url);
    } else {
        localStorage.removeItem('CUSTOM_API_URL');
    }
};

export const getConnectionMode = (): 'local' | 'lan' | 'remote' => {
    const url = BASE_URL;
    if (url.includes('localhost') || url.includes('127.0.0.1')) return 'local';

    // Check if it's an IP (common for LAN)
    const ipPattern = /\d+\.\d+\.\d+\.\d+/;
    if (ipPattern.test(url)) return 'lan';

    return 'remote';
};
