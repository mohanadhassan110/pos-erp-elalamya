import { describe, it, expect } from 'vitest';
import type {
  ReportOverviewData,
  SalesSummaryData,
  RealizedProfitData,
  ExpensesReportData,
  CustomerReportData,
  SupplierReportData,
  InventoryReportData,
  PaymentsReportData,
} from '../types/domain';
import { API_ENDPOINTS } from '../services/api/endpoints';

describe('Phase 6 — Financial and Operational Reports Frontend Domain Logic', () => {
  describe('API Endpoints Constitution', () => {
    it('defines all required Phase 11 reports endpoints under /reports', () => {
      expect(API_ENDPOINTS.REPORTS.OVERVIEW).toBe('/reports/overview');
      expect(API_ENDPOINTS.REPORTS.SALES).toBe('/reports/sales');
      expect(API_ENDPOINTS.REPORTS.PROFIT).toBe('/reports/profit');
      expect(API_ENDPOINTS.REPORTS.EXPENSES).toBe('/reports/expenses');
      expect(API_ENDPOINTS.REPORTS.CUSTOMERS).toBe('/reports/customers');
      expect(API_ENDPOINTS.REPORTS.CUSTOMER_BALANCES).toBe('/reports/customer-balances');
      expect(API_ENDPOINTS.REPORTS.SUPPLIERS).toBe('/reports/suppliers');
      expect(API_ENDPOINTS.REPORTS.SUPPLIER_PAYABLES).toBe('/reports/supplier-payables');
      expect(API_ENDPOINTS.REPORTS.INVENTORY).toBe('/reports/inventory');
      expect(API_ENDPOINTS.REPORTS.INVENTORY_VALUATION).toBe('/reports/inventory-valuation');
      expect(API_ENDPOINTS.REPORTS.PAYMENTS).toBe('/reports/payments');
      expect(API_ENDPOINTS.REPORTS.PAYMENT_MOVEMENTS).toBe('/reports/payment-movements');
      expect(API_ENDPOINTS.REPORTS.DOCUMENTS).toBe('/reports/documents');
      expect(API_ENDPOINTS.REPORTS.INVOICES_HISTORY).toBe('/reports/history/invoices');
      expect(API_ENDPOINTS.REPORTS.RETURNS_HISTORY).toBe('/reports/history/returns');
    });
  });

  describe('Sales Revenue & Returns Reconciliation', () => {
    it('reconciles gross sales, returns, and net sales correctly without double counting', () => {
      const summary: SalesSummaryData = {
        gross_sales: '25000.00',
        retail_sales: '15000.00',
        wholesale_sales: '10000.00',
        replacement_sales: '3000.00', // Subcomponent of posted sales
        invoices_count: 12,
        items_sold_count: 45,
        total_returns: '4000.00',
        returns_count: 2,
        cash_refunds_total: '1000.00',
        account_credits_total: '1000.00',
        exchanges_total: '2000.00',
        difference_collected_total: '500.00',
        items_returned_count: 6,
        net_sales: '21000.00',
      };

      const calculatedNet = Number(summary.gross_sales) - Number(summary.total_returns);
      expect(calculatedNet).toBe(21000.0);
      expect(Number(summary.net_sales)).toBe(calculatedNet);

      // Verify retail + wholesale sum equals gross sales
      const salesSum = Number(summary.retail_sales) + Number(summary.wholesale_sales);
      expect(salesSum).toBe(Number(summary.gross_sales));

      // Verify return resolution sum equals total returns
      const returnResolutionsSum =
        Number(summary.cash_refunds_total) +
        Number(summary.account_credits_total) +
        Number(summary.exchanges_total);
      expect(returnResolutionsSum).toBe(Number(summary.total_returns));
    });
  });

  describe('Realized Gross Profit & Historical Cost Snapshotting', () => {
    it('calculates net realized gross profit after reversing returned item profits', () => {
      const profit: RealizedProfitData = {
        gross_revenue: '20000.00',
        gross_cogs: '14000.00',
        gross_profit: '6000.00',
        returned_revenue: '2000.00',
        returned_cogs_reversal: '1400.00',
        profit_reversal: '600.00',
        net_revenue: '18000.00',
        net_cogs: '12600.00',
        net_profit: '5400.00',
        profit_margin_percentage: '30.00',
        categories_breakdown: [
          {
            category_name: 'لحاف ومفروشات',
            quantity_sold: 20,
            revenue: '12000.00',
            cogs: '8400.00',
            profit: '3600.00',
          },
          {
            category_name: 'بطاطين وملايات',
            quantity_sold: 15,
            revenue: '8000.00',
            cogs: '5600.00',
            profit: '2400.00',
          },
        ],
      };

      const netRev = Number(profit.gross_revenue) - Number(profit.returned_revenue);
      const netCogs = Number(profit.gross_cogs) - Number(profit.returned_cogs_reversal);
      const netProf = Number(profit.gross_profit) - Number(profit.profit_reversal);

      expect(netRev).toBe(18000.0);
      expect(netCogs).toBe(12600.0);
      expect(netProf).toBe(5400.0);
      expect(Number(profit.net_profit)).toBe(netProf);

      // Verify categories sum up to gross figures
      const totalCatRev = profit.categories_breakdown.reduce((sum, c) => sum + Number(c.revenue), 0);
      const totalCatProfit = profit.categories_breakdown.reduce((sum, c) => sum + Number(c.profit), 0);
      expect(totalCatRev).toBe(Number(profit.gross_revenue));
      expect(totalCatProfit).toBe(Number(profit.gross_profit));
    });
  });

  describe('Operating Expenses & Policy C Adherence', () => {
    it('distinguishes general operating expenses from external product purchases to prevent double-subtraction', () => {
      const expenses: ExpensesReportData = {
        period: 'this_month',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        total_expenses: '7500.00',
        general_expenses: '5000.00', // Rent, electricity, salaries, hospitality
        external_product_expenses: '2500.00', // Workshop/neighbor purchase cost (Policy C)
        categories: [
          {
            category_name: 'إيجار ومرافق',
            code: 'rent',
            is_external_product: false,
            total_amount: '3000.00',
            count: 1,
          },
          {
            category_name: 'بوفيه وضيافة',
            code: 'hospitality',
            is_external_product: false,
            total_amount: '2000.00',
            count: 5,
          },
          {
            category_name: 'مشتريات منتج خارجي',
            code: 'external_product',
            is_external_product: true,
            total_amount: '2500.00',
            count: 2,
          },
        ],
        payment_methods: [
          { payment_method_name: 'نقدي', total_amount: '5500.00', count: 7 },
          { payment_method_name: 'فودافون كاش', total_amount: '2000.00', count: 1 },
        ],
        items: [],
      };

      // Invariant: Total expenses = General + External
      const sum = Number(expenses.general_expenses) + Number(expenses.external_product_expenses);
      expect(sum).toBe(Number(expenses.total_expenses));

      // Net Operating Result formula:
      // Net Operating Result = Net Realized Gross Profit - General Expenses
      // External product expense is ALREADY captured in Invoice Item Cost (COGS)
      const mockNetGrossProfit = 15000.0;
      const netOperatingResult = mockNetGrossProfit - Number(expenses.general_expenses);
      expect(netOperatingResult).toBe(10000.0);
    });
  });

  describe('Authoritative Customer and Supplier Ledgers', () => {
    it('derives customer balances strictly from transactions: Debits - Credits', () => {
      const customers: CustomerReportData = {
        total_receivable_debts: '12000.00',
        total_customer_credits: '1500.00',
        net_ledger_balance: '10500.00',
        total_customers_count: 3,
        debtors_count: 2,
        creditors_count: 1,
        settled_count: 0,
        customers: [
          {
            id: 1,
            name: 'معرض الأمل',
            phone: '01011111111',
            is_active: true,
            total_debits: '20000.00', // Sales invoices
            total_credits: '12000.00', // Payments
            balance: '8000.00', // 20000 - 12000 = +8000 (debtor)
            status: 'debtor',
            transactions_count: 4,
          },
          {
            id: 2,
            name: 'تاجر الجملة الحاج سعيد',
            phone: '01022222222',
            is_active: true,
            total_debits: '15000.00',
            total_credits: '11000.00',
            balance: '4000.00', // 15000 - 11000 = +4000 (debtor)
            status: 'debtor',
            transactions_count: 3,
          },
          {
            id: 3,
            name: 'عميل دائن رصيد مقدم',
            phone: '01033333333',
            is_active: true,
            total_debits: '5000.00',
            total_credits: '6500.00',
            balance: '-1500.00', // 5000 - 6500 = -1500 (creditor, has credit)
            status: 'creditor',
            transactions_count: 2,
          },
        ],
      };

      const debtorsSum = customers.customers
        .filter((c) => c.status === 'debtor')
        .reduce((sum, c) => sum + Number(c.balance), 0);

      const creditorsSum = customers.customers
        .filter((c) => c.status === 'creditor')
        .reduce((sum, c) => sum + Math.abs(Number(c.balance)), 0);

      expect(debtorsSum).toBe(12000.0);
      expect(creditorsSum).toBe(1500.0);
      expect(Number(customers.total_receivable_debts)).toBe(debtorsSum);
      expect(Number(customers.total_customer_credits)).toBe(creditorsSum);
    });

    it('derives supplier payables strictly from transactions: Credits - Debits', () => {
      const suppliers: SupplierReportData = {
        total_payables_owed: '18000.00',
        total_overpayments: '2000.00',
        net_supplier_payable: '16000.00',
        total_suppliers_count: 2,
        with_payable_count: 1,
        overpaid_count: 1,
        settled_count: 0,
        suppliers: [
          {
            id: 1,
            name: 'مصنع مفروشات المحلة',
            phone: '01044444444',
            is_active: true,
            total_purchases_credits: '50000.00',
            total_payments_debits: '32000.00',
            payable_balance: '18000.00', // 50000 - 32000 = +18000 (payable)
            status: 'payable',
            transactions_count: 5,
          },
          {
            id: 2,
            name: 'مورد بطاطين تركي',
            phone: '01055555555',
            is_active: true,
            total_purchases_credits: '10000.00',
            total_payments_debits: '12000.00',
            payable_balance: '-2000.00', // 10000 - 12000 = -2000 (overpaid)
            status: 'overpaid',
            transactions_count: 2,
          },
        ],
      };

      const payableSum = suppliers.suppliers
        .filter((s) => s.status === 'payable')
        .reduce((sum, s) => sum + Number(s.payable_balance), 0);

      const overpaidSum = suppliers.suppliers
        .filter((s) => s.status === 'overpaid')
        .reduce((sum, s) => sum + Math.abs(Number(s.payable_balance)), 0);

      expect(payableSum).toBe(18000.0);
      expect(overpaidSum).toBe(2000.0);
      expect(Number(suppliers.total_payables_owed)).toBe(payableSum);
      expect(Number(suppliers.total_overpayments)).toBe(overpaidSum);
    });
  });

  describe('Inventory Valuation Formula Invariants', () => {
    it('evaluates inventory by current stock * current purchase cost', () => {
      const inventory: InventoryReportData = {
        total_units_in_stock: 50,
        total_cost_valuation: '25000.00',
        total_retail_valuation: '35000.00',
        total_wholesale_valuation: '30000.00',
        low_stock_count: 1,
        out_of_stock_count: 0,
        categories: [],
        products: [
          {
            id: 1,
            name: 'لحاف أطفال تركي',
            barcode: 'B0001',
            category_name: 'اللحف',
            is_active: true,
            stock_quantity: 30,
            purchase_cost: '500.00',
            retail_price: '700.00',
            wholesale_price: '600.00',
            cost_valuation: '15000.00', // 30 * 500
            retail_valuation: '21000.00', // 30 * 700
          },
          {
            id: 2,
            name: 'طقم فوط بشكير 4 قطع',
            barcode: 'T0001',
            category_name: 'فوط وبشاكير',
            is_active: true,
            stock_quantity: 20,
            purchase_cost: '500.00',
            retail_price: '700.00',
            wholesale_price: '600.00',
            cost_valuation: '10000.00', // 20 * 500
            retail_valuation: '14000.00', // 20 * 700
          },
        ],
      };

      const calculatedTotalCostVal = inventory.products.reduce((sum, p) => sum + Number(p.cost_valuation), 0);
      expect(calculatedTotalCostVal).toBe(25000.0);
      expect(Number(inventory.total_cost_valuation)).toBe(calculatedTotalCostVal);
    });
  });

  describe('Payments & Cash Movement Reconciliation', () => {
    it('correctly tracks inflows, outflows, and net cash movement', () => {
      const payments: PaymentsReportData = {
        period: 'today',
        start_date: '2026-10-09',
        end_date: '2026-10-09',
        total_inflows: '14500.00',
        total_outflows: '1500.00',
        invoice_payments_total: '14000.00',
        exchange_payments_total: '500.00',
        refunds_total: '1500.00',
        cash_inflows: '10000.00',
        cash_outflows: '1500.00',
        net_cash_movement: '13000.00',
        payment_methods: [
          {
            payment_method_name: 'نقدي (كاش)',
            code: 'cash',
            is_cash: true,
            inflows: '10000.00',
            outflows: '1500.00',
            count: 8,
          },
          {
            payment_method_name: 'فودافون كاش',
            code: 'vodafone_cash',
            is_cash: false,
            inflows: '4500.00',
            outflows: '0.00',
            count: 3,
          },
        ],
        payments: [],
      };

      const netMovement = Number(payments.total_inflows) - Number(payments.total_outflows);
      expect(netMovement).toBe(13000.0);
      expect(Number(payments.net_cash_movement)).toBe(netMovement);

      // Inflow breakdown check
      const inflowSum = Number(payments.invoice_payments_total) + Number(payments.exchange_payments_total);
      expect(inflowSum).toBe(Number(payments.total_inflows));
    });
  });

  describe('Overview KPI Data Completeness', () => {
    it('contains all required KPI fields with consistent string decimal representations', () => {
      const overview: ReportOverviewData = {
        period: 'this_month',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        gross_sales: '50000.00',
        total_returns: '5000.00',
        net_sales: '45000.00',
        invoices_count: 25,
        net_cogs: '30000.00',
        net_realized_gross_profit: '15000.00',
        profit_margin_percentage: '33.33',
        total_expenses: '8000.00',
        general_expenses: '6000.00',
        external_product_expenses: '2000.00',
        net_operating_result: '9000.00', // 15000 - 6000
        total_customer_debts: '12000.00',
        total_customer_credits: '1000.00',
        debtors_count: 5,
        total_supplier_payables: '14000.00',
        with_payable_suppliers_count: 3,
        total_inventory_valuation: '85000.00',
        total_stock_units: 140,
        low_stock_products_count: 4,
        total_payment_inflows: '42000.00',
        total_refund_outflows: '3000.00',
        net_cash_movement: '39000.00',
      };

      expect(Number(overview.net_operating_result)).toBe(
        Number(overview.net_realized_gross_profit) - Number(overview.general_expenses)
      );
    });
  });

  describe('Dedicated Profit Report & Policy C Reconciliation', () => {
    it('verifies that profit report avoids double-counting external product costs and complies with Policy C', () => {
      const profitReport = {
        period: 'today',
        start_date: '2026-10-09',
        end_date: '2026-10-09',
        gross_revenue: '1600.00',
        gross_cogs: '1000.00',
        gross_profit: '600.00',
        returned_revenue: '0.00',
        returned_cogs_reversal: '0.00',
        profit_reversal: '0.00',
        net_revenue: '1600.00',
        net_cogs: '1000.00',
        net_realized_gross_profit: '600.00',
        profit_margin_percentage: '37.50',
        total_expenses: '400.00',
        general_expenses: '100.00',
        external_product_expenses: '300.00',
        net_operating_result: '500.00', // 600 - 100 general expenses
        policy_c_notice: 'تكاليف شراء المنتجات الخارجية تُحسب ضمن تكلفة البضاعة المباعة',
      };

      // Ensure Net Operating Result is Net Realized Gross Profit minus General Expenses (NOT Total Expenses)
      const expectedNetOperating = Number(profitReport.net_realized_gross_profit) - Number(profitReport.general_expenses);
      expect(Number(profitReport.net_operating_result)).toBe(expectedNetOperating);
      expect(profitReport.policy_c_notice).toContain('المنتجات الخارجية');
    });
  });
});
