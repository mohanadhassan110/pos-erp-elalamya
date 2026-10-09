<?php

namespace App\Services\Reports;

use App\Domain\Support\Money;
use Carbon\Carbon;

class ReportSummaryService
{
    public function __construct(
        protected SalesReportService $salesService,
        protected ExpenseReportService $expenseService,
        protected CustomerReportService $customerService,
        protected SupplierReportService $supplierService,
        protected InventoryReportService $inventoryService,
        protected PaymentReportService $paymentService
    ) {}

    /**
     * Compute comprehensive financial and operational overview metrics.
     */
    public function getOverview(Carbon $startUtc, Carbon $endUtc, string $startDate, string $endDate, string $period): array
    {
        $sales = $this->salesService->getSummary($startUtc, $endUtc);
        $profit = $this->salesService->getRealizedProfit($startUtc, $endUtc);
        $expenses = $this->expenseService->getSummary($startDate, $endDate);
        $customers = $this->customerService->getSummary();
        $suppliers = $this->supplierService->getSummary();
        $inventory = $this->inventoryService->getSummary();
        $payments = $this->paymentService->getSummary($startUtc, $endUtc);

        // Net Operating Result = Net Realized Gross Profit - General Showroom Expenses
        // (Note: External product expenses are direct COGS and excluded from general expenses to prevent double-subtraction)
        $netRealizedProfit = Money::fromDecimal($profit['net_profit']);
        $generalExpenses = Money::fromDecimal($expenses['general_expenses']);
        $netOperatingResult = $netRealizedProfit->subtract($generalExpenses);

        return [
            'period' => $period,
            'start_date' => $startDate,
            'end_date' => $endDate,

            // Sales & Revenue
            'gross_sales' => $sales['gross_sales'],
            'total_returns' => $sales['total_returns'],
            'net_sales' => $sales['net_sales'],
            'invoices_count' => $sales['invoices_count'],

            // Profit & COGS
            'net_cogs' => $profit['net_cogs'],
            'net_realized_gross_profit' => $profit['net_profit'],
            'profit_margin_percentage' => $profit['profit_margin_percentage'],

            // Expenses
            'total_expenses' => $expenses['total_expenses'],
            'general_expenses' => $expenses['general_expenses'],
            'external_product_expenses' => $expenses['external_product_expenses'],

            // Net Operating Result
            'net_operating_result' => $netOperatingResult->toDecimal(),

            // Ledgers
            'total_customer_debts' => $customers['total_receivable_debts'],
            'total_customer_credits' => $customers['total_customer_credits'],
            'debtors_count' => $customers['debtors_count'],

            'total_supplier_payables' => $suppliers['total_payables_owed'],
            'with_payable_suppliers_count' => $suppliers['with_payable_count'],

            // Inventory
            'total_inventory_valuation' => $inventory['total_cost_valuation'],
            'total_stock_units' => $inventory['total_units_in_stock'],
            'low_stock_products_count' => $inventory['low_stock_count'],

            // Cash & Payments
            'total_payment_inflows' => $payments['total_inflows'],
            'total_refund_outflows' => $payments['total_outflows'],
            'net_cash_movement' => $payments['net_cash_movement'],
        ];
    }
}
