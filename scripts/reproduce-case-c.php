<?php

require_once __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Product;
use App\Models\Category;
use App\Models\PaymentMethod;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Payment;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\InventoryMovement;
use App\Services\Reports\SalesReportService;
use App\Services\Reports\ProfitReportService;
use App\Services\Reports\PaymentReportService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

// Set up output capture
$out = [];

$user = User::where('username', 'owner')->first();
Auth::login($user);

echo "Running Case C audit query on existing records...\n";

$origInv = Invoice::where('invoice_number', 'INV-20261011-0001')->with(['items', 'payments', 'returns.items'])->first();
$replInv = Invoice::where('invoice_number', 'INV-20261011-0003')->with(['items', 'payments'])->first();
$ret = SalesReturn::where('return_number', 'RET-20261011-0001')->with(['items', 'invoice', 'replacementInvoice'])->first();

$inv630 = Invoice::where('invoice_number', 'INV-20261011-0002')->with(['items', 'payments'])->first();

$data = [
    'audit_timestamp' => Carbon::now()->toIso8601String(),
    'finding_d_630_invoice' => [
        'id' => $inv630?->id,
        'invoice_number' => $inv630?->invoice_number,
        'sale_type' => $inv630?->sale_type?->value,
        'status' => $inv630?->status?->value,
        'total' => (string) $inv630?->total,
        'paid_amount' => (string) $inv630?->paid_amount,
        'remaining_amount' => (string) $inv630?->remaining_amount,
        'notes' => $inv630?->notes,
        'items' => $inv630?->items->map(fn($i) => [
            'product_name' => $i->product_name,
            'qty' => $i->quantity?->toInt(),
            'price' => (string) $i->unit_sale_price,
            'subtotal' => (string) $i->subtotal,
        ])->toArray(),
        'payments' => $inv630?->payments->toArray(),
    ],
    'case_c_records' => [
        'original_invoice' => [
            'id' => $origInv?->id,
            'invoice_number' => $origInv?->invoice_number,
            'status' => $origInv?->status?->value,
            'sale_type' => $origInv?->sale_type?->value,
            'subtotal' => (string) $origInv?->subtotal,
            'total' => (string) $origInv?->total,
            'paid_amount' => (string) $origInv?->paid_amount,
            'remaining_amount' => (string) $origInv?->remaining_amount,
            'items' => $origInv?->items->map(fn($i) => [
                'id' => $i->id,
                'product_name' => $i->product_name,
                'barcode' => $i->barcode,
                'qty' => $i->quantity?->toInt(),
                'unit_sale_price' => (string) $i->unit_sale_price,
                'unit_cost' => (string) $i->unit_cost,
                'profit' => (string) $i->profit,
            ])->toArray(),
            'payments' => $origInv?->payments->map(fn($p) => [
                'amount' => (string) $p->amount,
                'notes' => $p->notes,
            ])->toArray(),
        ],
        'sales_return' => [
            'id' => $ret?->id,
            'return_number' => $ret?->return_number,
            'resolution' => $ret?->resolution?->value,
            'total_return_amount' => (string) $ret?->total_return_amount,
            'difference_amount' => (string) $ret?->difference_amount,
            'difference_paid_amount' => (string) $ret?->difference_paid_amount,
            'replacement_invoice_id' => $ret?->replacement_invoice_id,
            'items' => $ret?->items->map(fn($ri) => [
                'original_invoice_item_id' => $ri->original_invoice_item_id,
                'qty' => $ri->quantity?->toInt(),
                'unit_sale_price' => (string) $ri->unit_sale_price,
                'unit_cost' => (string) $ri->unit_cost,
                'subtotal' => (string) $ri->subtotal,
                'profit_reversal' => (string) $ri->profit_reversal,
            ])->toArray(),
        ],
        'replacement_invoice' => [
            'id' => $replInv?->id,
            'invoice_number' => $replInv?->invoice_number,
            'status' => $replInv?->status?->value,
            'sale_type' => $replInv?->sale_type?->value,
            'total' => (string) $replInv?->total,
            'paid_amount' => (string) $replInv?->paid_amount,
            'remaining_amount' => (string) $replInv?->remaining_amount,
            'notes' => $replInv?->notes,
            'items' => $replInv?->items->map(fn($i) => [
                'product_name' => $i->product_name,
                'qty' => $i->quantity?->toInt(),
                'unit_sale_price' => (string) $i->unit_sale_price,
                'unit_cost' => (string) $i->unit_cost,
                'profit' => (string) $i->profit,
            ])->toArray(),
            'payments' => $replInv?->payments->map(fn($p) => [
                'amount' => (string) $p->amount,
                'notes' => $p->notes,
            ])->toArray(),
        ],
        'inventory_movements' => InventoryMovement::whereIn('reference_id', array_filter([$origInv?->id, $replInv?->id, $ret?->id]))
            ->with('product')
            ->get()
            ->map(fn($m) => [
                'product' => $m->product?->name,
                'type' => $m->type?->value,
                'quantity' => $m->quantity?->toInt(),
                'resulting_stock' => $m->resulting_stock?->toInt(),
                'reason' => $m->reason,
            ])->toArray(),
    ],
];

// Run reports for 2026-10-11
$startUtc = Carbon::create(2026, 10, 11, 0, 0, 0, 'Africa/Cairo')->utc();
$endUtc = Carbon::create(2026, 10, 11, 23, 59, 59, 'Africa/Cairo')->utc();

$salesService = app(SalesReportService::class);
$salesReport = $salesService->getSummary($startUtc, $endUtc);
$profitReport = $salesService->getRealizedProfit($startUtc, $endUtc);
$paymentReport = app(PaymentReportService::class)->getSummary($startUtc, $endUtc);

$data['reports_output'] = [
    'date_range' => '2026-10-11 Cairo',
    'sales_summary' => $salesReport,
    'profit_summary' => $profitReport,
    'payment_summary' => $paymentReport,
];

$dir = __DIR__ . '/../docs/evidence/phase15d';
if (!is_dir($dir)) mkdir($dir, 0777, true);
file_put_contents($dir . '/case-c-audit.json', json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "Case C Audit saved successfully to docs/evidence/phase15d/case-c-audit.json\n";
