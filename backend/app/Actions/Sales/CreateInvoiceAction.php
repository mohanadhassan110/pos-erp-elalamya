<?php

namespace App\Actions\Sales;

use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Inventory\Enums\InventoryMovementType;
use App\Domain\Payments\Enums\PaymentType;
use App\Domain\Sales\Enums\InvoiceItemType;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Sales\Enums\SaleType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\CustomerTransaction;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\InventoryMovement;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class CreateInvoiceAction
{
    /**
     * Atomically executes a complete POS checkout transaction.
     *
     * Invariants enforced:
     * 1. Validates sale type (retail vs wholesale). Wholesale strictly requires an active customer.
     * 2. Row-level locks all normal products (lockForUpdate) and validates stock availability.
     * 3. Prevents negative stock; rejects checkout atomically on insufficient stock.
     * 4. Freezes/snapshots current purchase cost onto invoice items (never recosted retroactively).
     * 5. Supports line sale price manual override without mutating master product pricing.
     * 6. Deducts inventory and logs InventoryMovement (type: sale) for each normal product.
     * 7. Handles external products: does not touch inventory, records linked purchase expense.
     * 8. Integrates customer ledger for wholesale (invoice total debited, payments credited).
     * 9. Records payments (exact, underpayment receivable, overpayment customer credit).
     * 10. Concurrency-safe invoice numbering with collision retry.
     * 11. Idempotency protection against rapid double-clicks.
     * 12. Full atomic rollback on any failure.
     */
    public function execute(array $data, ?User $actor = null): Invoice
    {
        $idempotencyKey = $data['idempotency_key']
            ?? request()?->header('X-Idempotency-Key')
            ?? request()?->header('Idempotency-Key');

        // Fast-path: Return existing invoice if idempotent request was already committed
        if (! empty($idempotencyKey)) {
            $existing = Invoice::where('idempotency_key', $idempotencyKey)
                ->with(['items.product.category', 'payments.paymentMethod', 'customer', 'creator'])
                ->first();

            if ($existing) {
                return $existing;
            }
        }

        // Lock on idempotency key if provided, or fingerprint lock to prevent double-submit
        $lockKey = ! empty($idempotencyKey)
            ? "invoice:idempotency:{$idempotencyKey}"
            : 'invoice:lock:'.($actor?->id ?? 'guest').':'.md5(json_encode([
                'sale_type' => $data['sale_type'] ?? null,
                'customer_id' => $data['customer_id'] ?? null,
                'items' => $data['items'] ?? [],
                'payments' => $data['payments'] ?? [],
            ]));

        $lock = Cache::lock($lockKey, 10);

        return $lock->block(10, function () use ($data, $actor, $idempotencyKey) {
            // Re-check idempotency key after lock acquisition
            if (! empty($idempotencyKey)) {
                $existing = Invoice::where('idempotency_key', $idempotencyKey)
                    ->with(['items.product.category', 'payments.paymentMethod', 'customer', 'creator'])
                    ->first();

                if ($existing) {
                    return $existing;
                }
            }

            // Retry loop on invoice number unique collision
            $maxAttempts = 5;
            for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
                try {
                    return $this->executeTransaction($data, $actor, $idempotencyKey);
                } catch (UniqueConstraintViolationException|QueryException $e) {
                    // Check if collision was on idempotency_key
                    if (! empty($idempotencyKey) && $this->isIdempotencyKeyCollision($e)) {
                        $existing = Invoice::where('idempotency_key', $idempotencyKey)
                            ->with(['items.product.category', 'payments.paymentMethod', 'customer', 'creator'])
                            ->first();

                        if ($existing) {
                            return $existing;
                        }
                    }

                    // If collision was on invoice_number, retry with small jitter
                    if ($attempt < $maxAttempts && $this->isInvoiceNumberCollision($e)) {
                        usleep(10000 * $attempt);

                        continue;
                    }

                    throw $e;
                }
            }

            throw new \RuntimeException('تعذر توليد رقم فاتورة فريد بعد عدة محاولات.');
        });
    }

    protected function executeTransaction(array $data, ?User $actor, ?string $idempotencyKey): Invoice
    {
        return DB::transaction(function () use ($data, $actor, $idempotencyKey) {
            // 1. Resolve Sale Type & Customer
            $saleType = SaleType::from($data['sale_type']);

            $customer = null;
            if ($saleType === SaleType::WHOLESALE) {
                if (empty($data['customer_id'])) {
                    throw ValidationException::withMessages([
                        'customer_id' => ['يجب تحديد عميل مسجل لفواتير الجملة.'],
                    ]);
                }
                $customer = Customer::findOrFail($data['customer_id']);
                if (! $customer->is_active) {
                    throw ValidationException::withMessages([
                        'customer_id' => ['العميل المحدد معطل ولا يمكن تسجيل فواتير باسمه.'],
                    ]);
                }
            } elseif (! empty($data['customer_id'])) {
                $customer = Customer::findOrFail($data['customer_id']);
                if (! $customer->is_active) {
                    throw ValidationException::withMessages([
                        'customer_id' => ['العميل المحدد معطل ولا يمكن تسجيل فواتير باسمه.'],
                    ]);
                }
            }

            // 2. Validate Items
            $rawItems = $data['items'] ?? [];
            if (empty($rawItems)) {
                throw ValidationException::withMessages([
                    'items' => ['يجب إضافة صنف واحد على الأقل في الفاتورة.'],
                ]);
            }

            // Collect normal product IDs to lock for update
            $normalProductItems = [];
            $externalItems = [];
            $productIds = [];

            foreach ($rawItems as $rawItem) {
                $itemType = InvoiceItemType::from($rawItem['type']);
                if ($itemType === InvoiceItemType::PRODUCT) {
                    $pid = (int) $rawItem['product_id'];
                    $productIds[] = $pid;
                    $normalProductItems[] = $rawItem;
                } else {
                    $externalItems[] = $rawItem;
                }
            }

            // Check duplicate product lines
            if (count($productIds) !== count(array_unique($productIds))) {
                throw ValidationException::withMessages([
                    'items' => ['لا يمكن تكرار نفس المنتج في أكثر من سطر بالفاتورة. يرجى تعديل الكمية.'],
                ]);
            }

            // Lock all normal products in database to prevent concurrent overselling
            $lockedProducts = [];
            if (! empty($productIds)) {
                $lockedProducts = Product::whereIn('id', $productIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');
            }

            // 3. Process Items & Snapshot Pricing
            $processedItems = [];
            $invoiceSubtotal = Money::zero();

            foreach ($rawItems as $itemInput) {
                $itemType = InvoiceItemType::from($itemInput['type']);
                $quantity = Quantity::from($itemInput['quantity']);

                if ($quantity->isZero() || $quantity->isNegative()) {
                    throw new InvalidArgumentException('الكمية يجب أن تكون عدداً صحيحاً أكبر من الصفر.');
                }

                if ($itemType === InvoiceItemType::PRODUCT) {
                    $productId = (int) $itemInput['product_id'];
                    /** @var Product|null $product */
                    $product = $lockedProducts->get($productId);

                    if (! $product) {
                        throw ValidationException::withMessages([
                            'items' => ['المنتج المحدد غير موجود بالنظام.'],
                        ]);
                    }

                    if (! $product->is_active) {
                        throw ValidationException::withMessages([
                            'items' => ["المنتج '{$product->name}' معطل ولا يمكن بيعه."],
                        ]);
                    }

                    // Stock validation: requested_quantity <= available_stock
                    if ($product->stock_quantity->isLessThan($quantity)) {
                        $error = ValidationException::withMessages([
                            'items' => ["لا توجد كمية كافية من المنتج '{$product->name}'. المتاح حالياً: {$product->stock_quantity->toInt()}."],
                        ]);
                        // Custom code for frontend/API
                        throw $error;
                    }

                    // Snapshot purchase cost at the exact time of sale
                    $unitCost = $product->purchase_cost;

                    // Sale price: user override or default based on sale type
                    if (isset($itemInput['unit_sale_price']) && is_numeric($itemInput['unit_sale_price'])) {
                        $unitSalePrice = Money::fromDecimal($itemInput['unit_sale_price']);
                    } else {
                        $unitSalePrice = $saleType === SaleType::WHOLESALE
                            ? $product->wholesale_price
                            : $product->retail_price;
                    }

                    if ($unitSalePrice->isNegative()) {
                        throw new InvalidArgumentException("سعر بيع المنتج '{$product->name}' لا يمكن أن يكون سالباً.");
                    }

                    $calculations = InvoiceItem::computeLineCalculations($unitSalePrice, $unitCost, $quantity);
                    $subtotal = $calculations['subtotal'];
                    $totalCost = $calculations['total_cost'];
                    $profit = $calculations['profit'];

                    $invoiceSubtotal = $invoiceSubtotal->add($subtotal);

                    $processedItems[] = [
                        'type' => InvoiceItemType::PRODUCT,
                        'product' => $product,
                        'product_name' => $product->name,
                        'barcode' => $product->barcode,
                        'quantity' => $quantity,
                        'unit_sale_price' => $unitSalePrice,
                        'unit_cost' => $unitCost,
                        'subtotal' => $subtotal,
                        'total_cost' => $totalCost,
                        'profit' => $profit,
                    ];
                } else {
                    // External Product
                    $productName = trim($itemInput['product_name'] ?? '');
                    if (empty($productName)) {
                        throw ValidationException::withMessages([
                            'items' => ['اسم الصنف الخارجي مطلوب.'],
                        ]);
                    }

                    $unitCost = Money::fromDecimal($itemInput['purchase_cost']);
                    $unitSalePrice = Money::fromDecimal($itemInput['unit_sale_price']);

                    if ($unitCost->isNegative()) {
                        throw new InvalidArgumentException("تكلفة شراء الصنف الخارجي '{$productName}' لا يمكن أن تكون سالبة.");
                    }

                    if ($unitSalePrice->isNegative()) {
                        throw new InvalidArgumentException("سعر بيع الصنف الخارجي '{$productName}' لا يمكن أن يكون سالباً.");
                    }

                    $calculations = InvoiceItem::computeLineCalculations($unitSalePrice, $unitCost, $quantity);
                    $subtotal = $calculations['subtotal'];
                    $totalCost = $calculations['total_cost'];
                    $profit = $calculations['profit'];

                    $invoiceSubtotal = $invoiceSubtotal->add($subtotal);

                    $processedItems[] = [
                        'type' => InvoiceItemType::EXTERNAL,
                        'product' => null,
                        'product_name' => $productName,
                        'barcode' => null,
                        'quantity' => $quantity,
                        'unit_sale_price' => $unitSalePrice,
                        'unit_cost' => $unitCost,
                        'subtotal' => $subtotal,
                        'total_cost' => $totalCost,
                        'profit' => $profit,
                    ];
                }
            }

            // 4. Calculate Final Invoice Totals
            $discountAmount = Money::zero();
            $invoiceTotal = $invoiceSubtotal->subtract($discountAmount);

            // 5. Validate & Process Payments
            $rawPayments = $data['payments'] ?? [];
            $totalPaid = Money::zero();
            $validatedPayments = [];

            foreach ($rawPayments as $pIndex => $pInput) {
                $pmId = (int) $pInput['payment_method_id'];
                $pm = PaymentMethod::find($pmId);

                if (! $pm || ! $pm->is_active) {
                    throw ValidationException::withMessages([
                        "payments.{$pIndex}.payment_method_id" => ['طريقة الدفع المحددة غير صالحة أو معطلة.'],
                    ]);
                }

                $amount = Money::fromDecimal($pInput['amount']);
                if ($amount->isNegative() || $amount->isZero()) {
                    throw new InvalidArgumentException('مبلغ الدفعة يجب أن يكون أكبر من الصفر.');
                }

                $totalPaid = $totalPaid->add($amount);
                $validatedPayments[] = [
                    'payment_method' => $pm,
                    'amount' => $amount,
                    'notes' => isset($pInput['notes']) ? trim($pInput['notes']) : null,
                ];
            }

            // Calculate Paid, Remaining (Debt), and Credit (Overpayment)
            if ($totalPaid->isGreaterThanOrEqualTo($invoiceTotal)) {
                $paidAmount = $totalPaid;
                $remainingAmount = Money::zero();
                $creditAmount = $totalPaid->subtract($invoiceTotal);
            } else {
                $paidAmount = $totalPaid;
                $remainingAmount = $invoiceTotal->subtract($totalPaid);
                $creditAmount = Money::zero();
            }

            // 6. Generate Unique Concurrency-Safe Invoice Number
            $datePrefix = Carbon::now()->format('Ymd');
            $latestInvoice = Invoice::where('invoice_number', 'LIKE', "INV-{$datePrefix}-%")
                ->lockForUpdate()
                ->orderBy('invoice_number', 'desc')
                ->value('invoice_number');

            $nextSequence = 1;
            if ($latestInvoice && preg_match('/INV-\d{8}-(\d{4})$/', $latestInvoice, $matches)) {
                $nextSequence = ((int) $matches[1]) + 1;
            }

            $invoiceNumber = sprintf('INV-%s-%04d', $datePrefix, $nextSequence);

            // 7. Create Invoice Header
            $invoice = Invoice::create([
                'invoice_number' => $invoiceNumber,
                'idempotency_key' => $idempotencyKey,
                'customer_id' => $customer?->id,
                'sale_type' => $saleType,
                'status' => InvoiceStatus::POSTED,
                'subtotal' => $invoiceSubtotal,
                'discount_amount' => $discountAmount,
                'total' => $invoiceTotal,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
                'credit_amount' => $creditAmount,
                'notes' => isset($data['notes']) ? trim($data['notes']) : null,
                'created_by' => $actor?->id,
            ]);

            // 8. Persist Line Items, Deduct Stock, Create Inventory Movements & External Expenses
            $firstPaymentMethodId = ! empty($validatedPayments) ? $validatedPayments[0]['payment_method']->id : null;

            foreach ($processedItems as $item) {
                $invoiceItem = InvoiceItem::create([
                    'invoice_id' => $invoice->id,
                    'product_id' => $item['product']?->id,
                    'item_type' => $item['type'],
                    'product_name' => $item['product_name'],
                    'barcode' => $item['barcode'],
                    'quantity' => $item['quantity'],
                    'unit_sale_price' => $item['unit_sale_price'],
                    'unit_cost' => $item['unit_cost'],
                    'subtotal' => $item['subtotal'],
                    'total_cost' => $item['total_cost'],
                    'profit' => $item['profit'],
                ]);

                if ($item['type'] === InvoiceItemType::PRODUCT) {
                    /** @var Product $product */
                    $product = $item['product'];
                    $qty = $item['quantity'];

                    // Deduct stock
                    $newStock = $product->stock_quantity->subtract($qty);
                    $product->stock_quantity = $newStock;
                    $product->save();

                    // Create sale inventory movement
                    InventoryMovement::create([
                        'product_id' => $product->id,
                        'type' => InventoryMovementType::SALE,
                        'quantity' => $qty,
                        'unit_cost' => $item['unit_cost'],
                        'resulting_stock' => $newStock,
                        'reference_type' => Invoice::class,
                        'reference_id' => $invoice->id,
                        'reason' => "مبيعات فاتورة رقم {$invoice->invoice_number}",
                        'created_by' => $actor?->id,
                    ]);
                } else {
                    // External Product: Create linked purchase expense
                    $expenseCategory = ExpenseCategory::firstOrCreate(
                        ['code' => 'external_product'],
                        ['name' => 'تكلفة بضاعة خارجية', 'is_active' => true]
                    );

                    Expense::create([
                        'expense_category_id' => $expenseCategory->id,
                        'payment_method_id' => $firstPaymentMethodId,
                        'amount' => $item['total_cost'],
                        'expense_date' => now()->toDateString(),
                        'description' => "تكلفة شراء صنف خارجي '{$item['product_name']}' - فاتورة مبيعات رقم {$invoice->invoice_number}",
                        'reference_type' => InvoiceItem::class,
                        'reference_id' => $invoiceItem->id,
                        'created_by' => $actor?->id,
                    ]);
                }
            }

            // 9. Customer Ledger Integration for Wholesale Sales
            if ($saleType === SaleType::WHOLESALE && $customer) {
                // Wholesale invoice debits customer account (increases debt)
                CustomerTransaction::create([
                    'customer_id' => $customer->id,
                    'type' => CustomerTransactionType::INVOICE,
                    'direction' => CustomerTransactionDirection::DEBIT,
                    'amount' => $invoiceTotal,
                    'reference_type' => Invoice::class,
                    'reference_id' => $invoice->id,
                    'description' => "فاتورة مبيعات جملة رقم {$invoice->invoice_number}",
                    'created_by' => $actor?->id,
                ]);
            }

            // 10. Record Payments & Customer Ledger Credits
            $paymentDatePrefix = Carbon::now()->format('Ymd');
            $latestPayment = Payment::where('payment_number', 'LIKE', "PAY-{$paymentDatePrefix}-%")
                ->lockForUpdate()
                ->orderBy('payment_number', 'desc')
                ->value('payment_number');

            $nextPaymentSeq = 1;
            if ($latestPayment && preg_match('/PAY-\d{8}-(\d{4})$/', $latestPayment, $m)) {
                $nextPaymentSeq = ((int) $m[1]) + 1;
            }

            foreach ($validatedPayments as $vIndex => $vPayment) {
                $pm = $vPayment['payment_method'];
                $amount = $vPayment['amount'];
                $notes = $vPayment['notes'];

                $paymentNumber = sprintf('PAY-%s-%04d', $paymentDatePrefix, $nextPaymentSeq + $vIndex);

                $payment = Payment::create([
                    'payment_number' => $paymentNumber,
                    'payment_method_id' => $pm->id,
                    'amount' => $amount,
                    'payment_type' => PaymentType::INVOICE_PAYMENT,
                    'payable_type' => Invoice::class,
                    'payable_id' => $invoice->id,
                    'notes' => $notes,
                    'paid_at' => now(),
                    'created_by' => $actor?->id,
                ]);

                InvoicePayment::create([
                    'invoice_id' => $invoice->id,
                    'payment_method_id' => $pm->id,
                    'payment_id' => $payment->id,
                    'amount' => $amount,
                    'notes' => $notes,
                    'created_by' => $actor?->id,
                    'created_at' => now(),
                ]);

                // Wholesale customer ledger: Payment credits account (reduces debt / creates credit)
                if ($saleType === SaleType::WHOLESALE && $customer) {
                    CustomerTransaction::create([
                        'customer_id' => $customer->id,
                        'type' => CustomerTransactionType::PAYMENT,
                        'direction' => CustomerTransactionDirection::CREDIT,
                        'amount' => $amount,
                        'reference_type' => Invoice::class,
                        'reference_id' => $invoice->id,
                        'description' => "سداد دفعة فاتورة مبيعات رقم {$invoice->invoice_number}",
                        'created_by' => $actor?->id,
                    ]);
                }
            }

            // 11. Audit Log
            if ($actor) {
                AuditLog::create([
                    'user_id' => $actor->id,
                    'action' => 'invoice_created',
                    'auditable_type' => Invoice::class,
                    'auditable_id' => $invoice->id,
                    'new_values' => [
                        'invoice_number' => $invoice->invoice_number,
                        'sale_type' => $invoice->sale_type->value,
                        'customer_id' => $customer?->id,
                        'total' => $invoiceTotal->toDecimal(),
                        'paid_amount' => $paidAmount->toDecimal(),
                        'remaining_amount' => $remainingAmount->toDecimal(),
                        'credit_amount' => $creditAmount->toDecimal(),
                        'items_count' => count($processedItems),
                        'payments_count' => count($validatedPayments),
                    ],
                ]);
            }

            return $invoice->load(['items.product.category', 'payments.paymentMethod', 'customer', 'creator']);
        });
    }

    protected function isInvoiceNumberCollision(\Throwable $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, 'invoice_number') || str_contains($message, 'unique');
    }

    protected function isIdempotencyKeyCollision(\Throwable $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, 'idempotency_key');
    }
}
