import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import type {
  ReportDateFilterParams,
  ReportOverviewData,
  SalesReportResponseData,
  ExpensesReportData,
  CustomerReportData,
  SupplierReportData,
  InventoryReportData,
  PaymentsReportData,
  ReportInvoicesHistoryData,
  ReportReturnsHistoryData,
} from '../../types/domain';

export interface HistoryFilterParams {
  [key: string]: string | number | undefined;
  status?: string;
  sale_type?: string;
  resolution?: string;
  from_date?: string;
  to_date?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface CustomerReportParams {
  [key: string]: string | number | boolean | null | undefined;
  filter?: 'debtors' | 'creditors' | 'settled' | string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface SupplierReportParams {
  [key: string]: string | number | boolean | null | undefined;
  filter?: 'with_payable' | 'overpaid' | 'settled' | string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface InventoryReportParams {
  [key: string]: string | number | boolean | null | undefined;
  category_id?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'all' | string;
  page?: number;
  per_page?: number;
}

export const reportsApi = {
  overview: async (params?: ReportDateFilterParams): Promise<ReportOverviewData> => {
    const res = await apiClient.get<ReportOverviewData>(API_ENDPOINTS.REPORTS.OVERVIEW, { params });
    return res.data;
  },

  sales: async (params?: ReportDateFilterParams): Promise<SalesReportResponseData> => {
    const res = await apiClient.get<SalesReportResponseData>(API_ENDPOINTS.REPORTS.SALES, { params });
    return res.data;
  },

  profit: async (params?: ReportDateFilterParams): Promise<any> => {
    const res = await apiClient.get(API_ENDPOINTS.REPORTS.PROFIT, { params });
    return res.data;
  },

  expenses: async (params?: ReportDateFilterParams & { category_id?: number; payment_method_id?: number; search?: string }): Promise<ExpensesReportData> => {
    const res = await apiClient.get<ExpensesReportData>(API_ENDPOINTS.REPORTS.EXPENSES, { params });
    return res.data;
  },

  customers: async (paramsOrFilter?: CustomerReportParams | 'debtors' | 'creditors'): Promise<CustomerReportData> => {
    const params = typeof paramsOrFilter === 'string'
      ? { filter: paramsOrFilter }
      : paramsOrFilter;

    const res = await apiClient.get<CustomerReportData>(API_ENDPOINTS.REPORTS.CUSTOMERS, { params });
    return res.data;
  },

  customerBalances: async (params?: CustomerReportParams): Promise<CustomerReportData> => {
    const res = await apiClient.get<CustomerReportData>(API_ENDPOINTS.REPORTS.CUSTOMER_BALANCES, { params });
    return res.data;
  },

  suppliers: async (paramsOrFilter?: SupplierReportParams | 'with_payable'): Promise<SupplierReportData> => {
    const params = typeof paramsOrFilter === 'string'
      ? { filter: paramsOrFilter }
      : paramsOrFilter;

    const res = await apiClient.get<SupplierReportData>(API_ENDPOINTS.REPORTS.SUPPLIERS, { params });
    return res.data;
  },

  supplierPayables: async (params?: SupplierReportParams): Promise<SupplierReportData> => {
    const res = await apiClient.get<SupplierReportData>(API_ENDPOINTS.REPORTS.SUPPLIER_PAYABLES, { params });
    return res.data;
  },

  inventory: async (params?: InventoryReportParams): Promise<InventoryReportData> => {
    const res = await apiClient.get<InventoryReportData>(API_ENDPOINTS.REPORTS.INVENTORY, { params });
    return res.data;
  },

  inventoryValuation: async (params?: InventoryReportParams): Promise<InventoryReportData> => {
    const res = await apiClient.get<InventoryReportData>(API_ENDPOINTS.REPORTS.INVENTORY_VALUATION, { params });
    return res.data;
  },

  payments: async (params?: ReportDateFilterParams): Promise<PaymentsReportData> => {
    const res = await apiClient.get<PaymentsReportData>(API_ENDPOINTS.REPORTS.PAYMENTS, { params });
    return res.data;
  },

  paymentMovements: async (params?: ReportDateFilterParams): Promise<PaymentsReportData> => {
    const res = await apiClient.get<PaymentsReportData>(API_ENDPOINTS.REPORTS.PAYMENT_MOVEMENTS, { params });
    return res.data;
  },

  documents: async (params?: HistoryFilterParams & { type?: 'invoices' | 'returns' }): Promise<any> => {
    const res = await apiClient.get(API_ENDPOINTS.REPORTS.DOCUMENTS, { params });
    return res.data;
  },

  invoicesHistory: async (params?: HistoryFilterParams): Promise<ReportInvoicesHistoryData> => {
    const res = await apiClient.get<ReportInvoicesHistoryData>(API_ENDPOINTS.REPORTS.INVOICES_HISTORY, { params });
    return res.data;
  },

  returnsHistory: async (params?: HistoryFilterParams): Promise<ReportReturnsHistoryData> => {
    const res = await apiClient.get<ReportReturnsHistoryData>(API_ENDPOINTS.REPORTS.RETURNS_HISTORY, { params });
    return res.data;
  },
};
