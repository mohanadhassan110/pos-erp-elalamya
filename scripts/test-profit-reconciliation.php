<?php

require_once __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Services\Reports\SalesReportService;
use Carbon\Carbon;

$startUtc = Carbon::create(2026, 10, 11, 0, 0, 0, 'Africa/Cairo')->utc();
$endUtc = Carbon::create(2026, 10, 11, 23, 59, 59, 'Africa/Cairo')->utc();

$salesService = app(SalesReportService::class);
$profitReport = $salesService->getRealizedProfit($startUtc, $endUtc);

echo "Report Profit Output for 2026-10-11:\n";
echo "Gross Revenue: {$profitReport['gross_revenue']}\n";
echo "Gross COGS: {$profitReport['gross_cogs']}\n";
echo "Gross Profit: {$profitReport['gross_profit']}\n";
echo "Returned Revenue: {$profitReport['returned_revenue']}\n";
echo "Profit Reversal: {$profitReport['profit_reversal']}\n";
echo "Net Profit: {$profitReport['net_profit']}\n";
echo "---------------------------------------------------\n";

// Now compute per-invoice sum for the same range:
$invoices = Invoice::where('status', InvoiceStatus::POSTED)
    ->whereBetween('created_at', [$startUtc, $endUtc])
    ->with(['items', 'returns.items'])
    ->get();

$sumGrossSales = '0.00';
$sumCogs = '0.00';
$sumGrossProfit = '0.00';
$sumReturnedValue = '0.00';
$sumProfitReversal = '0.00';
$sumNetProfit = '0.00';

foreach ($invoices as $inv) {
    $invSales = '0.00';
    $invCogs = '0.00';
    $invGrossProfit = '0.00';
    foreach ($inv->items as $item) {
        $invSales = bcadd($invSales, $item->subtotal->toDecimal(), 2);
        $invCogs = bcadd($invCogs, $item->total_cost->toDecimal(), 2);
        $invGrossProfit = bcadd($invGrossProfit, $item->profit->toDecimal(), 2);
    }

    $invReturnedValue = '0.00';
    $invProfitReversal = '0.00';
    foreach ($inv->returns as $ret) {
        // Only include returns created in the filtered period
        if ($ret->created_at >= $startUtc && $ret->created_at <= $endUtc) {
            $invReturnedValue = bcadd($invReturnedValue, $ret->total_return_amount->toDecimal(), 2);
            foreach ($ret->items as $ri) {
                $isExternal = $ri->product_id === null || ($ri->invoiceItem && $ri->invoiceItem->isExternalProduct());
                if ($isExternal) {
                    $invProfitReversal = bcadd($invProfitReversal, $ri->subtotal->toDecimal(), 2);
                } else {
                    $invProfitReversal = bcadd($invProfitReversal, $ri->profit_reversal->toDecimal(), 2);
                }
            }
        }
    }

    $invNetProfit = bcsub($invGrossProfit, $invProfitReversal, 2);

    $sumGrossSales = bcadd($sumGrossSales, $invSales, 2);
    $sumCogs = bcadd($sumCogs, $invCogs, 2);
    $sumGrossProfit = bcadd($sumGrossProfit, $invGrossProfit, 2);
    $sumReturnedValue = bcadd($sumReturnedValue, $invReturnedValue, 2);
    $sumProfitReversal = bcadd($sumProfitReversal, $invProfitReversal, 2);
    $sumNetProfit = bcadd($sumNetProfit, $invNetProfit, 2);

    echo "Invoice {$inv->invoice_number}: Sales={$invSales}, COGS={$invCogs}, GrossProfit={$invGrossProfit}, Returns={$invReturnedValue}, ProfitRev={$invProfitReversal}, NetProfit={$invNetProfit}\n";
}

echo "---------------------------------------------------\n";
echo "Sum Per-Invoice Gross Sales: {$sumGrossSales} vs Report: {$profitReport['gross_revenue']}\n";
echo "Sum Per-Invoice Gross Profit: {$sumGrossProfit} vs Report: {$profitReport['gross_profit']}\n";
echo "Sum Per-Invoice Returns: {$sumReturnedValue} vs Report: {$profitReport['returned_revenue']}\n";
echo "Sum Per-Invoice Profit Reversal: {$sumProfitReversal} vs Report: {$profitReport['profit_reversal']}\n";
echo "Sum Per-Invoice Net Profit: {$sumNetProfit} vs Report: {$profitReport['net_profit']}\n";

$reconciles = ($sumNetProfit === $profitReport['net_profit']);
echo "RECONCILIATION RESULT: " . ($reconciles ? "SUCCESS (EXACT MATCH)" : "FAILED") . "\n";
