import { api } from './apiConfig';

export const devToolsApi = {
    resetDatabase: async (): Promise<{ success: boolean; message: string }> => {
        const { data } = await api.post('/dev-tools/reset-database');
        return data;
    },

    financialReset: async (): Promise<{ success: boolean; message: string }> => {
        const { data } = await api.post('/dev-tools/financial-reset');
        return data;
    },

    downloadBackup: async () => {
        const response = await api.get('/dev-tools/backup', {
            responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `backup-${new Date().toISOString()}.sql`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
    },

    restoreBackup: async (file: File): Promise<{ success: boolean; message: string }> => {
        const formData = new FormData();
        formData.append('file', file);

        const { data } = await api.post('/dev-tools/restore', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return data;
    },
};
