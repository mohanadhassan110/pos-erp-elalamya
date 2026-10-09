import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { StockReceipt, PaginatedResponse } from '../../types/domain';

export interface ReceiveStockItemPayload {
  product_id: number;
  quantity: number;
  unit_cost: string;
}

export interface ReceiveStockPayload {
  idempotency_key?: string;
  supplier_id?: number | null;
  received_date?: string;
  notes?: string | null;
  items: ReceiveStockItemPayload[];
}

export const purchasingApi = {
  listReceipts: async (params?: { [key: string]: string | number | boolean | undefined | null; search?: string; supplier_id?: number; page?: number }): Promise<PaginatedResponse<StockReceipt>> => {
    const res = await apiClient.get<PaginatedResponse<StockReceipt>>(API_ENDPOINTS.STOCK_RECEIPTS.BASE, { params });
    return res as unknown as PaginatedResponse<StockReceipt>;
  },

  getReceipt: async (id: number): Promise<StockReceipt> => {
    const res = await apiClient.get<StockReceipt>(API_ENDPOINTS.STOCK_RECEIPTS.BY_ID(id));
    return res.data;
  },

  receiveStock: async (payload: ReceiveStockPayload): Promise<StockReceipt> => {
    const res = await apiClient.post<StockReceipt>(API_ENDPOINTS.STOCK_RECEIPTS.BASE, payload);
    return res.data;
  },
};
