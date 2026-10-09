export const API_ENDPOINTS = {
  HEALTH: '/health',
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
  },
  SYSTEM: {
    OWNER_CHECK: '/system/owner-check',
    CASHIER_CHECK: '/system/cashier-check',
  },
  CATEGORIES: {
    BASE: '/categories',
    BY_ID: (id: number) => `/categories/${id}`,
    STATUS: (id: number) => `/categories/${id}/status`,
  },
  PRODUCTS: {
    BASE: '/products',
    BY_ID: (id: number) => `/products/${id}`,
    BY_BARCODE: (barcode: string) => `/products/barcode/${encodeURIComponent(barcode)}`,
    STATUS: (id: number) => `/products/${id}/status`,
    BARCODE_PREVIEW: '/products/barcodes/print-preview',
  },
  PAYMENT_METHODS: {
    BASE: '/payment-methods',
  },
  CUSTOMERS: {
    BASE: '/customers',
    BY_ID: (id: number) => `/customers/${id}`,
    STATUS: (id: number) => `/customers/${id}/status`,
  },
  SUPPLIERS: {
    BASE: '/suppliers',
    BY_ID: (id: number) => `/suppliers/${id}`,
    STATUS: (id: number) => `/suppliers/${id}/status`,
    ADD_BALANCE: (id: number) => `/suppliers/${id}/add-balance`,
  },
  STOCK_RECEIPTS: {
    BASE: '/stock-receipts',
    BY_ID: (id: number) => `/stock-receipts/${id}`,
  },
  INVOICES: {
    BASE: '/invoices',
    BY_ID: (id: number) => `/invoices/${id}`,
    PRINT: (id: number) => `/invoices/${id}/print`,
  },
  INVENTORY: {
    BASE: '/inventory',
  },
  RETURNS: {
    BASE: '/returns',
    BY_ID: (id: number) => `/returns/${id}`,
    SEARCH_INVOICE: '/returns/search-invoice',
    BY_INVOICE: (invoiceId: number) => `/returns/invoice/${invoiceId}`,
  },
  REPORTS: {
    OVERVIEW: '/reports/overview',
    SALES: '/reports/sales',
    PROFIT: '/reports/profit',
    EXPENSES: '/reports/expenses',
    CUSTOMERS: '/reports/customers',
    CUSTOMER_BALANCES: '/reports/customer-balances',
    SUPPLIERS: '/reports/suppliers',
    SUPPLIER_PAYABLES: '/reports/supplier-payables',
    INVENTORY: '/reports/inventory',
    INVENTORY_VALUATION: '/reports/inventory-valuation',
    PAYMENTS: '/reports/payments',
    PAYMENT_MOVEMENTS: '/reports/payment-movements',
    DOCUMENTS: '/reports/documents',
    INVOICES_HISTORY: '/reports/history/invoices',
    RETURNS_HISTORY: '/reports/history/returns',
  },
} as const;
