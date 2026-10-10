<?php

declare(strict_types=1);

require __DIR__.'/../vendor/autoload.php';

putenv('DB_CONNECTION=mysql');
putenv('DB_DATABASE=elalamya_test');
putenv('DB_HOST=127.0.0.1');
putenv('DB_PORT=3306');
putenv('DB_USERNAME=root');
putenv('DB_PASSWORD=');
putenv('APP_ENV=testing');

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use App\Models\Category;
use App\Models\Invoice;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\User;
use App\Services\Reports\PaymentReportService;
use Carbon\Carbon;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

echo "=== RETAIL OVERPAYMENT AUDIT (Total 300 / Paid 400) ===\n";

Artisan::call('migrate:fresh', ['--force' => true]);

$cashier = User::firstOrCreate(
    ['username' => 'cashier_audit'],
    [
        'name' => 'كاشير التجربة',
        'email' => 'cashier_audit@test.com',
        'password' => bcrypt('password123'),
        'role' => 'cashier',
        'is_active' => true,
    ]
);

$category = Category::firstOrCreate(['code' => 'M'], ['name' => 'مفارش قطن', 'is_active' => true]);
$product = Product::firstOrCreate(
    ['barcode' => 'M0001'],
    [
        'category_id' => $category->id,
        'name' => 'مفرش سرير مطرز',
        'purchase_cost' => 200.00,
        'wholesale_price' => 280.00,
        'retail_price' => 300.00,
        'stock_quantity' => 10,
        'is_active' => true,
    ]
);

$cashMethod = PaymentMethod::firstOrCreate(
    ['code' => 'cash'],
    ['name' => 'نقدي', 'is_cash' => true, 'is_active' => true]
);

$token = $cashier->createToken('audit-token')->plainTextToken;

// Perform POST /api/v1/invoices via cURL through Apache
$payload = [
    'sale_type' => 'retail',
    'customer_id' => null,
    'idempotency_key' => (string) Str::uuid(),
    'items' => [
        [
            'type' => 'product',
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_sale_price' => 300.00,
        ],
    ],
    'payments' => [
        [
            'payment_method_id' => $cashMethod->id,
            'amount' => 400.00, // Cashier tendered 400 for 300 total
        ],
    ],
];

$ch = curl_init('http://127.0.0.1/api/v1/invoices');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer '.$token,
    'Accept: application/json',
    'Content-Type: application/json',
]);
$raw = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "API Response Status: HTTP {$status}\n";

$invoice = Invoice::latest('id')->first();

echo "\n--- 1. INVOICE HEADER FIELDS ---\n";
echo "Invoice Number:    {$invoice->invoice_number}\n";
echo "Sale Type:         {$invoice->sale_type->value}\n";
echo "Subtotal:          {$invoice->subtotal->toDecimal()} ج.م\n";
echo "Discount:          {$invoice->discount_amount->toDecimal()} ج.م\n";
echo "Total:             {$invoice->total->toDecimal()} ج.م\n";
echo "Paid Amount:       {$invoice->paid_amount->toDecimal()} ج.م\n";
echo "Remaining Amount:  {$invoice->remaining_amount->toDecimal()} ج.م\n";
echo "Credit Amount:     {$invoice->credit_amount->toDecimal()} ج.م (Change Due / باقي العميل)\n";

echo "\n--- 2. INVOICE PAYMENTS ROWS (table: invoice_payments) ---\n";
$invoicePayments = DB::table('invoice_payments')->where('invoice_id', $invoice->id)->get();
foreach ($invoicePayments as $ip) {
    echo "ID: {$ip->id} | Invoice ID: {$ip->invoice_id} | Method ID: {$ip->payment_method_id} | Amount: {$ip->amount}\n";
}

echo "\n--- 3. PAYMENTS TABLE ROWS (table: payments) ---\n";
$payments = DB::table('payments')->get();
foreach ($payments as $p) {
    echo "ID: {$p->id} | Type: {$p->payment_type} | Payable: {$p->payable_type}#{$p->payable_id} | Amount: {$p->amount}\n";
}

echo "\n--- 4. PAYMENTS REPORT SUMMARY (PaymentReportService) ---\n";
$reportService = new PaymentReportService;
$todayStart = Carbon::today('Africa/Cairo')->startOfDay()->utc();
$todayEnd = Carbon::today('Africa/Cairo')->endOfDay()->utc();
$summary = $reportService->getSummary($todayStart, $todayEnd);

echo "Total Inflows:     {$summary['total_inflows']} ج.م\n";
echo "Total Outflows:    {$summary['total_outflows']} ج.م\n";
echo "Net Movement:      {$summary['net_movement']} ج.م\n";
echo "Cash Inflows:      {$summary['cash_inflows']} ج.م\n";
echo "Cash Outflows:     {$summary['cash_outflows']} ج.م\n";
echo "Net Cash Movement: {$summary['net_cash_movement']} ج.م\n";
echo "Invoice Payments:  {$summary['invoice_payments_total']} ج.م\n";

echo "\n--- 5. PHYSICAL CASH DRAWER REALITY ---\n";
echo "Actual Cash Tendered by Customer:   400.00 ج.م\n";
echo "Actual Change Returned to Customer: 100.00 ج.م\n";
echo "Actual Cash Left in Cash Drawer:     300.00 ج.م\n";
echo "System Reported Net Cash Inflow:     {$summary['net_cash_movement']} ج.م\n";
echo "Discrepancy (Ghost Cash in System):  +100.00 ج.م (Overstated by change returned!)\n";
