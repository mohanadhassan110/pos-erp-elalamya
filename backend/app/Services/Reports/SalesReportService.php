<?php

namespace App\Services\Reports;

use App\Domain\Returns\Enums\SalesReturnResolution;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Sales\Enums\SaleType;
use App\Domain\Support\Money;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use Carbon\Carbon;

class SalesReportService
{
    /**
     * Compute sales revenue and returns summary for the given date range.
     */
    public function getSummary(Carbon $startUtc, Carbon $endUtc): array
    {
        // 1. Posted Invoices within period (cancelled invoices are strictly excluded per AGENTS.md Constitution)
        $invoices = Invoice::where('status', InvoiceStatus::POSTED)
            ->whereBetween('created_at', [$startUtc, $endUtc])
            ->with(['items.product.category'])
            ->get();

        // Load all replacement invoice IDs linked in sales returns to prevent misidentification
        $replacementInvoiceIds = SalesReturn::whereNotNull('replacement_invoice_id')
            ->pluck('replacement_invoice_id')
            ->flip();

        $grossSales = Money::zero();
        $retailSales = Money::zero();
        $wholesaleSales = Money::zero();
        $replacementSales = Money::zero();
        $totalItemsSold = 0;

        foreach ($invoices as $invoice) {
            $grossSales = $grossSales->add($invoice->total);

            if ($invoice->sale_type === SaleType::RETAIL) {
                $retailSales = $retailSales->add($invoice->total);
            } else {
                $wholesaleSales = $wholesaleSales->add($invoice->total);
            }

            $isReplacement = $replacementInvoiceIds->has($invoice->id)
                || (! empty($invoice->notes) && str_contains($invoice->notes, 'فاتورة استبدال'));

            if ($isReplacement) {
                $replacementSales = $replacementSales->add($invoice->total);
            }

            foreach ($invoice->items as $item) {
                $totalItemsSold += $item->quantity->toInt();
            }
        }

        // 2. Sales Returns within period
        $returns = SalesReturn::whereBetween('created_at', [$startUtc, $endUtc])
            ->with(['items'])
            ->get();

        $totalReturnsValue = Money::zero();
        $cashRefundsTotal = Money::zero();
        $accountCreditsTotal = Money::zero();
        $exchangesTotal = Money::zero();
        $totalDifferenceCollected = Money::zero();
        $totalItemsReturned = 0;

        foreach ($returns as $ret) {
            $totalReturnsValue = $totalReturnsValue->add($ret->total_return_amount);
            $totalDifferenceCollected = $totalDifferenceCollected->add($ret->difference_amount);

            if ($ret->resolution === SalesReturnResolution::REFUND_CASH) {
                $cashRefundsTotal = $cashRefundsTotal->add($ret->total_return_amount);
            } elseif ($ret->resolution === SalesReturnResolution::CUSTOMER_ACCOUNT_CREDIT) {
                $accountCreditsTotal = $accountCreditsTotal->add($ret->total_return_amount);
            } elseif ($ret->resolution === SalesReturnResolution::EXCHANGE_EQUAL || $ret->resolution === SalesReturnResolution::EXCHANGE_UPGRADE) {
                $exchangesTotal = $exchangesTotal->add($ret->total_return_amount);
            }

            foreach ($ret->items as $rItem) {
                $totalItemsReturned += $rItem->quantity->toInt();
            }
        }

        $netSales = $grossSales->subtract($totalReturnsValue);

        return [
            'gross_sales' => $grossSales->toDecimal(),
            'retail_sales' => $retailSales->toDecimal(),
            'wholesale_sales' => $wholesaleSales->toDecimal(),
            'replacement_sales' => $replacementSales->toDecimal(),
            'invoices_count' => $invoices->count(),
            'items_sold_count' => $totalItemsSold,

            'total_returns' => $totalReturnsValue->toDecimal(),
            'returns_count' => $returns->count(),
            'cash_refunds_total' => $cashRefundsTotal->toDecimal(),
            'account_credits_total' => $accountCreditsTotal->toDecimal(),
            'exchanges_total' => $exchangesTotal->toDecimal(),
            'difference_collected_total' => $totalDifferenceCollected->toDecimal(),
            'items_returned_count' => $totalItemsReturned,

            'net_sales' => $netSales->toDecimal(),
            'included_statuses' => ['posted'],
            'excluded_statuses' => ['cancelled'],
        ];
    }

    /**
     * Compute realized gross profit, historical COGS, and profit reversal for the date range.
     */
    public function getRealizedProfit(Carbon $startUtc, Carbon $endUtc): array
    {
        // 1. Posted invoice items within period
        $postedInvoiceIds = Invoice::where('status', InvoiceStatus::POSTED)
            ->whereBetween('created_at', [$startUtc, $endUtc])
            ->pluck('id');

        $invoiceItems = InvoiceItem::whereIn('invoice_id', $postedInvoiceIds)
            ->with(['product.category'])
            ->get();

        $grossRevenue = Money::zero();
        $grossCogs = Money::zero();
        $grossProfit = Money::zero();

        // Category breakdown for sales
        $categoryBreakdown = [];

        foreach ($invoiceItems as $item) {
            $grossRevenue = $grossRevenue->add($item->subtotal);
            $grossCogs = $grossCogs->add($item->total_cost);
            $grossProfit = $grossProfit->add($item->profit);

            $catName = $item->product?->category?->name ?? 'أصناف متنوعة / منتجات خارجية';
            if (! isset($categoryBreakdown[$catName])) {
                $categoryBreakdown[$catName] = [
                    'category_name' => $catName,
                    'quantity_sold' => 0,
                    'revenue' => Money::zero(),
                    'cogs' => Money::zero(),
                    'profit' => Money::zero(),
                ];
            }

            $categoryBreakdown[$catName]['quantity_sold'] += $item->quantity->toInt();
            $categoryBreakdown[$catName]['revenue'] = $categoryBreakdown[$catName]['revenue']->add($item->subtotal);
            $categoryBreakdown[$catName]['cogs'] = $categoryBreakdown[$catName]['cogs']->add($item->total_cost);
            $categoryBreakdown[$catName]['profit'] = $categoryBreakdown[$catName]['profit']->add($item->profit);
        }

        // 2. Sales return items within period
        $returnIds = SalesReturn::whereBetween('created_at', [$startUtc, $endUtc])->pluck('id');
        $returnItems = SalesReturnItem::whereIn('sales_return_id', $returnIds)
            ->with(['invoiceItem', 'product.category'])
            ->get();

        $returnedRevenue = Money::zero();
        $returnedCogsReversal = Money::zero();
        $profitReversal = Money::zero();

        foreach ($returnItems as $rItem) {
            $returnedRevenue = $returnedRevenue->add($rItem->subtotal);

            $isExternal = $rItem->product_id === null
                || ($rItem->invoiceItem && $rItem->invoiceItem->isExternalProduct());

            if ($isExternal) {
                // Policy C (External Product Returns & Unrecovered Cost Rule):
                // A customer return does NOT prove that the external third-party seller refunded the showroom.
                // The showroom recovered nothing from the vendor and external items do not enter showroom inventory.
                // Therefore:
                // 1. COGS is NOT reversed (the purchase cost remains an unrecovered, incurred showroom expenditure).
                // 2. The entire refunded amount ($rItem->subtotal) is deducted from profit, resulting in a net commercial loss equal to the unrecovered purchase cost.
                $profitReversal = $profitReversal->add($rItem->subtotal);

                $catName = 'أصناف متنوعة / منتجات خارجية';
                if (! isset($categoryBreakdown[$catName])) {
                    $categoryBreakdown[$catName] = [
                        'category_name' => $catName,
                        'quantity_sold' => 0,
                        'revenue' => Money::zero(),
                        'cogs' => Money::zero(),
                        'profit' => Money::zero(),
                    ];
                }
                $categoryBreakdown[$catName]['quantity_sold'] -= $rItem->quantity->toInt();
                $categoryBreakdown[$catName]['revenue'] = $categoryBreakdown[$catName]['revenue']->subtract($rItem->subtotal);
                $categoryBreakdown[$catName]['profit'] = $categoryBreakdown[$catName]['profit']->subtract($rItem->subtotal);
            } else {
                // Normal showroom product: Stock was physically restored to showroom inventory.
                // Cost is reversed from COGS (restored as warehouse inventory asset), and only the sale markup profit is reversed.
                $costReversal = $rItem->unit_cost->multiply($rItem->quantity->toInt());
                $returnedCogsReversal = $returnedCogsReversal->add($costReversal);
                $profitReversal = $profitReversal->add($rItem->profit_reversal);

                $catName = $rItem->product?->category?->name ?? 'أصناف متنوعة / منتجات خارجية';
                if (! isset($categoryBreakdown[$catName])) {
                    $categoryBreakdown[$catName] = [
                        'category_name' => $catName,
                        'quantity_sold' => 0,
                        'revenue' => Money::zero(),
                        'cogs' => Money::zero(),
                        'profit' => Money::zero(),
                    ];
                }
                $categoryBreakdown[$catName]['quantity_sold'] -= $rItem->quantity->toInt();
                $categoryBreakdown[$catName]['revenue'] = $categoryBreakdown[$catName]['revenue']->subtract($rItem->subtotal);
                $categoryBreakdown[$catName]['cogs'] = $categoryBreakdown[$catName]['cogs']->subtract($costReversal);
                $categoryBreakdown[$catName]['profit'] = $categoryBreakdown[$catName]['profit']->subtract($rItem->profit_reversal);
            }
        }

        // Net Realized Calculations
        $netRealizedRevenue = $grossRevenue->subtract($returnedRevenue);
        $netRealizedCogs = $grossCogs->subtract($returnedCogsReversal);
        $netRealizedProfit = $grossProfit->subtract($profitReversal);

        $marginPercentage = '0.00';
        if ($netRealizedRevenue->isGreaterThan(Money::zero())) {
            $marginPercentage = bcmul(
                bcdiv($netRealizedProfit->toDecimal(), $netRealizedRevenue->toDecimal(), 4),
                '100',
                2
            );
        }

        // Format category breakdown
        $formattedCategories = [];
        foreach ($categoryBreakdown as $cat) {
            $formattedCategories[] = [
                'category_name' => $cat['category_name'],
                'quantity_sold' => $cat['quantity_sold'],
                'revenue' => $cat['revenue']->toDecimal(),
                'cogs' => $cat['cogs']->toDecimal(),
                'profit' => $cat['profit']->toDecimal(),
            ];
        }

        return [
            'gross_revenue' => $grossRevenue->toDecimal(),
            'gross_cogs' => $grossCogs->toDecimal(),
            'gross_profit' => $grossProfit->toDecimal(),

            'returned_revenue' => $returnedRevenue->toDecimal(),
            'returned_cogs_reversal' => $returnedCogsReversal->toDecimal(),
            'profit_reversal' => $profitReversal->toDecimal(),

            'net_revenue' => $netRealizedRevenue->toDecimal(),
            'net_cogs' => $netRealizedCogs->toDecimal(),
            'net_profit' => $netRealizedProfit->toDecimal(),
            'profit_margin_percentage' => $marginPercentage,

            'categories_breakdown' => $formattedCategories,
        ];
    }

    /**
     * Compute comprehensive profit and COGS report with operating expense reconciliation.
     */
    public function getProfitReport(
        Carbon $startUtc,
        Carbon $endUtc,
        string $startDate,
        string $endDate,
        string $period,
        ExpenseReportService $expenseService
    ): array {
        $profit = $this->getRealizedProfit($startUtc, $endUtc);
        $expenses = $expenseService->getSummary($startDate, $endDate);

        $netRealizedProfit = Money::fromDecimal($profit['net_profit']);
        $generalExpenses = Money::fromDecimal($expenses['general_expenses']);
        $netOperatingResult = $netRealizedProfit->subtract($generalExpenses);

        return [
            'period' => $period,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'gross_revenue' => $profit['gross_revenue'],
            'returned_revenue' => $profit['returned_revenue'],
            'net_revenue' => $profit['net_revenue'],
            'gross_cogs' => $profit['gross_cogs'],
            'returned_cogs_reversal' => $profit['returned_cogs_reversal'],
            'net_cogs' => $profit['net_cogs'],
            'gross_profit' => $profit['gross_profit'],
            'profit_reversal' => $profit['profit_reversal'],
            'net_realized_gross_profit' => $profit['net_profit'],
            'profit_margin_percentage' => $profit['profit_margin_percentage'],
            'total_expenses' => $expenses['total_expenses'],
            'general_expenses' => $expenses['general_expenses'],
            'external_product_expenses' => $expenses['external_product_expenses'],
            'net_operating_result' => $netOperatingResult->toDecimal(),
            'categories_breakdown' => $profit['categories_breakdown'],
            'policy_c_notice' => 'تكاليف شراء المنتجات الخارجية تُحسب ضمن تكلفة البضاعة المباعة (COGS) المستندة للقطات الفواتير، ولا تُخصم مرة أخرى من الربح الإجمالي لتجنب الازدواج الحسابي. كما تظل مثبتة عند إرجاع العميل للسلعة وفقاً للسياسة C ما لم يتم استرداد فعلي وموثق من التاجر الخارجي.',
            'formula' => [
                'gross_profit' => 'إجمالي الإيرادات - تكلفة البضاعة المباعة التاريخية (المستندة إلى لقطات الفاتورة)',
                'net_realized_gross_profit' => 'إجمالي الربح - مردودات الأرباح على المرتجعات',
                'net_operating_result' => 'صافي الربح الإجمالي المحقق - المصروفات التشغيلية العامة (مع استثناء تكاليف المنتجات الخارجية لتفادي الازدواج)',
            ],
        ];
    }
}
