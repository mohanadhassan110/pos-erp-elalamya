export interface Category {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  products_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: number;
  category_id: number;
  category_name?: string;
  category_code?: string;
  name: string;
  barcode: string;
  purchase_cost: string;
  purchase_cost_formatted: string;
  wholesale_price: string;
  wholesale_price_formatted: string;
  retail_price: string;
  retail_price_formatted: string;
  stock_quantity: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  balance: string;
  balance_formatted: string;
  balance_status: 'debt' | 'credit' | 'settled';
  balance_status_label: string;
  created_at?: string;
  updated_at?: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  payable: string;
  payable_formatted: string;
  is_settled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StockReceiptItem {
  id: number;
  product_id: number;
  product_name?: string;
  product_barcode?: string;
  quantity: number;
  unit_cost: string;
  unit_cost_formatted: string;
  subtotal: string;
  subtotal_formatted: string;
}

export interface StockReceipt {
  id: number;
  receipt_number: string;
  supplier_id: number | null;
  supplier_name?: string | null;
  received_date: string;
  total_cost: string;
  total_cost_formatted: string;
  notes: string | null;
  items_count: number;
  items?: StockReceiptItem[];
  created_by?: string | null;
  created_at?: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  barcode: string;
  category_id: number;
  category_name?: string;
  current_stock: number;
  current_purchase_cost: string;
  current_purchase_cost_formatted: string;
  stock_valuation: string;
  stock_valuation_formatted: string;
  is_in_stock: boolean;
  is_active: boolean;
  updated_at?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  links?: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from?: number;
    last_page: number;
    path?: string;
    per_page: number;
    to?: number;
    total: number;
  };
}

export interface InventoryResponse {
  data: InventoryItem[];
  summary: {
    total_quantity: number;
    total_valuation: string;
    total_valuation_formatted: string;
  };
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface PaymentMethod {
  id: number;
  name: string;
  code: string;
  is_cash: boolean;
  is_active: boolean;
}

export interface InvoiceItem {
  id: number;
  product_id: number | null;
  item_type: 'product' | 'external';
  product_name: string;
  barcode: string | null;
  quantity: number;
  unit_sale_price: string;
  subtotal: string;
  unit_cost?: string;
  total_cost?: string;
  profit?: string;
}

export interface InvoicePayment {
  id: number;
  payment_method_id: number;
  payment_method_name: string;
  amount: string;
  notes: string | null;
  created_at?: string;
}

export interface InvoiceCustomer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  current_balance: string;
  prior_balance: string;
  resulting_balance: string;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  idempotency_key?: string | null;
  sale_type: 'retail' | 'wholesale';
  sale_type_label: string;
  status: 'posted' | 'cancelled';
  status_label: string;
  customer: InvoiceCustomer | null;
  subtotal: string;
  discount_amount: string;
  total: string;
  paid_amount: string;
  remaining_amount: string;
  credit_amount: string;
  notes: string | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  total_profit?: string;
  created_at?: string;
  creator: { id: number; name: string } | null;
}

export interface PrintableInvoiceItem {
  id: number;
  product_name: string;
  barcode: string | null;
  quantity: number;
  unit_price: string;
  unit_price_formatted: string;
  subtotal: string;
  subtotal_formatted: string;
}

export interface PrintableInvoicePayment {
  id: number;
  payment_method_id: number;
  payment_method_name: string;
  amount: string;
  amount_formatted: string;
  notes: string | null;
  paid_at?: string;
}

export interface PrintableInvoiceCustomer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  prior_balance: string;
  prior_balance_formatted: string;
  resulting_balance: string;
  resulting_balance_formatted: string;
  balance_status: string;
}

export interface PrintableInvoice {
  id: number;
  invoice_number: string;
  issue_date: string;
  issue_date_arabic: string;
  sale_type: 'retail' | 'wholesale';
  sale_type_label: string;
  is_wholesale: boolean;
  status: 'posted' | 'cancelled';
  status_label: string;
  customer: PrintableInvoiceCustomer | null;
  items: PrintableInvoiceItem[];
  items_count: number;
  total_units: number;
  subtotal: string;
  subtotal_formatted: string;
  discount_amount: string;
  discount_amount_formatted: string;
  total: string;
  total_formatted: string;
  paid_amount: string;
  paid_amount_formatted: string;
  remaining_amount: string;
  remaining_amount_formatted: string;
  credit_amount: string;
  credit_amount_formatted: string;
  payments: PrintableInvoicePayment[];
  notes: string | null;
  cashier_name: string;
  showroom: {
    name: string;
    subtitle: string;
    phone: string;
    address: string;
    return_policy: string;
    footer_note: string;
  };
}

export interface BarcodeLabel {
  product_id: number;
  product_name: string;
  barcode: string;
  category_name: string;
  category_code: string;
  retail_price: string;
  retail_price_formatted: string;
  wholesale_price: string;
  wholesale_price_formatted: string;
  stock_quantity: number;
  print_quantity: number;
  showroom_name: string;
}

export interface BarcodePreviewResponse {
  data: {
    labels: BarcodeLabel[];
    summary: {
      products_count: number;
      total_labels: number;
    };
  };
}

export interface CreateInvoiceItemPayload {
  type: 'product' | 'external';
  product_id?: number;
  product_name?: string;
  quantity: number;
  unit_sale_price?: string;
  purchase_cost?: string;
}

export interface CreateInvoicePaymentPayload {
  payment_method_id: number;
  amount: string;
  notes?: string;
}

export interface CreateInvoicePayload {
  sale_type: 'retail' | 'wholesale';
  customer_id?: number | null;
  idempotency_key?: string;
  notes?: string;
  items: CreateInvoiceItemPayload[];
  payments?: CreateInvoicePaymentPayload[];
}

export type SalesReturnResolution =
  | 'refund_cash'
  | 'exchange_equal'
  | 'exchange_upgrade'
  | 'customer_account_credit';

export interface ReturnableItem {
  id: number;
  invoice_item_id: number;
  product_id: number | null;
  item_type: 'product' | 'external';
  product_name: string;
  barcode: string | null;
  unit_sale_price: string;
  originally_sold_quantity: number;
  previously_returned_quantity: number;
  remaining_returnable_quantity: number;
  subtotal: string;
}

export interface ReturnableInvoice {
  id: number;
  invoice_number: string;
  sale_type: 'retail' | 'wholesale';
  sale_type_label: string;
  status: 'posted' | 'cancelled';
  status_label: string;
  total: string;
  paid_amount: string;
  remaining_amount: string;
  credit_amount: string;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  created_at_formatted: string;
  items: ReturnableItem[];
}

export interface SalesReturnItem {
  id: number;
  sales_return_id: number;
  invoice_item_id: number;
  product_id: number | null;
  product_name: string;
  barcode: string | null;
  quantity: number;
  unit_sale_price: string;
  subtotal: string;
  unit_cost?: string;
  profit_reversal?: string;
}

export interface SalesReturn {
  id: number;
  return_number: string;
  idempotency_key: string | null;
  invoice_id: number;
  invoice_number: string;
  customer_id: number | null;
  customer_name: string | null;
  resolution: SalesReturnResolution;
  resolution_label: string;
  total_return_amount: string;
  replacement_invoice_id: number | null;
  difference_amount: string;
  notes: string | null;
  items: SalesReturnItem[];
  created_by: number | null;
  creator_name: string | null;
  created_at: string;
  created_at_formatted: string;
  total_profit_reversed?: string;
}

export interface CreateReturnItemPayload {
  invoice_item_id: number;
  quantity: number;
}

export interface CreateReplacementItemPayload {
  product_id: number;
  quantity: number;
  unit_sale_price?: string;
}

export interface CreateSalesReturnPayload {
  idempotency_key?: string;
  invoice_id: number;
  resolution: SalesReturnResolution;
  notes?: string;
  items: CreateReturnItemPayload[];
  payment_method_id?: number;
  replacement_items?: CreateReplacementItemPayload[];
  difference_payment_method_id?: number;
}

// --------------------------------------------------------------------------
// Phase 6: Financial and Operational Reports Types
// --------------------------------------------------------------------------

export type ReportPeriodPreset = 'today' | 'this_week' | 'this_month' | 'custom';

export interface ReportDateFilterParams {
  [key: string]: string | number | boolean | null | undefined;
  range_preset?: ReportPeriodPreset;
  period?: ReportPeriodPreset;
  start_date?: string;
  end_date?: string;
  from_date?: string;
  to_date?: string;
}

export interface ReportOverviewData {
  period: string;
  start_date: string;
  end_date: string;
  gross_sales: string;
  total_returns: string;
  net_sales: string;
  invoices_count: number;
  net_cogs: string;
  net_realized_gross_profit: string;
  profit_margin_percentage: string;
  total_expenses: string;
  general_expenses: string;
  external_product_expenses: string;
  net_operating_result: string;
  total_customer_debts: string;
  total_customer_credits: string;
  debtors_count: number;
  total_supplier_payables: string;
  with_payable_suppliers_count: number;
  total_inventory_valuation: string;
  total_stock_units: number;
  low_stock_products_count: number;
  total_payment_inflows: string;
  total_refund_outflows: string;
  net_cash_movement: string;
}

export interface SalesCategoryBreakdown {
  category_name: string;
  quantity_sold: number;
  revenue: string;
  cogs: string;
  profit: string;
}

export interface SalesSummaryData {
  gross_sales: string;
  retail_sales: string;
  wholesale_sales: string;
  replacement_sales: string;
  invoices_count: number;
  items_sold_count: number;
  total_returns: string;
  returns_count: number;
  cash_refunds_total: string;
  account_credits_total: string;
  exchanges_total: string;
  difference_collected_total: string;
  items_returned_count: number;
  net_sales: string;
}

export interface RealizedProfitData {
  gross_revenue: string;
  gross_cogs: string;
  gross_profit: string;
  returned_revenue: string;
  returned_cogs_reversal: string;
  profit_reversal: string;
  net_revenue: string;
  net_cogs: string;
  net_profit: string;
  profit_margin_percentage: string;
  categories_breakdown: SalesCategoryBreakdown[];
}

export interface ProfitReportData extends RealizedProfitData {
  period: string;
  start_date: string;
  end_date: string;
  total_expenses: string;
  general_expenses: string;
  external_product_expenses: string;
  net_operating_result: string;
  policy_c_notice: string;
  formula: {
    gross_profit: string;
    net_realized_gross_profit: string;
    net_operating_result: string;
  };
}

export interface ReportPagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface SalesReportResponseData {
  period: string;
  start_date: string;
  end_date: string;
  sales_summary: SalesSummaryData;
  profit_analysis: RealizedProfitData;
}

export interface ExpenseCategoryBreakdown {
  category_name: string;
  code: string | null;
  is_external_product: boolean;
  total_amount: string;
  count: number;
}

export interface ExpensePaymentMethodBreakdown {
  payment_method_name: string;
  total_amount: string;
  count: number;
}

export interface ExpenseReportItem {
  id: number;
  expense_date: string;
  category_name: string;
  is_external_product: boolean;
  payment_method_name: string;
  amount: string;
  description: string | null;
  reference_type: string | null;
}

export interface ExpensesReportData {
  period: string;
  start_date: string;
  end_date: string;
  total_expenses: string;
  general_expenses: string;
  external_product_expenses: string;
  categories: ExpenseCategoryBreakdown[];
  payment_methods: ExpensePaymentMethodBreakdown[];
  items: ExpenseReportItem[];
  policy_c_notice?: string;
}

export interface CustomerReportRow {
  id: number;
  name: string;
  phone: string | null;
  is_active: boolean;
  total_debits: string;
  total_credits: string;
  balance: string;
  status: 'debtor' | 'creditor' | 'settled';
  transactions_count: number;
}

export interface CustomerReportData {
  total_receivable_debts: string;
  total_customer_credits: string;
  net_ledger_balance: string;
  total_customers_count: number;
  debtors_count: number;
  creditors_count: number;
  settled_count: number;
  customers: CustomerReportRow[];
  pagination?: ReportPagination;
}

export interface SupplierReportRow {
  id: number;
  name: string;
  phone: string | null;
  is_active: boolean;
  total_purchases_credits: string;
  total_payments_debits: string;
  payable_balance: string;
  status: 'payable' | 'overpaid' | 'settled';
  transactions_count: number;
}

export interface SupplierReportData {
  total_payables_owed: string;
  total_overpayments: string;
  net_supplier_payable: string;
  total_suppliers_count: number;
  with_payable_count: number;
  overpaid_count: number;
  settled_count: number;
  suppliers: SupplierReportRow[];
  pagination?: ReportPagination;
  manual_adjustment_notice?: string;
}

export interface InventoryCategoryValuation {
  category_name: string;
  category_id: number;
  products_count: number;
  total_units: number;
  cost_valuation: string;
  retail_valuation: string;
}

export interface InventoryProductValuation {
  id: number;
  name: string;
  barcode: string;
  category_name: string;
  is_active: boolean;
  stock_quantity: number;
  purchase_cost: string;
  wholesale_price: string;
  retail_price: string;
  cost_valuation: string;
  retail_valuation: string;
}

export interface InventoryReportData {
  total_products_count?: number;
  total_units_in_stock: number;
  total_cost_valuation: string;
  total_retail_valuation: string;
  total_wholesale_valuation: string;
  low_stock_count: number;
  out_of_stock_count: number;
  categories: InventoryCategoryValuation[];
  products: InventoryProductValuation[];
  pagination?: ReportPagination;
  valuation_methodology?: string;
}

export interface PaymentMethodBreakdownItem {
  payment_method_name: string;
  code: string;
  is_cash: boolean;
  inflows: string;
  outflows: string;
  count: number;
}

export interface PaymentReportItem {
  id: number;
  payment_number: string;
  payment_type: string;
  payment_type_label: string;
  payment_method_name: string;
  amount: string;
  is_outflow: boolean;
  paid_at: string;
  notes: string | null;
}

export interface PaymentsReportData {
  period: string;
  start_date: string;
  end_date: string;
  total_inflows: string;
  total_outflows: string;
  invoice_payments_total: string;
  exchange_payments_total: string;
  refunds_total: string;
  cash_inflows: string;
  cash_outflows: string;
  net_cash_movement: string;
  payment_methods: PaymentMethodBreakdownItem[];
  payments: PaymentReportItem[];
}

export interface ReportInvoiceHistoryItem {
  id: number;
  invoice_number: string;
  created_at: string;
  customer_name: string;
  sale_type: 'retail' | 'wholesale';
  sale_type_label: string;
  status: 'posted' | 'cancelled';
  status_label: string;
  total: string;
  paid_amount: string;
  remaining_amount: string;
  items_count: number;
}

export interface ReportInvoicesHistoryData {
  items: ReportInvoiceHistoryItem[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface ReportReturnHistoryItem {
  id: number;
  return_number: string;
  created_at: string;
  invoice_number: string;
  customer_name: string;
  resolution: string;
  resolution_label: string;
  total_return_amount: string;
  difference_amount: string;
  items_count: number;
}

export interface ReportReturnsHistoryData {
  items: ReportReturnHistoryItem[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

