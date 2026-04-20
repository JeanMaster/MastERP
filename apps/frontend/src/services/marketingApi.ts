import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface MarketingStats {
    tiers: {
        vip: number;
        gold: number;
        silver: number;
        bronze: number;
    };
    churn: {
        count: number;
        totalClients: number;
        percentage: number;
        days: number;
    };
    upcomingBirthdays: Array<{
        id: string;
        name: string;
        phone: string | null;
        birthDate: string;
        day: number;
    }>;
}

export interface MarketingConfig {
    id: string;
    tierVipThreshold: number;
    tierGoldThreshold: number;
    tierSilverThreshold: number;
    churnDays: number;
    pointsPerUSD: number;
    valuePerPoint: number;
    maxRedemptionPercentage: number;
    geminiApiKey?: string | null;
}

export const marketingApi = {
    getStats: async (): Promise<MarketingStats> => {
        const response = await axios.get(`${API_URL}/marketing/stats`);
        return response.data;
    },
    getConfig: async (): Promise<MarketingConfig> => {
        const response = await axios.get(`${API_URL}/marketing/config`);
        return response.data;
    },
    updateConfig: async (data: Partial<MarketingConfig>): Promise<MarketingConfig> => {
        const response = await axios.patch(`${API_URL}/marketing/config`, data);
        return response.data;
    },
    getSegments: async (): Promise<any[]> => {
        const response = await axios.get(`${API_URL}/marketing/segments`);
        return response.data;
    },
    getTopEarners: async (): Promise<any[]> => {
        const response = await axios.get(`${API_URL}/marketing/loyalty/top`);
        return response.data;
    },
    getClientLoyalty: async (clientId: string): Promise<any[]> => {
        const response = await axios.get(`${API_URL}/marketing/loyalty/${clientId}`);
        return response.data;
    },
    adjustPoints: async (clientId: string, amount: number, notes: string): Promise<any> => {
        const response = await axios.post(`${API_URL}/marketing/loyalty/${clientId}/adjust`, { amount, notes });
        return response.data;
    },
    getPointsValue: async (clientId: string): Promise<{ points: number; valueUsd: number; rate: number; maxRedemptionPercentage: number }> => {
        const response = await axios.get(`${API_URL}/marketing/loyalty/${clientId}/value`);
        return response.data;
    },
    // --- TEMPLATES ---
    getTemplates: async (): Promise<any[]> => {
        const response = await axios.get(`${API_URL}/marketing/templates`);
        return response.data;
    },
    createTemplate: async (data: { name: string; content: string; category?: string }): Promise<any> => {
        const response = await axios.post(`${API_URL}/marketing/templates`, data);
        return response.data;
    },
    deleteTemplate: async (id: string): Promise<any> => {
        const response = await axios.delete(`${API_URL}/marketing/templates/${id}`);
        return response.data;
    },
    // --- CAMPAIGNS ---
    getCampaigns: async (): Promise<any[]> => {
        const response = await axios.get(`${API_URL}/marketing/campaigns`);
        return response.data;
    },
    getCampaignDetails: async (id: string): Promise<any> => {
        const response = await axios.get(`${API_URL}/marketing/campaigns/${id}`);
        return response.data;
    },
    createCampaign: async (data: { name: string; templateId: string; targetSegment: string }): Promise<any> => {
        const response = await axios.post(`${API_URL}/marketing/campaigns`, data);
        return response.data;
    },
    markRecipientSent: async (recipientId: string): Promise<any> => {
        const response = await axios.patch(`${API_URL}/marketing/campaigns/recipients/${recipientId}/sent`);
        return response.data;
    },
    // --- COUPONS ---
    getCoupons: async (): Promise<any[]> => {
        const response = await axios.get(`${API_URL}/marketing/coupons`);
        return response.data;
    },
    createCoupon: async (data: any): Promise<any> => {
        const response = await axios.post(`${API_URL}/marketing/coupons`, data);
        return response.data;
    },
    updateCoupon: async (id: string, data: any): Promise<any> => {
        const response = await axios.patch(`${API_URL}/marketing/coupons/${id}`, data);
        return response.data;
    },
    deleteCoupon: async (id: string): Promise<any> => {
        const response = await axios.delete(`${API_URL}/marketing/coupons/${id}`);
        return response.data;
    },
    validateCoupon: async (data: { code: string; clientId?: string; cartItems: any[] }): Promise<any> => {
        const response = await axios.post(`${API_URL}/marketing/coupons/validate`, data);
        return response.data;
    },
    // --- SOCIAL HUB ---
    generateSocialPost: async (data: { productId: string; platform: string; instructions?: string }): Promise<any> => {
        const response = await axios.post(`${API_URL}/marketing/social/generate`, data);
        return response.data;
    },
    getSocialDrafts: async (): Promise<any[]> => {
        const response = await axios.get(`${API_URL}/marketing/social/drafts`);
        return response.data;
    },
    deleteSocialDraft: async (id: string): Promise<any> => {
        const response = await axios.delete(`${API_URL}/marketing/social/drafts/${id}`);
        return response.data;
    },
};
