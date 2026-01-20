import axios from 'axios';
import { BASE_URL as API_URL } from './apiConfig';

export interface AIRecommendation {
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    action: string;
    category: 'sales' | 'inventory' | 'finance' | 'operations';
}

export interface AIInsightsResponse {
    recommendations: AIRecommendation[];
    generatedAt: string;
    contextPeriod: string;
}

export interface AIChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface AIChatRequest {
    message: string;
    conversationHistory?: AIChatMessage[];
}

export interface AIChatResponse {
    response: string;
    timestamp: string;
}

export const aiApi = {
    getDailyInsights: async (forceRefresh = false): Promise<AIInsightsResponse> => {
        const { data } = await axios.get(`${API_URL}/ai/daily-insights`, {
            params: { refresh: forceRefresh }
        });
        return data;
    },

    sendChatMessage: async (request: AIChatRequest): Promise<AIChatResponse> => {
        const { data } = await axios.post(`${API_URL}/ai/chat`, request);
        return data;
    },

    refreshInsights: async (): Promise<AIInsightsResponse> => {
        const { data } = await axios.post(`${API_URL}/ai/refresh-insights`);
        return data;
    },
};
