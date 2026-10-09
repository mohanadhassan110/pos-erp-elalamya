import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { Supplier, PaginatedResponse } from '../../types/domain';

export interface SupplierFilters {
  [key: string]: string | number | boolean | undefined | null;
  search?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

export interface SupplierPayload {
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export const suppliersApi = {
  list: async (params?: SupplierFilters): Promise<PaginatedResponse<Supplier>> => {
    const res = await apiClient.get<PaginatedResponse<Supplier>>(API_ENDPOINTS.SUPPLIERS.BASE, { params });
    return res as unknown as PaginatedResponse<Supplier>;
  },

  getById: async (id: number): Promise<Supplier> => {
    const res = await apiClient.get<Supplier>(API_ENDPOINTS.SUPPLIERS.BY_ID(id));
    return res.data;
  },

  create: async (payload: SupplierPayload): Promise<Supplier> => {
    const res = await apiClient.post<Supplier>(API_ENDPOINTS.SUPPLIERS.BASE, payload);
    return res.data;
  },

  update: async (id: number, payload: Partial<SupplierPayload>): Promise<Supplier> => {
    const res = await apiClient.put<Supplier>(API_ENDPOINTS.SUPPLIERS.BY_ID(id), payload);
    return res.data;
  },

  toggleStatus: async (id: number, is_active?: boolean): Promise<Supplier> => {
    const res = await apiClient.patch<Supplier>(API_ENDPOINTS.SUPPLIERS.STATUS(id), { is_active });
    return res.data;
  },

  addBalance: async (id: number, payload: { amount: string; description: string }): Promise<{ supplier: Supplier }> => {
    const res = await apiClient.post<{ supplier: Supplier }>(API_ENDPOINTS.SUPPLIERS.ADD_BALANCE(id), payload);
    return res.data;
  },
};
