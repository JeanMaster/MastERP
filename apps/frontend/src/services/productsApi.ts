import { api } from './apiConfig';

export interface Product {
    id: string;
    sku: string;
    name: string;
    description?: string;
    categoryId: string;
    category: {
        id: string;
        name: string;
    };
    subcategoryId?: string;
    subcategory?: {
        id: string;
        name: string;
    };
    currencyId: string;
    currency: {
        id: string;
        name: string;
        symbol: string;
        isPrimary: boolean;
        exchangeRate: number;
    };
    costPrice: number;
    salePrice: number;
    offerPrice?: number;
    wholesalePrice?: number;
    stock: number;
    unitId: string;
    unit: {
        id: string;
        name: string;
        abbreviation: string;
    };
    secondaryUnitId?: string;
    secondaryUnit?: {
        id: string;
        name: string;
        abbreviation: string;
    };
    unitsPerSecondaryUnit?: number;
    conversionDirection?: string;
    secondaryCostPrice?: number;
    secondarySalePrice?: number;
    secondaryOfferPrice?: number;
    secondaryWholesalePrice?: number;
    images: string[];
    isTaxExempt: boolean;
    active: boolean;
    type: 'PRODUCT' | 'SERVICE' | 'COMPOSED';
    components?: Array<{
        id: string;
        componentProductId: string;
        quantity: number;
        componentProduct: {
            id: string;
            name: string;
            sku: string;
            costPrice: number;
            stock: number;
            currency: {
                id: string;
                name: string;
                symbol: string;
                isPrimary: boolean;
                exchangeRate: number;
            };
        };
    }>;
    createdAt: string;
    updatedAt: string;
}

export interface CreateProductDto {
    type?: 'PRODUCT' | 'SERVICE' | 'COMPOSED';
    sku: string;
    name: string;
    description?: string;
    categoryId: string;
    subcategoryId?: string;
    currencyId: string;
    costPrice?: number;
    salePrice: number;
    offerPrice?: number;
    wholesalePrice?: number;
    stock?: number;
    unitId?: string;
    secondaryUnitId?: string;
    unitsPerSecondaryUnit?: number;
    conversionDirection?: string;
    secondaryCostPrice?: number;
    secondarySalePrice?: number;
    secondaryOfferPrice?: number;
    secondaryWholesalePrice?: number;
    images?: string[];
    isTaxExempt?: boolean;
    components?: Array<{ componentProductId: string; quantity: number }>;
}

export interface UpdateProductDto {
    type?: 'PRODUCT' | 'SERVICE' | 'COMPOSED';
    sku?: string;
    name?: string;
    description?: string;
    categoryId?: string;
    subcategoryId?: string;
    currencyId?: string;
    costPrice?: number;
    salePrice?: number;
    offerPrice?: number;
    wholesalePrice?: number;
    stock?: number;
    unitId?: string;
    secondaryUnitId?: string;
    unitsPerSecondaryUnit?: number;
    conversionDirection?: string;
    secondaryCostPrice?: number;
    secondarySalePrice?: number;
    secondaryOfferPrice?: number;
    secondaryWholesalePrice?: number;
    images?: string[];
    isTaxExempt?: boolean;
    components?: Array<{ componentProductId: string; quantity: number }>;
}

export const productsApi = {
    /**
     * Retrieves all products matching the specified filters.
     * @param filters Filtering criteria (active, search, category, type, pagination).
     * @returns A list of products.
     */
    getAll: async (filters: { active?: boolean; search?: string; categoryId?: string; subcategoryId?: string; type?: 'PRODUCT' | 'SERVICE' | 'COMPOSED'; limit?: number; offset?: number } = {}): Promise<Product[]> => {
        const { active, search, categoryId, subcategoryId, type, limit, offset } = filters;
        const params = new URLSearchParams();
        if (active !== undefined) params.append('active', String(active));
        if (search) params.append('search', search);
        if (categoryId) params.append('categoryId', categoryId);
        if (subcategoryId) params.append('subcategoryId', subcategoryId);
        if (type) params.append('type', type);
        if (limit) params.append('limit', String(limit));
        if (offset) params.append('offset', String(offset));

        const { data } = await api.get(`/products`, { params });
        return data;
    },

    /**
     * Retrieves a single product by its ID.
     * @param id The ID of the product.
     * @returns The product record.
     */
    getOne: async (id: string): Promise<Product> => {
        const { data } = await api.get(`/products/${id}`);
        return data;
    },

    /**
     * Creates a new product.
     * @param dto The data for the new product.
     * @returns The created product record.
     */
    create: async (dto: CreateProductDto): Promise<Product> => {
        const { data } = await api.post(`/products`, dto);
        return data;
    },

    /**
     * Updates an existing product.
     * @param id The ID of the product to update.
     * @param dto The new data for the product.
     * @returns The updated product record.
     */
    update: async (id: string, dto: UpdateProductDto): Promise<Product> => {
        const { data } = await api.patch(`/products/${id}`, dto);
        return data;
    },

    /**
     * Deletes a product (soft delete).
     * @param id The ID of the product to delete.
     */
    delete: async (id: string): Promise<void> => {
        await api.delete(`/products/${id}`);
    },

    /**
     * Batch updates product prices using margin percentages.
     * @param updates A list of price updates with margins.
     * @returns The result of the batch update.
     */
    batchUpdatePrices: async (updates: Array<{
        productId: string;
        newCostPrice: number;
        salePriceMargin: number;
        offerPriceMargin?: number;
        wholesalePriceMargin?: number;
        currencyId?: string;
    }>) => {
        const { data } = await api.post(`/products/batch-update-prices`, updates);
        return data;
    },
};

