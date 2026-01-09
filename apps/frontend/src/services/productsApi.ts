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
    imageUrl?: string;
    active: boolean;
    type: 'PRODUCT' | 'SERVICE';
    createdAt: string;
    updatedAt: string;
}

export interface CreateProductDto {
    type?: 'PRODUCT' | 'SERVICE';
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
    imageUrl?: string;
}

export interface UpdateProductDto {
    type?: 'PRODUCT' | 'SERVICE';
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
    imageUrl?: string;
}

export const productsApi = {
    getAll: async (filters: { active?: boolean; search?: string; categoryId?: string; subcategoryId?: string; type?: 'PRODUCT' | 'SERVICE' } = {}): Promise<Product[]> => {
        const { active, search, categoryId, subcategoryId, type } = filters;
        const params = new URLSearchParams();
        if (active !== undefined) params.append('active', String(active));
        if (search) params.append('search', search);
        if (categoryId) params.append('categoryId', categoryId);
        if (subcategoryId) params.append('subcategoryId', subcategoryId);
        if (type) params.append('type', type);

        const { data } = await api.get(`/products`, { params });
        return data;
    },

    getOne: async (id: string): Promise<Product> => {
        const { data } = await api.get(`/products/${id}`);
        return data;
    },

    create: async (dto: CreateProductDto): Promise<Product> => {
        const { data } = await api.post(`/products`, dto);
        return data;
    },

    update: async (id: string, dto: UpdateProductDto): Promise<Product> => {
        const { data } = await api.patch(`/products/${id}`, dto);
        return data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/products/${id}`);
    },
};
