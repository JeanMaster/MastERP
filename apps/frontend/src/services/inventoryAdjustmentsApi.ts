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
    /**
     * Creates a new inventory adjustment.
     * @param dto The data for the inventory adjustment.
     * @returns The created inventory adjustment record.
     */
    create: async (dto: CreateAdjustmentDto): Promise<InventoryAdjustment> => {
        const { data } = await api.post('/inventory-adjustments', dto);
        return data;
    },

    /**
     * Retrieves a list of inventory adjustments based on filters.
     * @param filters Filtering criteria (productId, type, reason, date range).
     * @returns A list of matching inventory adjustments.
     */
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

    /**
     * Retrieves a single inventory adjustment by its ID.
     * @param id The ID of the adjustment.
     * @returns The inventory adjustment record.
     */
    findOne: async (id: string): Promise<InventoryAdjustment> => {
        const { data } = await api.get(`/inventory-adjustments/${id}`);
        return data;
    },

    /**
     * Retrieves the adjustment history for a specific product.
     * @param productId The ID of the product.
     * @returns A list of adjustments for the product.
     */
    findByProduct: async (productId: string): Promise<InventoryAdjustment[]> => {
        const { data } = await api.get(`/inventory-adjustments/product/${productId}`);
        return data;
    }
};
