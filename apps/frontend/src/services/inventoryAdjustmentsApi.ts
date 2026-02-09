import { api } from './apiConfig';

export interface InventoryAdjustment {
    id: string;
    productId: string;
    product: {
        id: string;
        name: string;
        sku: string;
        stock: number;
    };
    type: 'INCREASE' | 'DECREASE';
    quantity: number;
    previousStock: number;
    newStock: number;
    reason: 'DAMAGE' | 'LOSS' | 'ERROR' | 'INITIAL' | 'RETURN' | 'TRANSFER' | 'OTHER';
    notes?: string;
    performedBy: string;
    createdAt: string;
}

export interface CreateAdjustmentDto {
    productId: string;
    type: 'INCREASE' | 'DECREASE';
    quantity: number;
    reason: 'DAMAGE' | 'LOSS' | 'ERROR' | 'INITIAL' | 'RETURN' | 'TRANSFER' | 'OTHER';
    notes?: string;
    performedBy?: string;
}

export const inventoryAdjustmentsApi = {
    create: async (dto: CreateAdjustmentDto): Promise<InventoryAdjustment> => {
        const { data } = await api.post('/inventory-adjustments', dto);
        return data;
    },

    findAll: async (filters?: {
        productId?: string;
        type?: string;
        reason?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<InventoryAdjustment[]> => {
        const { data } = await api.get('/inventory-adjustments', { params: filters });
        return data;
    },

    findOne: async (id: string): Promise<InventoryAdjustment> => {
        const { data } = await api.get(`/inventory-adjustments/${id}`);
        return data;
    },

    findByProduct: async (productId: string): Promise<InventoryAdjustment[]> => {
        const { data } = await api.get(`/inventory-adjustments/product/${productId}`);
        return data;
    }
};
