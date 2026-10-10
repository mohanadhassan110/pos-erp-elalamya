<?php

declare(strict_types=1);

/**
 * ConcurrencyWorker.php
 *
 * Runs an isolated PHP process executing the actual Laravel HTTP request
 * for POST /api/v1/invoices against MariaDB (production engine).
 */

require __DIR__ . '/../vendor/autoload.php';

// Force database connection to mysql on test DB
putenv('DB_CONNECTION=mysql');
putenv('DB_DATABASE=elalamya_test');
putenv('DB_HOST=127.0.0.1');
putenv('DB_PORT=3306');
putenv('DB_USERNAME=root');
putenv('DB_PASSWORD=');
putenv('APP_ENV=testing');

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Http\Request;

// Parse CLI arguments
$options = getopt('', ['productId:', 'idempotencyKey:', 'cashierId:', 'cashMethodId:']);

$productId = (int) ($options['productId'] ?? 1);
$idempotencyKey = $options['idempotencyKey'] ?? (string) Str::uuid();
$cashierId = (int) ($options['cashierId'] ?? 1);
$cashMethodId = (int) ($options['cashMethodId'] ?? 1);

// Boot Laravel kernel
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

// Find cashier
$cashier = User::find($cashierId);
if (! $cashier) {
    echo json_encode(['error' => 'Cashier not found', 'status' => 500]);
    exit(1);
}

// Generate auth token for cashier
$token = $cashier->createToken('concurrency-test')->plainTextToken;

$payload = [
    'sale_type' => 'retail',
    'customer_id' => null,
    'idempotency_key' => $idempotencyKey,
    'items' => [
        [
            'type' => 'product',
            'product_id' => $productId,
            'quantity' => 1,
            'unit_sale_price' => 650.00,
        ],
    ],
    'payments' => [
        [
            'payment_method_id' => $cashMethodId,
            'amount' => 650.00,
        ],
    ],
];

$content = json_encode($payload);

$request = Request::create(
    '/api/v1/invoices',
    'POST',
    [],
    [],
    [],
    [
        'HTTP_AUTHORIZATION' => 'Bearer ' . $token,
        'HTTP_ACCEPT' => 'application/json',
        'CONTENT_TYPE' => 'application/json',
    ],
    $content
);

$start = microtime(true);
$response = $kernel->handle($request);
$elapsedMs = round((microtime(true) - $start) * 1000, 2);

$status = $response->getStatusCode();
$body = json_decode($response->getContent(), true);

echo json_encode([
    'status' => $status,
    'elapsed_ms' => $elapsedMs,
    'invoice_number' => $body['data']['invoice_number'] ?? null,
    'error_code' => $body['code'] ?? null,
    'message' => $body['message'] ?? null,
]);

exit($status === 201 ? 0 : ($status === 422 ? 2 : 1));
