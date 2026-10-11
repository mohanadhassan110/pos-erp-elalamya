<?php

require_once __DIR__ . '/../backend/vendor/autoload.php';
$app = require_once __DIR__ . '/../backend/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Invoice;
use App\Models\SalesReturn;
use App\Models\Payment;
use App\Models\InvoicePayment;
use App\Models\InventoryMovement;
use App\Models\Customer;
use App\Models\CustomerTransaction;

echo "=== 1. SEARCH FOR 630 INVOICE ===\n";
$invoices630 = Invoice::where('total', 630)
    ->orWhere('remaining_amount', 630)
    ->orWhere('subtotal', 630)
    ->with(['items', 'payments', 'customer'])
    ->get();

foreach ($invoices630 as $inv) {
    echo "ID: {$inv->id} | Num: {$inv->invoice_number} | Customer: " . ($inv->customer ? $inv->customer->name : 'None') . "\n";
    echo "Sale Type: {$inv->sale_type?->value} | Status: {$inv->status?->value}\n";
    echo "Total: {$inv->total} | Paid: {$inv->paid_amount} | Rem: {$inv->remaining_amount} | Notes: {$inv->notes}\n";
    echo "Created: {$inv->created_at}\n";
    echo "Items:\n";
    foreach ($inv->items as $item) {
        echo " - {$item->product_name} (Qty: {$item->quantity}, UnitPrice: {$item->unit_sale_price}, Subtotal: {$item->subtotal})\n";
    }
    echo "Payments:\n";
    foreach ($inv->payments as $p) {
        echo " - Amount: {$p->amount}, MethodID: {$p->payment_method_id}, Notes: {$p->notes}\n";
    }
    echo "-------------------------------------------\n";
}

echo "\n=== 2. SEARCH FOR INVOICES FROM CASE C (INV-20261011-0001, INV-20261011-0003) ===\n";
$caseCInvoices = Invoice::whereIn('invoice_number', ['INV-20261011-0001', 'INV-20261011-0002', 'INV-20261011-0003'])
    ->with(['items', 'payments', 'returns', 'customer'])
    ->get();

foreach ($caseCInvoices as $inv) {
    echo "ID: {$inv->id} | Num: {$inv->invoice_number}\n";
    echo "Total: {$inv->total} | Paid: {$inv->paid_amount} | Rem: {$inv->remaining_amount} | Notes: {$inv->notes}\n";
    echo "Items:\n";
    foreach ($inv->items as $item) {
        echo " - {$item->product_name} | Qty: {$item->quantity} | Price: {$item->unit_sale_price} | Cost: {$item->unit_cost} | Profit: {$item->profit}\n";
    }
    echo "Returns on this invoice:\n";
    foreach ($inv->returns as $ret) {
        echo " - Return Num: {$ret->return_number} | Resolution: {$ret->resolution?->value} | ReturnAmt: {$ret->total_return_amount} | Diff: {$ret->difference_amount} | DiffPaid: {$ret->difference_paid_amount} | ReplInvID: {$ret->replacement_invoice_id}\n";
    }
    $asReplacement = SalesReturn::where('replacement_invoice_id', $inv->id)->get();
    foreach ($asReplacement as $ar) {
        echo " * THIS INVOICE IS REPLACEMENT FOR: {$ar->originalInvoice?->invoice_number} (Return Num: {$ar->return_number}, Diff: {$ar->difference_amount}, DiffPaid: {$ar->difference_paid_amount})\n";
    }
    echo "-------------------------------------------\n";
}

echo "\n=== 3. SEARCH ALL SALES RETURNS ===\n";
$returns = SalesReturn::with(['items', 'replacementInvoice', 'originalInvoice'])->get();
foreach ($returns as $ret) {
    echo "Return: {$ret->return_number} | OrigInv: {$ret->originalInvoice?->invoice_number} | ReplInv: {$ret->replacementInvoice?->invoice_number}\n";
    echo "Resolution: {$ret->resolution?->value} | TotalReturn: {$ret->total_return_amount} | Diff: {$ret->difference_amount} | DiffPaid: {$ret->difference_paid_amount}\n";
    echo "Items:\n";
    foreach ($ret->items as $ri) {
        echo " - ItemID: {$ri->original_invoice_item_id} | Qty: {$ri->quantity} | UnitPrice: {$ri->unit_sale_price} | UnitCost: {$ri->unit_cost} | ProfitRev: {$ri->profit_reversal}\n";
    }
    echo "-------------------------------------------\n";
}
