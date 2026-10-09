import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { Customer, PaginatedResponse } from '../../types/domain';

export interface CustomerFilters {
  [key: string]: string | number | boolean | undefined | null;
  search?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

export interface CustomerPayload {
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export const customersApi = {
  list: async (params?: CustomerFilters): Promise<PaginatedResponse<Customer>> => {
    const res = await apiClient.get<PaginatedResponse<Customer>>(API_ENDPOINTS.CUSTOMERS.BASE, { params });
    return res as unknown as PaginatedResponse<Customer>;
  },

  getById: async (id: number): Promise<Customer> => {
    const res = await apiClient.get<Customer>(API_ENDPOINTS.CUSTOMERS.BY_ID(id));
    return res.data;
  },

  create: async (payload: CustomerPayload): Promise<Customer> => {
    const res = await apiClient.post<Customer>(API_ENDPOINTS.CUSTOMERS.BASE, payload);
    return res.data;
  },

  update: async (id: number, payload: Partial<CustomerPayload>): Promise<Customer> => {
    const res = await apiClient.put<Customer>(API_ENDPOINTS.CUSTOMERS.BY_ID(id), payload);
    return res.data;
  },

  toggleStatus: async (id: number, is_active?: boolean): Promise<Customer> => {
    const res = await apiClient.patch<Customer>(API_ENDPOINTS.CUSTOMERS.STATUS(id), { is_active });
    return res.data;
  },
};
