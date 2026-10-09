import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type {
  ReturnableInvoice,
  SalesReturn,
  CreateSalesReturnPayload,
  PaginatedResponse,
} from '../../types/domain';

export interface ReturnFilters {
  [key: string]: string | number | boolean | undefined | null;
  search?: string;
  resolution?: string;
  customer_id?: number;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
}

export const returnsApi = {
  searchInvoice: async (invoiceNumber: string): Promise<ReturnableInvoice> => {
    const res = await apiClient.get<ReturnableInvoice>(API_ENDPOINTS.RETURNS.SEARCH_INVOICE, {
      params: { query: invoiceNumber },
    });
    return res.data;
  },

  getReturnableInvoice: async (invoiceId: number): Promise<ReturnableInvoice> => {
    const res = await apiClient.get<ReturnableInvoice>(API_ENDPOINTS.RETURNS.BY_INVOICE(invoiceId));
    return res.data;
  },

  create: async (payload: CreateSalesReturnPayload): Promise<SalesReturn> => {
    const res = await apiClient.post<SalesReturn>(API_ENDPOINTS.RETURNS.BASE, payload);
    return res.data;
  },

  list: async (params?: ReturnFilters): Promise<PaginatedResponse<SalesReturn>> => {
    const res = await apiClient.get<PaginatedResponse<SalesReturn>>(API_ENDPOINTS.RETURNS.BASE, { params });
    return res as unknown as PaginatedResponse<SalesReturn>;
  },

  getById: async (id: number): Promise<SalesReturn> => {
    const res = await apiClient.get<SalesReturn>(API_ENDPOINTS.RETURNS.BY_ID(id));
    return res.data;
  },
};
