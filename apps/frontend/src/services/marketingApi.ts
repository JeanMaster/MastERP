import { api } from './apiConfig';

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
    /**
     * Retrieves marketing statistics for the dashboard.
     */
    getStats: async (): Promise<MarketingStats> => {
        const response = await api.get(`/marketing/stats`);
        return response.data;
    },

    /**
     * Retrieves the current marketing configuration.
     */
    getConfig: async (): Promise<MarketingConfig> => {
        const response = await api.get(`/marketing/config`);
        return response.data;
    },

    /**
     * Updates the marketing configuration.
     * @param data Partial configuration data.
     */
    updateConfig: async (data: Partial<MarketingConfig>): Promise<MarketingConfig> => {
        const response = await api.patch(`/marketing/config`, data);
        return response.data;
    },

    /**
     * Retrieves all client segments.
     */
    getSegments: async (): Promise<any[]> => {
        const response = await api.get(`/marketing/segments`);
        return response.data;
    },

    /**
     * Retrieves the top loyalty earners.
     */
    getTopEarners: async (): Promise<any[]> => {
        const response = await api.get(`/marketing/loyalty/top`);
        return response.data;
    },

    /**
     * Retrieves the loyalty movement history for a specific client.
     */
    getClientLoyalty: async (clientId: string): Promise<any[]> => {
        const response = await api.get(`/marketing/loyalty/${clientId}`);
        return response.data;
    },

    /**
     * Performs a manual points adjustment for a client.
     */
    adjustPoints: async (clientId: string, amount: number, notes: string): Promise<any> => {
        const response = await api.post(`/marketing/loyalty/${clientId}/adjust`, { amount, notes });
        return response.data;
    },

    /**
     * Retrieves the monetary value of a client's points.
     */
    getPointsValue: async (clientId: string): Promise<{ points: number; valueUsd: number; rate: number; maxRedemptionPercentage: number }> => {
        const response = await api.get(`/marketing/loyalty/${clientId}/value`);
        return response.data;
    },

    // --- TEMPLATES ---

    /**
     * Retrieves all message templates.
     */
    getTemplates: async (): Promise<any[]> => {
        const response = await api.get(`/marketing/templates`);
        return response.data;
    },

    /**
     * Creates a new message template.
     */
    createTemplate: async (data: { name: string; content: string; category?: string }): Promise<any> => {
        const response = await api.post(`/marketing/templates`, data);
        return response.data;
    },

    /**
     * Deletes a message template.
     */
    deleteTemplate: async (id: string): Promise<any> => {
        const response = await api.delete(`/marketing/templates/${id}`);
        return response.data;
    },

    // --- CAMPAIGNS ---

    /**
     * Retrieves all marketing campaigns.
     */
    getCampaigns: async (): Promise<any[]> => {
        const response = await api.get(`/marketing/campaigns`);
        return response.data;
    },

    /**
     * Retrieves detailed information about a campaign.
     */
    getCampaignDetails: async (id: string): Promise<any> => {
        const response = await api.get(`/marketing/campaigns/${id}`);
        return response.data;
    },

    /**
     * Creates a new marketing campaign.
     */
    createCampaign: async (data: { name: string; templateId: string; targetSegment: string }): Promise<any> => {
        const response = await api.post(`/marketing/campaigns`, data);
        return response.data;
    },

    /**
     * Marks a campaign recipient as sent.
     */
    markRecipientSent: async (recipientId: string): Promise<any> => {
        const response = await api.patch(`/marketing/campaigns/recipients/${recipientId}/sent`);
        return response.data;
    },

    // --- COUPONS ---

    /**
     * Retrieves all discount coupons.
     */
    getCoupons: async (): Promise<any[]> => {
        const response = await api.get(`/marketing/coupons`);
        return response.data;
    },

    /**
     * Creates a new discount coupon.
     */
    createCoupon: async (data: any): Promise<any> => {
        const response = await api.post(`/marketing/coupons`, data);
        return response.data;
    },

    /**
     * Updates an existing discount coupon.
     */
    updateCoupon: async (id: string, data: any): Promise<any> => {
        const response = await api.patch(`/marketing/coupons/${id}`, data);
        return response.data;
    },

    /**
     * Deletes a discount coupon.
     */
    deleteCoupon: async (id: string): Promise<any> => {
        const response = await api.delete(`/marketing/coupons/${id}`);
        return response.data;
    },

    /**
     * Validates a coupon code.
     */
    validateCoupon: async (data: { code: string; clientId?: string; cartItems: any[] }): Promise<any> => {
        const response = await api.post(`/marketing/coupons/validate`, data);
        return response.data;
    },

    // --- SOCIAL HUB ---

    /**
     * Generates a social media post draft using AI.
     */
    generateSocialPost: async (data: { productId: string; platform: string; instructions?: string }): Promise<any> => {
        const response = await api.post(`/marketing/social/generate`, data);
        return response.data;
    },

    /**
     * Retrieves all social post drafts.
     */
    getSocialDrafts: async (): Promise<any[]> => {
        const response = await api.get(`/marketing/social/drafts`);
        return response.data;
    },

    /**
     * Deletes a social post draft.
     */
    deleteSocialDraft: async (id: string): Promise<any> => {
        const response = await api.delete(`/marketing/social/drafts/${id}`);
        return response.data;
    },
};
