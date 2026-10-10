<?php

declare(strict_types=1);
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;

/**
 * ConcurrencyWorker.php
 *
 * Runs an isolated client process executing a REAL HTTP request
 * (via cURL) against the HTTP server (e.g. php artisan serve or Apache)
 * for POST /api/v1/invoices backed by MariaDB.
 */

require __DIR__.'/../vendor/autoload.php';

// Parse CLI arguments
$options = getopt('', [
    'productId:',
    'idempotencyKey:',
    'cashierId:',
    'cashMethodId:',
    'token:',
    'endpoint:',
]);

$productId = (int) ($options['productId'] ?? 1);
$idempotencyKey = $options['idempotencyKey'] ?? bin2hex(random_bytes(16));
$cashierId = (int) ($options['cashierId'] ?? 1);
$cashMethodId = (int) ($options['cashMethodId'] ?? 1);
$token = isset($options['token']) ? base64_decode((string) $options['token']) : null;
$endpoint = $options['endpoint'] ?? 'http://127.0.0.1/api/v1/invoices';

// If token not passed, boot Laravel to fetch/generate token
if (! $token) {
    putenv('DB_CONNECTION=mysql');
    putenv('DB_DATABASE=elalamya_test');
    putenv('DB_HOST=127.0.0.1');
    putenv('DB_PORT=3306');
    putenv('DB_USERNAME=root');
    putenv('DB_PASSWORD=');
    putenv('APP_ENV=testing');

    $app = require __DIR__.'/../bootstrap/app.php';
    $app->make(Kernel::class)->bootstrap();

    $cashier = User::find($cashierId);
    if (! $cashier) {
        echo json_encode(['error' => 'Cashier not found', 'status' => 500]);
        exit(1);
    }
    $token = $cashier->createToken('concurrency-test')->plainTextToken;
}

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

$content = json_encode($payload, JSON_THROW_ON_ERROR);

$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $content);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer '.$token,
    'Accept: application/json',
    'Content-Type: application/json',
]);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);

$startMs = round(microtime(true) * 1000, 2);
$rawResponse = curl_exec($ch);
$endMs = round(microtime(true) * 1000, 2);
$curlErr = curl_error($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$elapsedMs = round($endMs - $startMs, 2);

if ($rawResponse === false || empty($rawResponse)) {
    echo json_encode([
        'status' => $status ?: 500,
        'start_ms' => $startMs,
        'end_ms' => $endMs,
        'elapsed_ms' => $elapsedMs,
        'error' => 'cURL error: '.$curlErr,
    ]);
    exit(1);
}

$body = json_decode($rawResponse, true);

echo json_encode([
    'status' => $status,
    'start_ms' => $startMs,
    'end_ms' => $endMs,
    'elapsed_ms' => $elapsedMs,
    'invoice_number' => $body['data']['invoice_number'] ?? null,
    'error_code' => $body['code'] ?? null,
    'message' => $body['message'] ?? null,
]);

exit($status === 201 ? 0 : ($status === 422 ? 2 : 1));
