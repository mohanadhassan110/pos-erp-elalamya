import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { Product, PaginatedResponse, BarcodePreviewResponse } from '../../types/domain';

export interface ProductFilters {
  [key: string]: string | number | boolean | undefined | null;
  search?: string;
  category_id?: number;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

export interface CreateProductPayload {
  category_id: number;
  name: string;
  purchase_cost: string;
  wholesale_price: string;
  retail_price: string;
  initial_stock?: number;
  is_active?: boolean;
}

export interface UpdateProductPayload {
  category_id?: number;
  name?: string;
  purchase_cost?: string;
  wholesale_price?: string;
  retail_price?: string;
  is_active?: boolean;
}

export const productsApi = {
  list: async (params?: ProductFilters): Promise<PaginatedResponse<Product>> => {
    const res = await apiClient.get<PaginatedResponse<Product>>(API_ENDPOINTS.PRODUCTS.BASE, { params });
    return res as unknown as PaginatedResponse<Product>;
  },

  getById: async (id: number): Promise<Product> => {
    const res = await apiClient.get<Product>(API_ENDPOINTS.PRODUCTS.BY_ID(id));
    return res.data;
  },

  getByBarcode: async (barcode: string): Promise<Product> => {
    const res = await apiClient.get<Product>(API_ENDPOINTS.PRODUCTS.BY_BARCODE(barcode));
    return res.data;
  },

  create: async (payload: CreateProductPayload): Promise<Product> => {
    const res = await apiClient.post<Product>(API_ENDPOINTS.PRODUCTS.BASE, payload);
    return res.data;
  },

  update: async (id: number, payload: UpdateProductPayload): Promise<Product> => {
    const res = await apiClient.put<Product>(API_ENDPOINTS.PRODUCTS.BY_ID(id), payload);
    return res.data;
  },

  toggleStatus: async (id: number, is_active?: boolean): Promise<Product> => {
    const res = await apiClient.patch<Product>(API_ENDPOINTS.PRODUCTS.STATUS(id), { is_active });
    return res.data;
  },

  previewBarcodes: async (items: Array<{ product_id: number; quantity: number }>): Promise<BarcodePreviewResponse> => {
    const res = await apiClient.post<BarcodePreviewResponse>(API_ENDPOINTS.PRODUCTS.BARCODE_PREVIEW, { items });
    return res as unknown as BarcodePreviewResponse;
  },
};
