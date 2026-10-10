<?php

declare(strict_types=1);

/**
 * ApplicationConcurrencyProof.php
 *
 * Repeatable, committed test proving application-level concurrency on MariaDB:
 * - Runs TWO real PHP processes in parallel via proc_open calling POST /api/v1/invoices.
 * - Repeats >= 20 rounds for the last unit (stock = 1) of a product.
 * - Proves: exactly one succeeds (201), the other is rejected (422 INSUFFICIENT_STOCK),
 *   stock is NEVER negative, invoice numbers are unique across all rounds,
 *   and sending the same idempotency key concurrently produces exactly one invoice.
 */

require __DIR__.'/../vendor/autoload.php';

// Force database connection to mysql on test DB
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
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

echo "=== APPLICATION-LEVEL CONCURRENCY PROOF (MariaDB Engine) ===\n";

// 1. Ensure migrations are fresh on test database
echo "[1] Running migrations on elalamya_test (MariaDB)...\n";
Artisan::call('migrate:fresh', ['--force' => true]);

// 2. Setup reference records
$cashier = User::firstOrCreate(
    ['username' => 'cashier_concurrency'],
    [
        'name' => 'كاشير اختبار التزامن',
        'email' => 'cashier_conc@test.com',
        'password' => bcrypt('password123'),
        'role' => 'cashier',
        'is_active' => true,
    ]
);

$category = Category::firstOrCreate(
    ['code' => 'K'],
    ['name' => 'ألحفة شتوية', 'is_active' => true]
);

$product = Product::firstOrCreate(
    ['barcode' => 'K0001'],
    [
        'category_id' => $category->id,
        'name' => 'لحاف شتوي دبل قطن فاخر',
        'purchase_cost' => 500.00,
        'wholesale_price' => 600.00,
        'retail_price' => 650.00,
        'stock_quantity' => 1,
        'is_active' => true,
    ]
);

$cashMethod = PaymentMethod::firstOrCreate(
    ['code' => 'cash'],
    ['name' => 'نقدي', 'is_cash' => true, 'is_active' => true]
);

echo "[2] Test product created: ID {$product->id}, Barcode {$product->barcode}, Initial Stock: 1\n";

$rounds = 20;
$successfulInvoices = [];
$totalSuccessCount = 0;
$totalRejectedCount = 0;
$negativeStockViolations = 0;
$duplicateInvoices = 0;

echo "[3] Executing {$rounds} concurrent rounds with 2 parallel PHP processes each...\n\n";
echo sprintf("%-6s | %-12s | %-12s | %-15s | %-12s | %-10s\n", 'Round', 'Process 1', 'Process 2', 'Winner Invoice', 'Final Stock', 'Status');
echo str_repeat('-', 80)."\n";

$phpBinary = PHP_BINARY;
$workerScript = __DIR__.'/ConcurrencyWorker.php';

for ($round = 1; $round <= $rounds; $round++) {
    // Reset stock to exactly 1
    DB::table('products')->where('id', $product->id)->update(['stock_quantity' => 1]);

    $key1 = (string) Str::uuid();
    $key2 = (string) Str::uuid();

    $cmd1 = "\"{$phpBinary}\" \"{$workerScript}\" --productId={$product->id} --idempotencyKey={$key1} --cashierId={$cashier->id} --cashMethodId={$cashMethod->id}";
    $cmd2 = "\"{$phpBinary}\" \"{$workerScript}\" --productId={$product->id} --idempotencyKey={$key2} --cashierId={$cashier->id} --cashMethodId={$cashMethod->id}";

    $descriptors = [
        0 => ['pipe', 'r'],
        1 => ['pipe', 'w'],
        2 => ['pipe', 'w'],
    ];

    // Spawn both processes concurrently
    $proc1 = proc_open($cmd1, $descriptors, $pipes1);
    $proc2 = proc_open($cmd2, $descriptors, $pipes2);

    $out1 = stream_get_contents($pipes1[1]);
    $err1 = stream_get_contents($pipes1[2]);
    fclose($pipes1[0]);
    fclose($pipes1[1]);
    fclose($pipes1[2]);
    $exit1 = proc_close($proc1);

    $out2 = stream_get_contents($pipes2[1]);
    $err2 = stream_get_contents($pipes2[2]);
    fclose($pipes2[0]);
    fclose($pipes2[1]);
    fclose($pipes2[2]);
    $exit2 = proc_close($proc2);

    $res1 = json_decode($out1, true) ?? ['status' => 500, 'error' => $err1];
    $res2 = json_decode($out2, true) ?? ['status' => 500, 'error' => $err2];

    $finalStock = (int) DB::table('products')->where('id', $product->id)->value('stock_quantity');

    if ($finalStock < 0) {
        $negativeStockViolations++;
    }

    $roundSuccess = 0;
    $roundRejected = 0;
    $winnerInvoice = null;

    if ($res1['status'] === 201) {
        $roundSuccess++;
        $winnerInvoice = $res1['invoice_number'];
    } elseif ($res1['status'] === 422) {
        $roundRejected++;
    }

    if ($res2['status'] === 201) {
        $roundSuccess++;
        $winnerInvoice = $res2['invoice_number'];
    } elseif ($res2['status'] === 422) {
        $roundRejected++;
    }

    $totalSuccessCount += $roundSuccess;
    $totalRejectedCount += $roundRejected;

    if ($winnerInvoice) {
        if (in_array($winnerInvoice, $successfulInvoices, true)) {
            $duplicateInvoices++;
        }
        $successfulInvoices[] = $winnerInvoice;
    }

    $statusStr = ($roundSuccess === 1 && $roundRejected === 1 && $finalStock === 0) ? 'PASS' : 'FAIL';

    echo sprintf(
        "%-6d | %-12s | %-12s | %-15s | %-12d | %-10s\n",
        $round,
        'HTTP '.($res1['status'] ?? 'ERR'),
        'HTTP '.($res2['status'] ?? 'ERR'),
        $winnerInvoice ?? 'None',
        $finalStock,
        $statusStr
    );
}

echo str_repeat('-', 80)."\n";
echo "Rounds Completed: {$rounds}\n";
echo "Total Successful (201 Created): {$totalSuccessCount} (Expected: {$rounds})\n";
echo "Total Rejected (422 Insufficient Stock): {$totalRejectedCount} (Expected: {$rounds})\n";
echo "Negative Stock Violations: {$negativeStockViolations} (Expected: 0)\n";
echo "Duplicate Invoice Numbers: {$duplicateInvoices} (Expected: 0)\n";
echo 'Unique Invoices Created: '.count(array_unique($successfulInvoices))."\n\n";

// 4. Test Idempotency under concurrency
echo "[4] Testing Concurrent Idempotency Key Reuse...\n";
DB::table('products')->where('id', $product->id)->update(['stock_quantity' => 1]);
$sharedKey = (string) Str::uuid();

$cmdIdem1 = "\"{$phpBinary}\" \"{$workerScript}\" --productId={$product->id} --idempotencyKey={$sharedKey} --cashierId={$cashier->id} --cashMethodId={$cashMethod->id}";
$cmdIdem2 = "\"{$phpBinary}\" \"{$workerScript}\" --productId={$product->id} --idempotencyKey={$sharedKey} --cashierId={$cashier->id} --cashMethodId={$cashMethod->id}";

$procIdem1 = proc_open($cmdIdem1, $descriptors, $pipesIdem1);
$procIdem2 = proc_open($cmdIdem2, $descriptors, $pipesIdem2);

$outIdem1 = stream_get_contents($pipesIdem1[1]);
fclose($pipesIdem1[0]);
fclose($pipesIdem1[1]);
fclose($pipesIdem1[2]);
proc_close($procIdem1);

$outIdem2 = stream_get_contents($pipesIdem2[1]);
fclose($pipesIdem2[0]);
fclose($pipesIdem2[1]);
fclose($pipesIdem2[2]);
proc_close($procIdem2);

$resIdem1 = json_decode($outIdem1, true);
$resIdem2 = json_decode($outIdem2, true);

$finalStockIdem = (int) DB::table('products')->where('id', $product->id)->value('stock_quantity');
$invoiceCountForProduct = DB::table('invoice_items')->where('product_id', $product->id)->count();

echo "Process A: HTTP {$resIdem1['status']} -> Invoice {$resIdem1['invoice_number']}\n";
echo "Process B: HTTP {$resIdem2['status']} -> Invoice {$resIdem2['invoice_number']}\n";
echo "Final Stock after Idempotency Round: {$finalStockIdem} (Expected: 0, not negative)\n";

$idempotencyPassed = ($resIdem1['status'] === 201 || $resIdem2['status'] === 201) &&
    ($resIdem1['invoice_number'] === $resIdem2['invoice_number']) &&
    ($finalStockIdem === 0);

if ($idempotencyPassed) {
    echo "IDEMPOTENCY CONCURRENCY CHECK: PASSED (Exact same invoice returned, zero double stock deductions)\n";
} else {
    echo "IDEMPOTENCY CONCURRENCY CHECK: FAILED\n";
}

$allPassed = ($totalSuccessCount === $rounds) &&
    ($totalRejectedCount === $rounds) &&
    ($negativeStockViolations === 0) &&
    ($duplicateInvoices === 0) &&
    $idempotencyPassed;

echo "\nOVERALL CONCURRENCY PROOF RESULT: ".($allPassed ? 'PASSED (100% RELIABILITY)' : 'FAILED')."\n";
exit($allPassed ? 0 : 1);
