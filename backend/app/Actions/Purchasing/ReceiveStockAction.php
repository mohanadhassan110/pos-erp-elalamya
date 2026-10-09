<?php

namespace App\Actions\Purchasing;

use App\Domain\Inventory\Enums\InventoryMovementType;
use App\Domain\Suppliers\Enums\SupplierTransactionDirection;
use App\Domain\Suppliers\Enums\SupplierTransactionType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\AuditLog;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\StockReceipt;
use App\Models\StockReceiptItem;
use App\Models\Supplier;
use App\Models\SupplierTransaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class ReceiveStockAction
{
    /**
     * Atomically executes a stock receiving transaction.
     *
     * Invariants enforced:
     * 1. Updates stock quantity with row-level database locking (lockForUpdate).
     * 2. Sets product current purchase cost for future sales (historical invoice items untouched).
     * 3. Creates auditable inventory movements for all products.
     * 4. Updates supplier payable ledger if a supplier is associated.
     * 5. Protects against duplicate submissions via idempotency keys and locks.
     * 6. Ensures safe receipt number generation under concurrency with collision retry.
     */
    public function execute(array $data, ?User $actor = null): StockReceipt
    {
        $idempotencyKey = $data['idempotency_key']
            ?? request()?->header('X-Idempotency-Key')
            ?? request()?->header('Idempotency-Key');

        // Fast-path: Check if an idempotent receipt was already created
        if (! empty($idempotencyKey)) {
            $existing = StockReceipt::where('idempotency_key', $idempotencyKey)
                ->with(['items.product', 'supplier', 'creator'])
                ->first();

            if ($existing) {
                return $existing;
            }
        }

        // Lock on idempotency key if provided, or fallback fingerprint to prevent rapid double-clicks
        $lockKey = ! empty($idempotencyKey)
            ? "stock_receipt:idempotency:{$idempotencyKey}"
            : 'stock_receipt:lock:'.($actor?->id ?? 'guest').':'.md5(json_encode([
                'supplier_id' => $data['supplier_id'] ?? null,
                'received_date' => $data['received_date'] ?? null,
                'items' => $data['items'] ?? [],
            ]));

        $lock = Cache::lock($lockKey, 10);

        return $lock->block(10, function () use ($data, $actor, $idempotencyKey) {
            // Re-check idempotency key after acquiring the lock in case a concurrent request just committed
            if (! empty($idempotencyKey)) {
                $existing = StockReceipt::where('idempotency_key', $idempotencyKey)
                    ->with(['items.product', 'supplier', 'creator'])
                    ->first();

                if ($existing) {
                    return $existing;
                }
            }

            // Execute transaction with retries on receipt number collision
            $maxAttempts = 5;
            for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
                try {
                    return $this->executeTransaction($data, $actor, $idempotencyKey);
                } catch (UniqueConstraintViolationException|QueryException $e) {
                    // Check if the unique constraint violation is on idempotency_key
                    if (! empty($idempotencyKey) && $this->isIdempotencyKeyCollision($e)) {
                        $existing = StockReceipt::where('idempotency_key', $idempotencyKey)
                            ->with(['items.product', 'supplier', 'creator'])
                            ->first();
                        if ($existing) {
                            return $existing;
                        }
                    }

                    // If collision on receipt_number, retry next sequence up to maxAttempts
                    if ($attempt < $maxAttempts && $this->isReceiptNumberCollision($e)) {
                        usleep(10000 * $attempt); // small jitter

                        continue;
                    }

                    throw $e;
                }
            }

            throw new \RuntimeException('تعذر توليد رقم إذن استلام فريد بعد عدة محاولات.');
        });
    }

    protected function executeTransaction(array $data, ?User $actor, ?string $idempotencyKey): StockReceipt
    {
        return DB::transaction(function () use ($data, $actor, $idempotencyKey) {
            // 1. Validate Supplier if present
            $supplier = null;
            if (! empty($data['supplier_id'])) {
                $supplier = Supplier::findOrFail($data['supplier_id']);
                if (! $supplier->is_active) {
                    throw ValidationException::withMessages([
                        'supplier_id' => ['المورد المحدد معطل ولا يمكن استلام بضاعة لحسابه.'],
                    ]);
                }
            }

            // 2. Validate Items Array
            $rawItems = $data['items'] ?? [];
            if (empty($rawItems)) {
                throw ValidationException::withMessages([
                    'items' => ['يجب إضافة منتج واحد على الأقل في إذن استلام البضاعة.'],
                ]);
            }

            // Prevent duplicate product lines in single receipt
            $productIds = array_column($rawItems, 'product_id');
            if (count($productIds) !== count(array_unique($productIds))) {
                throw ValidationException::withMessages([
                    'items' => ['لا يمكن تكرار نفس المنتج في أكثر من سطر بإذن الاستلام الواحد.'],
                ]);
            }

            // 3. Generate Unique Human-Readable Receipt Number
            $datePrefix = Carbon::parse($data['received_date'] ?? now())->format('Ymd');
            $latestNumber = StockReceipt::where('receipt_number', 'LIKE', "SR-{$datePrefix}-%")
                ->lockForUpdate()
                ->orderBy('receipt_number', 'desc')
                ->value('receipt_number');

            $nextSequence = 1;
            if ($latestNumber && preg_match('/SR-\d{8}-(\d{4})$/', $latestNumber, $matches)) {
                $nextSequence = ((int) $matches[1]) + 1;
            }

            $receiptNumber = sprintf('SR-%s-%04d', $datePrefix, $nextSequence);

            // 4. Pre-process items & calculate server-side totals
            $totalCost = Money::zero();
            $processedItems = [];

            foreach ($rawItems as $itemInput) {
                $productId = $itemInput['product_id'];
                $product = Product::where('id', $productId)->lockForUpdate()->firstOrFail();

                if (! $product->is_active) {
                    throw ValidationException::withMessages([
                        'items' => ["المنتج '{$product->name}' معطل ولا يمكن استلام كميات جديدة منه."],
                    ]);
                }

                $quantity = Quantity::from($itemInput['quantity']);
                if ($quantity->isZero() || $quantity->isNegative()) {
                    throw new InvalidArgumentException("كمية المنتج '{$product->name}' يجب أن تكون عدداً صحيحاً أكبر من الصفر.");
                }

                $unitCost = Money::fromDecimal($itemInput['unit_cost']);
                if ($unitCost->isNegative()) {
                    throw new InvalidArgumentException("تكلفة شراء المنتج '{$product->name}' لا يمكن أن تكون سالبة.");
                }

                $lineSubtotal = $unitCost->multiply($quantity->toInt());
                $totalCost = $totalCost->add($lineSubtotal);

                $processedItems[] = [
                    'product' => $product,
                    'quantity' => $quantity,
                    'unit_cost' => $unitCost,
                    'subtotal' => $lineSubtotal,
                ];
            }

            // 5. Create StockReceipt Header
            $receipt = StockReceipt::create([
                'receipt_number' => $receiptNumber,
                'idempotency_key' => $idempotencyKey,
                'supplier_id' => $supplier?->id,
                'received_date' => $data['received_date'] ?? now()->toDateString(),
                'total_cost' => $totalCost,
                'notes' => isset($data['notes']) ? trim($data['notes']) : null,
                'created_by' => $actor?->id,
            ]);

            // 6. Persist Line Items, Mutate Stock, Update Product Cost, & Create Movements
            foreach ($processedItems as $item) {
                /** @var Product $product */
                $product = $item['product'];
                /** @var Quantity $qty */
                $qty = $item['quantity'];
                /** @var Money $cost */
                $cost = $item['unit_cost'];
                /** @var Money $subtotal */
                $subtotal = $item['subtotal'];

                StockReceiptItem::create([
                    'stock_receipt_id' => $receipt->id,
                    'product_id' => $product->id,
                    'quantity' => $qty,
                    'unit_cost' => $cost,
                    'subtotal' => $subtotal,
                ]);

                // Update stock and current purchase cost
                $newStock = $product->stock_quantity->add($qty);
                $product->stock_quantity = $newStock;
                $product->purchase_cost = $cost; // Updates future sales cost
                $product->save();

                // Create movement
                InventoryMovement::create([
                    'product_id' => $product->id,
                    'type' => InventoryMovementType::STOCK_RECEIPT,
                    'quantity' => $qty,
                    'unit_cost' => $cost,
                    'resulting_stock' => $newStock,
                    'reference_type' => StockReceipt::class,
                    'reference_id' => $receipt->id,
                    'reason' => "إذن استلام بضاعة رقم {$receipt->receipt_number}",
                    'created_by' => $actor?->id,
                ]);
            }

            // 7. If Supplier Attached: Create Supplier Payable Ledger Movement
            if ($supplier) {
                SupplierTransaction::create([
                    'supplier_id' => $supplier->id,
                    'type' => SupplierTransactionType::STOCK_RECEIPT,
                    'direction' => SupplierTransactionDirection::CREDIT,
                    'amount' => $totalCost,
                    'reference_type' => StockReceipt::class,
                    'reference_id' => $receipt->id,
                    'description' => "استلام بضاعة إذن رقم {$receipt->receipt_number}",
                    'created_by' => $actor?->id,
                ]);
            }

            // 8. Audit Log
            if ($actor) {
                AuditLog::create([
                    'user_id' => $actor->id,
                    'action' => 'stock_received',
                    'auditable_type' => StockReceipt::class,
                    'auditable_id' => $receipt->id,
                    'new_values' => [
                        'receipt_number' => $receipt->receipt_number,
                        'supplier_id' => $supplier?->id,
                        'total_cost' => $totalCost->toDecimal(),
                        'items_count' => count($processedItems),
                    ],
                ]);
            }

            return $receipt->load(['items.product', 'supplier', 'creator']);
        });
    }

    protected function isReceiptNumberCollision(\Throwable $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, 'receipt_number') || str_contains($message, 'unique');
    }

    protected function isIdempotencyKeyCollision(\Throwable $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, 'idempotency_key');
    }
}
