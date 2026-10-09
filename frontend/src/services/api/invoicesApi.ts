import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type { Invoice, PrintableInvoice, CreateInvoicePayload, PaginatedResponse } from '../../types/domain';

export interface InvoiceFilters {
  [key: string]: string | number | boolean | undefined | null;
  search?: string;
  sale_type?: 'retail' | 'wholesale';
  status?: 'posted' | 'cancelled';
  customer_id?: number;
  from_date?: string;
  to_date?: string;
  page?: number;
  per_page?: number;
}

export const invoicesApi = {
  list: async (params?: InvoiceFilters): Promise<PaginatedResponse<Invoice>> => {
    const res = await apiClient.get<PaginatedResponse<Invoice>>(API_ENDPOINTS.INVOICES.BASE, { params });
    return res as unknown as PaginatedResponse<Invoice>;
  },

  getById: async (id: number): Promise<Invoice> => {
    const res = await apiClient.get<Invoice>(API_ENDPOINTS.INVOICES.BY_ID(id));
    return res.data;
  },

  getPrintable: async (id: number): Promise<PrintableInvoice> => {
    const res = await apiClient.get<PrintableInvoice>(API_ENDPOINTS.INVOICES.PRINT(id));
    return res.data;
  },

  create: async (payload: CreateInvoicePayload): Promise<Invoice> => {
    const res = await apiClient.post<Invoice>(API_ENDPOINTS.INVOICES.BASE, payload);
    return res.data;
  },
};
