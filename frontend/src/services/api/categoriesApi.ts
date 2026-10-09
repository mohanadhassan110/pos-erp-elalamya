import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { Category } from '../../types/domain';

export const categoriesApi = {
  list: async (params?: Record<string, string | number | boolean | undefined | null>): Promise<Category[]> => {
    const res = await apiClient.get<Category[]>(API_ENDPOINTS.CATEGORIES.BASE, { params });
    return res.data;
  },

  getCategories: async (params?: Record<string, string | number | boolean | undefined | null>): Promise<{ data: Category[] }> => {
    const res = await apiClient.get<Category[]>(API_ENDPOINTS.CATEGORIES.BASE, { params });
    return { data: res.data };
  },

  getById: async (id: number): Promise<Category> => {
    const res = await apiClient.get<Category>(API_ENDPOINTS.CATEGORIES.BY_ID(id));
    return res.data;
  },

  create: async (data: { name: string; code: string; is_active?: boolean }): Promise<Category> => {
    const res = await apiClient.post<Category>(API_ENDPOINTS.CATEGORIES.BASE, data);
    return res.data;
  },

  update: async (id: number, data: { name?: string; code?: string; is_active?: boolean }): Promise<Category> => {
    const res = await apiClient.put<Category>(API_ENDPOINTS.CATEGORIES.BY_ID(id), data);
    return res.data;
  },

  toggleStatus: async (id: number, is_active?: boolean): Promise<Category> => {
    const res = await apiClient.patch<Category>(API_ENDPOINTS.CATEGORIES.STATUS(id), { is_active });
    return res.data;
  },
};
