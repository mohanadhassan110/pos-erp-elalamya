import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { InventoryResponse } from '../../types/domain';

export interface InventoryFilters {
  [key: string]: string | number | boolean | undefined | null;
  search?: string;
  category_id?: number;
  stock_status?: 'in_stock' | 'out_of_stock';
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

export const inventoryApi = {
  getInventory: async (params?: InventoryFilters): Promise<InventoryResponse> => {
    const res = await apiClient.get<InventoryResponse>(API_ENDPOINTS.INVENTORY.BASE, { params });
    return res as unknown as InventoryResponse;
  },
};
