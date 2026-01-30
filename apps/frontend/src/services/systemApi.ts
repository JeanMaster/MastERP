import { api } from './apiConfig';

export interface NetworkInfo {
    localIp: string;
    allIps: string[];
    port: number | string;
}

export const systemApi = {
    getNetworkInfo: async (): Promise<NetworkInfo> => {
        const { data } = await api.get('/system/network');
        return data;
    }
};
