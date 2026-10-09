<?php

namespace App\Actions\Returns;

use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Inventory\Enums\InventoryMovementType;
use App\Domain\Payments\Enums\PaymentType;
use App\Domain\Returns\Enums\SalesReturnResolution;
use App\Domain\Sales\Enums\InvoiceItemType;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Sales\Enums\SaleType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\CustomerTransaction;
use App\Models\InventoryMovement;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\InvoicePayment;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\SalesReturn;
use App\Models\SalesReturnItem;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class CreateSalesReturnAction
{
    /**
     * Execute the sales return / exchange transaction.
     *
     *
     * @throws ValidationException
     */
    public function execute(array $data, ?User $actor = null): SalesReturn
    {
        $idempotencyKey = ! empty($data['idempotency_key']) ? trim($data['idempotency_key']) : null;
        $invoiceId = (int) ($data['invoice_id'] ?? 0);

        $lockKey = "sales_return_invoice:{$invoiceId}";

        $lock = Cache::lock($lockKey, 10);

        return $lock->block(10, function () use ($data, $actor, $idempotencyKey, $invoiceId) {
            // Re-check idempotency key after lock acquisition
            if (! empty($idempotencyKey)) {
                $existing = SalesReturn::where('idempotency_key', $idempotencyKey)
                    ->with(['items.product', 'invoice', 'customer', 'replacementInvoice.items', 'creator'])
                    ->first();

                if ($existing) {
                    if ($existing->invoice_id !== $invoiceId) {
                        throw ValidationException::withMessages([
                            'idempotency_key' => ['مفتاح عدم التكرار مستخدم مسبقاً مع فاتورة أخرى.'],
                        ]);
                    }

                    return $existing;
                }
            }

            // Retry loop on return number unique collision
            $maxAttempts = 5;
            for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
                try {
                    return $this->executeTransaction($data, $actor, $idempotencyKey);
                } catch (UniqueConstraintViolationException|QueryException $e) {
                    if (! empty($idempotencyKey) && $this->isIdempotencyKeyCollision($e)) {
                        $existing = SalesReturn::where('idempotency_key', $idempotencyKey)
                            ->with(['items.product', 'invoice', 'customer', 'replacementInvoice.items', 'creator'])
                            ->first();

                        if ($existing) {
                            if ($existing->invoice_id !== $invoiceId) {
                                throw ValidationException::withMessages([
                                    'idempotency_key' => ['مفتاح عدم التكرار مستخدم مسبقاً مع فاتورة أخرى.'],
                                ]);
                            }

                            return $existing;
                        }
                    }

                    if ($attempt < $maxAttempts && $this->isReturnNumberCollision($e)) {
                        usleep(10000 * $attempt);

                        continue;
                    }

                    throw $e;
                }
            }

            throw new \RuntimeException('تعذر توليد رقم مرتجع فريد بعد عدة محاولات.');
        });
    }

    /**
     * Internal atomic database transaction for sales return / exchange.
     */
    protected function executeTransaction(array $data, ?User $actor, ?string $idempotencyKey): SalesReturn
    {
        return DB::transaction(function () use ($data, $actor, $idempotencyKey) {
            // 1. Lock and validate the original Invoice
            $invoiceId = (int) ($data['invoice_id'] ?? 0);
            /** @var Invoice|null $invoice */
            $invoice = Invoice::where('id', $invoiceId)->lockForUpdate()->first();

            if (! $invoice) {
                throw ValidationException::withMessages([
                    'invoice_id' => ['فاتورة المبيعات المحددة غير موجودة بالنظام.'],
                ]);
            }

            if ($invoice->status === InvoiceStatus::CANCELLED) {
                throw ValidationException::withMessages([
                    'invoice_id' => ['لا يمكن إجراء مرتجع على فاتورة ملغاة.'],
                ]);
            }

            // 2. Validate Resolution
            $resolutionValue = $data['resolution'] ?? null;
            $resolution = SalesReturnResolution::tryFrom($resolutionValue);
            if (! $resolution) {
                throw ValidationException::withMessages([
                    'resolution' => ['نوع تسوية المرتجع غير صالح.'],
                ]);
            }

            // Customer verification
            $customer = $invoice->customer_id ? Customer::find($invoice->customer_id) : null;

            if ($resolution === SalesReturnResolution::CUSTOMER_ACCOUNT_CREDIT) {
                if (! $customer) {
                    throw ValidationException::withMessages([
                        'resolution' => ['خيار إضافة رصيد لحساب العميل متاح فقط للفواتير المرتبطة بعميل مسجل.'],
                    ]);
                }
                if (! $customer->is_active) {
                    throw ValidationException::withMessages([
                        'customer_id' => ['حساب العميل معطل ولا يمكن تسجيل حركات دائنة عليه.'],
                    ]);
                }
            }

            // 3. Validate & Lock Returned Items
            $rawReturnItems = $data['items'] ?? [];
            if (empty($rawReturnItems)) {
                throw ValidationException::withMessages([
                    'items' => ['يجب تحديد صنف واحد على الأقل للمرتجع.'],
                ]);
            }

            $requestedItemIds = [];
            foreach ($rawReturnItems as $rItem) {
                $itemId = (int) ($rItem['invoice_item_id'] ?? 0);
                if ($itemId <= 0) {
                    throw ValidationException::withMessages([
                        'items' => ['معرف بند الفاتورة غير صالح.'],
                    ]);
                }
                $requestedItemIds[] = $itemId;
            }

            // Check duplicates in return payload
            if (count($requestedItemIds) !== count(array_unique($requestedItemIds))) {
                throw ValidationException::withMessages([
                    'items' => ['لا يمكن تكرار نفس البند في طلب المرتجع.'],
                ]);
            }

            // Lock requested InvoiceItem rows
            $lockedInvoiceItems = InvoiceItem::where('invoice_id', $invoice->id)
                ->whereIn('id', $requestedItemIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            // Collect product IDs to lock for showroom stock restoration
            $productIdsToLock = [];
            foreach ($lockedInvoiceItems as $lItem) {
                if ($lItem->isNormalProduct() && $lItem->product_id) {
                    $productIdsToLock[] = $lItem->product_id;
                }
            }

            $lockedProducts = [];
            if (! empty($productIdsToLock)) {
                $lockedProducts = Product::whereIn('id', $productIdsToLock)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');
            }

            // Validate return quantities and snapshot historical costs
            $processedReturnItems = [];
            $totalReturnAmount = Money::zero();
            $totalProfitReversal = Money::zero();

            foreach ($rawReturnItems as $index => $rItem) {
                $itemId = (int) $rItem['invoice_item_id'];
                /** @var InvoiceItem|null $invoiceItem */
                $invoiceItem = $lockedInvoiceItems->get($itemId);

                if (! $invoiceItem) {
                    throw ValidationException::withMessages([
                        "items.{$index}.invoice_item_id" => ['بند الفاتورة المحدد غير تابع لهذه الفاتورة.'],
                    ]);
                }

                $requestedQuantity = (int) ($rItem['quantity'] ?? 0);
                if ($requestedQuantity <= 0) {
                    throw ValidationException::withMessages([
                        "items.{$index}.quantity" => ['كمية المرتجع يجب أن تكون عدداً صحيحاً أكبر من الصفر.'],
                    ]);
                }

                // Dynamic query of previously returned quantity
                $previouslyReturned = (int) SalesReturnItem::where('invoice_item_id', $invoiceItem->id)->sum('quantity');
                $remainingReturnable = $invoiceItem->quantity->toInt() - $previouslyReturned;

                if ($requestedQuantity > $remainingReturnable) {
                    throw ValidationException::withMessages([
                        "items.{$index}.quantity" => [
                            "الكمية المطلوبة للمرتجع من '{$invoiceItem->product_name}' ({$requestedQuantity}) تتجاوز الكمية المتبقية المتاحة للمرتجع ({$remainingReturnable}).",
                        ],
                    ]);
                }

                // Mandatory Historical Cost Rule:
                // Return calculations MUST use the historical snapshot stored on the original InvoiceItem!
                $unitSalePrice = $invoiceItem->unit_sale_price;
                $unitCost = $invoiceItem->unit_cost; // IMMUTABLE historical snapshot!
                $lineSubtotal = $unitSalePrice->multiply($requestedQuantity);
                $lineCostReversal = $unitCost->multiply($requestedQuantity);
                $lineProfitReversal = $lineSubtotal->subtract($lineCostReversal);

                $totalReturnAmount = $totalReturnAmount->add($lineSubtotal);
                $totalProfitReversal = $totalProfitReversal->add($lineProfitReversal);

                $product = $invoiceItem->isNormalProduct() && $invoiceItem->product_id
                    ? $lockedProducts->get($invoiceItem->product_id)
                    : null;

                $processedReturnItems[] = [
                    'invoice_item' => $invoiceItem,
                    'product' => $product,
                    'quantity' => Quantity::from($requestedQuantity),
                    'unit_sale_price' => $unitSalePrice,
                    'unit_cost' => $unitCost,
                    'subtotal' => $lineSubtotal,
                    'profit_reversal' => $lineProfitReversal,
                ];
            }

            // 4. Handle Resolution Specifics: Exchange Replacement Side / Cash Refund
            $replacementInvoice = null;
            $differenceAmount = Money::zero();
            $differencePaymentMethod = null;

            if ($resolution === SalesReturnResolution::EXCHANGE_EQUAL || $resolution === SalesReturnResolution::EXCHANGE_UPGRADE) {
                $rawReplacementItems = $data['replacement_items'] ?? [];
                if (empty($rawReplacementItems)) {
                    throw ValidationException::withMessages([
                        'replacement_items' => ['يجب تحديد أصناف الاستبدال البديلة.'],
                    ]);
                }

                $replacementProductIds = [];
                foreach ($rawReplacementItems as $rp) {
                    $pid = (int) ($rp['product_id'] ?? 0);
                    if ($pid <= 0) {
                        throw ValidationException::withMessages([
                            'replacement_items' => ['معرف منتج الاستبدال غير صالح.'],
                        ]);
                    }
                    $replacementProductIds[] = $pid;
                }

                if (count($replacementProductIds) !== count(array_unique($replacementProductIds))) {
                    throw ValidationException::withMessages([
                        'replacement_items' => ['لا يمكن تكرار نفس منتج الاستبدال في أكثر من سطر.'],
                    ]);
                }

                // Lock replacement products for deduction
                $lockedReplacementProducts = Product::whereIn('id', $replacementProductIds)
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                $processedReplacementItems = [];
                $replacementTotal = Money::zero();

                foreach ($rawReplacementItems as $idx => $rp) {
                    $pid = (int) $rp['product_id'];
                    /** @var Product|null $rProduct */
                    $rProduct = $lockedReplacementProducts->get($pid);

                    if (! $rProduct) {
                        throw ValidationException::withMessages([
                            "replacement_items.{$idx}.product_id" => ['منتج الاستبدال المحدد غير موجود بالنظام.'],
                        ]);
                    }

                    if (! $rProduct->is_active) {
                        throw ValidationException::withMessages([
                            "replacement_items.{$idx}.product_id" => ["منتج الاستبدال '{$rProduct->name}' معطل."],
                        ]);
                    }

                    $rQty = Quantity::from($rp['quantity'] ?? 0);
                    if ($rQty->isZero() || $rQty->isNegative()) {
                        throw ValidationException::withMessages([
                            "replacement_items.{$idx}.quantity" => ['كمية الاستبدال يجب أن تكون عدداً صحيحاً أكبر من الصفر.'],
                        ]);
                    }

                    // Stock availability check for replacement item
                    if ($rProduct->stock_quantity->isLessThan($rQty)) {
                        throw ValidationException::withMessages([
                            "replacement_items.{$idx}.quantity" => [
                                "لا توجد كمية كافية من منتج الاستبدال '{$rProduct->name}'. المتاح حالياً: {$rProduct->stock_quantity->toInt()}.",
                            ],
                        ]);
                    }

                    // Price for replacement: user override or default based on original sale type
                    if (isset($rp['unit_sale_price']) && is_numeric($rp['unit_sale_price'])) {
                        $rUnitSalePrice = Money::fromDecimal($rp['unit_sale_price']);
                    } else {
                        $rUnitSalePrice = $invoice->sale_type === SaleType::WHOLESALE
                            ? $rProduct->wholesale_price
                            : $rProduct->retail_price;
                    }

                    if ($rUnitSalePrice->isNegative()) {
                        throw new InvalidArgumentException("سعر بيع منتج الاستبدال '{$rProduct->name}' لا يمكن أن يكون سالباً.");
                    }

                    // Current purchase cost frozen at the time of replacement
                    $rUnitCost = $rProduct->purchase_cost;
                    $rSubtotal = $rUnitSalePrice->multiply($rQty->toInt());
                    $rTotalCost = $rUnitCost->multiply($rQty->toInt());
                    $rProfit = $rSubtotal->subtract($rTotalCost);

                    $replacementTotal = $replacementTotal->add($rSubtotal);

                    $processedReplacementItems[] = [
                        'product' => $rProduct,
                        'quantity' => $rQty,
                        'unit_sale_price' => $rUnitSalePrice,
                        'unit_cost' => $rUnitCost,
                        'subtotal' => $rSubtotal,
                        'total_cost' => $rTotalCost,
                        'profit' => $rProfit,
                    ];
                }

                if ($resolution === SalesReturnResolution::EXCHANGE_EQUAL) {
                    if (! $replacementTotal->equals($totalReturnAmount)) {
                        throw ValidationException::withMessages([
                            'replacement_items' => [
                                "في الاستبدال المتطابق القيمة، يجب أن تكون قيمة البضاعة البديلة ({$replacementTotal->toDecimal()}) مساوية تماماً لقيمة البضاعة المرتجعة ({$totalReturnAmount->toDecimal()}).",
                            ],
                        ]);
                    }
                    $differenceAmount = Money::zero();
                } else {
                    // EXCHANGE_UPGRADE
                    if (! $replacementTotal->isGreaterThan($totalReturnAmount)) {
                        throw ValidationException::withMessages([
                            'replacement_items' => [
                                "في استبدال الترقية، يجب أن تكون قيمة البضاعة البديلة ({$replacementTotal->toDecimal()}) أكبر من قيمة البضاعة المرتجعة ({$totalReturnAmount->toDecimal()}).",
                            ],
                        ]);
                    }

                    $differenceAmount = $replacementTotal->subtract($totalReturnAmount);

                    // Must collect difference via valid active payment method
                    $pmId = (int) ($data['difference_payment_method_id'] ?? 0);
                    $differencePaymentMethod = PaymentMethod::find($pmId);

                    if (! $differencePaymentMethod || ! $differencePaymentMethod->is_active) {
                        throw ValidationException::withMessages([
                            'difference_payment_method_id' => ['يجب اختيار طريقة دفع صالحة ونشطة لسداد فارق الاستبدال.'],
                        ]);
                    }
                }
            } elseif ($resolution === SalesReturnResolution::REFUND_CASH) {
                // Cash refund payment method
                $pmId = (int) ($data['payment_method_id'] ?? 0);
                if ($pmId > 0) {
                    $differencePaymentMethod = PaymentMethod::find($pmId);
                    if (! $differencePaymentMethod || ! $differencePaymentMethod->is_active) {
                        throw ValidationException::withMessages([
                            'payment_method_id' => ['طريقة دفع الاسترداد النقدي غير صالحة أو معطلة.'],
                        ]);
                    }
                } else {
                    // Default to active cash payment method
                    $differencePaymentMethod = PaymentMethod::where('is_cash', true)->where('is_active', true)->first();
                    if (! $differencePaymentMethod) {
                        $differencePaymentMethod = PaymentMethod::where('is_active', true)->first();
                    }
                }
            }

            // 5. Generate Concurrency-Safe Return Number (RET-YYYYMMDD-XXXX)
            $datePrefix = Carbon::now()->format('Ymd');
            $latestReturn = SalesReturn::where('return_number', 'LIKE', "RET-{$datePrefix}-%")
                ->lockForUpdate()
                ->orderBy('return_number', 'desc')
                ->value('return_number');

            $nextReturnSeq = 1;
            if ($latestReturn && preg_match('/RET-\d{8}-(\d{4})$/', $latestReturn, $matches)) {
                $nextReturnSeq = ((int) $matches[1]) + 1;
            }

            $returnNumber = sprintf('RET-%s-%04d', $datePrefix, $nextReturnSeq);

            // 6. Create SalesReturn Header
            $salesReturn = SalesReturn::create([
                'return_number' => $returnNumber,
                'idempotency_key' => $idempotencyKey,
                'invoice_id' => $invoice->id,
                'customer_id' => $invoice->customer_id,
                'resolution' => $resolution,
                'total_return_amount' => $totalReturnAmount,
                'replacement_invoice_id' => null,
                'difference_amount' => $differenceAmount,
                'notes' => isset($data['notes']) ? trim($data['notes']) : null,
                'created_by' => $actor?->id,
            ]);

            // 7. Persist SalesReturn Items & Inventory Restoration
            foreach ($processedReturnItems as $pItem) {
                /** @var InvoiceItem $invItem */
                $invItem = $pItem['invoice_item'];
                $qty = $pItem['quantity'];

                SalesReturnItem::create([
                    'sales_return_id' => $salesReturn->id,
                    'invoice_item_id' => $invItem->id,
                    'product_id' => $invItem->product_id,
                    'quantity' => $qty,
                    'unit_sale_price' => $pItem['unit_sale_price'],
                    'unit_cost' => $pItem['unit_cost'],
                    'subtotal' => $pItem['subtotal'],
                    'profit_reversal' => $pItem['profit_reversal'],
                ]);

                // Showroom Product Inventory Restoration
                if ($invItem->isNormalProduct() && $pItem['product']) {
                    /** @var Product $product */
                    $product = $pItem['product'];
                    $newStock = $product->stock_quantity->add($qty);
                    $product->stock_quantity = $newStock;
                    $product->save();

                    // Record sales_return inventory movement
                    InventoryMovement::create([
                        'product_id' => $product->id,
                        'type' => InventoryMovementType::SALES_RETURN,
                        'quantity' => $qty,
                        'unit_cost' => $pItem['unit_cost'], // Historical cost snapshot
                        'resulting_stock' => $newStock,
                        'reference_type' => SalesReturn::class,
                        'reference_id' => $salesReturn->id,
                        'reason' => "مرتجع مبيعات رقم {$salesReturn->return_number} من فاتورة {$invoice->invoice_number}",
                        'created_by' => $actor?->id,
                    ]);
                }
                // External products: NO inventory movement and NO showroom stock mutation
            }

            // 8. Execute Resolution Effects (Refund, Credit, Exchange)
            if ($resolution === SalesReturnResolution::REFUND_CASH) {
                // Record cash payout payment
                $paymentDatePrefix = Carbon::now()->format('Ymd');
                $latestPayment = Payment::where('payment_number', 'LIKE', "PAY-{$paymentDatePrefix}-%")
                    ->lockForUpdate()
                    ->orderBy('payment_number', 'desc')
                    ->value('payment_number');

                $nextPaySeq = 1;
                if ($latestPayment && preg_match('/PAY-\d{8}-(\d{4})$/', $latestPayment, $pm)) {
                    $nextPaySeq = ((int) $pm[1]) + 1;
                }

                $paymentNumber = sprintf('PAY-%s-%04d', $paymentDatePrefix, $nextPaySeq);

                Payment::create([
                    'payment_number' => $paymentNumber,
                    'payment_method_id' => $differencePaymentMethod->id,
                    'amount' => $totalReturnAmount,
                    'payment_type' => PaymentType::REFUND,
                    'payable_type' => SalesReturn::class,
                    'payable_id' => $salesReturn->id,
                    'notes' => "استرداد نقدي لمرتجع مبيعات رقم {$salesReturn->return_number}",
                    'paid_at' => now(),
                    'created_by' => $actor?->id,
                ]);

                // Wholesale customer ledger traceability:
                // Credit return value, then Debit cash refund payment -> Net ledger balance unchanged
                if ($invoice->sale_type === SaleType::WHOLESALE && $customer) {
                    CustomerTransaction::create([
                        'customer_id' => $customer->id,
                        'type' => CustomerTransactionType::RETURN,
                        'direction' => CustomerTransactionDirection::CREDIT,
                        'amount' => $totalReturnAmount,
                        'reference_type' => SalesReturn::class,
                        'reference_id' => $salesReturn->id,
                        'description' => "مرتجع مبيعات رقم {$salesReturn->return_number}",
                        'created_by' => $actor?->id,
                    ]);

                    CustomerTransaction::create([
                        'customer_id' => $customer->id,
                        'type' => CustomerTransactionType::REFUND,
                        'direction' => CustomerTransactionDirection::DEBIT,
                        'amount' => $totalReturnAmount,
                        'reference_type' => SalesReturn::class,
                        'reference_id' => $salesReturn->id,
                        'description' => "استرداد نقدي لمرتجع مبيعات رقم {$salesReturn->return_number}",
                        'created_by' => $actor?->id,
                    ]);
                }
            } elseif ($resolution === SalesReturnResolution::CUSTOMER_ACCOUNT_CREDIT) {
                // Wholesale account credit via CustomerTransaction
                if ($customer) {
                    CustomerTransaction::create([
                        'customer_id' => $customer->id,
                        'type' => CustomerTransactionType::RETURN,
                        'direction' => CustomerTransactionDirection::CREDIT,
                        'amount' => $totalReturnAmount,
                        'reference_type' => SalesReturn::class,
                        'reference_id' => $salesReturn->id,
                        'description' => "إضافة رصيد دائن لمرتجع مبيعات رقم {$salesReturn->return_number}",
                        'created_by' => $actor?->id,
                    ]);
                }
            } elseif ($resolution === SalesReturnResolution::EXCHANGE_EQUAL || $resolution === SalesReturnResolution::EXCHANGE_UPGRADE) {
                // Build Replacement Invoice
                $invDatePrefix = Carbon::now()->format('Ymd');
                $latestInv = Invoice::where('invoice_number', 'LIKE', "INV-{$invDatePrefix}-%")
                    ->lockForUpdate()
                    ->orderBy('invoice_number', 'desc')
                    ->value('invoice_number');

                $nextInvSeq = 1;
                if ($latestInv && preg_match('/INV-\d{8}-(\d{4})$/', $latestInv, $im)) {
                    $nextInvSeq = ((int) $im[1]) + 1;
                }

                $replacementInvoiceNumber = sprintf('INV-%s-%04d', $invDatePrefix, $nextInvSeq);

                $replacementInvoice = Invoice::create([
                    'invoice_number' => $replacementInvoiceNumber,
                    'customer_id' => $invoice->customer_id,
                    'sale_type' => $invoice->sale_type,
                    'status' => InvoiceStatus::POSTED,
                    'subtotal' => $replacementTotal,
                    'discount_amount' => Money::zero(),
                    'total' => $replacementTotal,
                    'paid_amount' => $replacementTotal,
                    'remaining_amount' => Money::zero(),
                    'credit_amount' => Money::zero(),
                    'notes' => "فاتورة استبدال مرتبطة بمرتجع رقم {$salesReturn->return_number}",
                    'created_by' => $actor?->id,
                ]);

                // Link replacement invoice to sales return
                $salesReturn->replacement_invoice_id = $replacementInvoice->id;
                $salesReturn->save();

                // Persist replacement items, deduct stock & record sale inventory movements
                foreach ($processedReplacementItems as $rItem) {
                    /** @var Product $rProduct */
                    $rProduct = $rItem['product'];
                    $rQty = $rItem['quantity'];

                    $repItem = InvoiceItem::create([
                        'invoice_id' => $replacementInvoice->id,
                        'product_id' => $rProduct->id,
                        'item_type' => InvoiceItemType::PRODUCT,
                        'product_name' => $rProduct->name,
                        'barcode' => $rProduct->barcode,
                        'quantity' => $rQty,
                        'unit_sale_price' => $rItem['unit_sale_price'],
                        'unit_cost' => $rItem['unit_cost'],
                        'subtotal' => $rItem['subtotal'],
                        'total_cost' => $rItem['total_cost'],
                        'profit' => $rItem['profit'],
                    ]);

                    // Deduct replacement product stock
                    $newReplStock = $rProduct->stock_quantity->subtract($rQty);
                    $rProduct->stock_quantity = $newReplStock;
                    $rProduct->save();

                    // Create sale inventory movement
                    InventoryMovement::create([
                        'product_id' => $rProduct->id,
                        'type' => InventoryMovementType::SALE,
                        'quantity' => $rQty,
                        'unit_cost' => $rItem['unit_cost'],
                        'resulting_stock' => $newReplStock,
                        'reference_type' => Invoice::class,
                        'reference_id' => $replacementInvoice->id,
                        'reason' => "صرف بضاعة استبدال فاتورة رقم {$replacementInvoice->invoice_number}",
                        'created_by' => $actor?->id,
                    ]);
                }

                // If exchange upgrade with collected difference, record the payment
                if ($resolution === SalesReturnResolution::EXCHANGE_UPGRADE && $differenceAmount->isGreaterThan(Money::zero()) && $differencePaymentMethod) {
                    $pDatePrefix = Carbon::now()->format('Ymd');
                    $latestPay = Payment::where('payment_number', 'LIKE', "PAY-{$pDatePrefix}-%")
                        ->lockForUpdate()
                        ->orderBy('payment_number', 'desc')
                        ->value('payment_number');

                    $nextPSeq = 1;
                    if ($latestPay && preg_match('/PAY-\d{8}-(\d{4})$/', $latestPay, $pMatches)) {
                        $nextPSeq = ((int) $pMatches[1]) + 1;
                    }

                    $payNumber = sprintf('PAY-%s-%04d', $pDatePrefix, $nextPSeq);

                    $paymentRecord = Payment::create([
                        'payment_number' => $payNumber,
                        'payment_method_id' => $differencePaymentMethod->id,
                        'amount' => $differenceAmount,
                        'payment_type' => PaymentType::EXCHANGE_PAYMENT,
                        'payable_type' => Invoice::class,
                        'payable_id' => $replacementInvoice->id,
                        'notes' => "سداد فارق استبدال لمرتجع رقم {$salesReturn->return_number}",
                        'paid_at' => now(),
                        'created_by' => $actor?->id,
                    ]);

                    InvoicePayment::create([
                        'invoice_id' => $replacementInvoice->id,
                        'payment_method_id' => $differencePaymentMethod->id,
                        'payment_id' => $paymentRecord->id,
                        'amount' => $differenceAmount,
                        'notes' => "سداد فارق استبدال لمرتجع رقم {$salesReturn->return_number}",
                        'created_by' => $actor?->id,
                        'created_at' => now(),
                    ]);
                }

                // Wholesale Customer Ledger Integration for Exchange
                if ($invoice->sale_type === SaleType::WHOLESALE && $customer) {
                    // 1. Credit return merchandise value
                    CustomerTransaction::create([
                        'customer_id' => $customer->id,
                        'type' => CustomerTransactionType::RETURN,
                        'direction' => CustomerTransactionDirection::CREDIT,
                        'amount' => $totalReturnAmount,
                        'reference_type' => SalesReturn::class,
                        'reference_id' => $salesReturn->id,
                        'description' => "مرتجع مبيعات استبدال رقم {$salesReturn->return_number}",
                        'created_by' => $actor?->id,
                    ]);

                    // 2. Debit replacement invoice total
                    CustomerTransaction::create([
                        'customer_id' => $customer->id,
                        'type' => CustomerTransactionType::INVOICE,
                        'direction' => CustomerTransactionDirection::DEBIT,
                        'amount' => $replacementTotal,
                        'reference_type' => Invoice::class,
                        'reference_id' => $replacementInvoice->id,
                        'description' => "فاتورة استبدال بضاعة رقم {$replacementInvoice->invoice_number}",
                        'created_by' => $actor?->id,
                    ]);

                    // 3. Credit difference payment if collected
                    if ($resolution === SalesReturnResolution::EXCHANGE_UPGRADE && $differenceAmount->isGreaterThan(Money::zero())) {
                        CustomerTransaction::create([
                            'customer_id' => $customer->id,
                            'type' => CustomerTransactionType::PAYMENT,
                            'direction' => CustomerTransactionDirection::CREDIT,
                            'amount' => $differenceAmount,
                            'reference_type' => Invoice::class,
                            'reference_id' => $replacementInvoice->id,
                            'description' => "سداد فارق استبدال فاتورة رقم {$replacementInvoice->invoice_number}",
                            'created_by' => $actor?->id,
                        ]);
                    }
                }
            }

            // 9. Audit Logging
            if ($actor) {
                AuditLog::create([
                    'user_id' => $actor->id,
                    'action' => 'return_created',
                    'auditable_type' => SalesReturn::class,
                    'auditable_id' => $salesReturn->id,
                    'old_values' => null,
                    'new_values' => [
                        'return_number' => $salesReturn->return_number,
                        'invoice_number' => $invoice->invoice_number,
                        'customer_id' => $invoice->customer_id,
                        'resolution' => $salesReturn->resolution->value,
                        'total_return_amount' => $salesReturn->total_return_amount->toDecimal(),
                        'difference_amount' => $salesReturn->difference_amount->toDecimal(),
                        'replacement_invoice_id' => $salesReturn->replacement_invoice_id,
                        'returned_items_count' => count($processedReturnItems),
                    ],
                ]);
            }

            return $salesReturn->load(['items.product', 'invoice', 'customer', 'replacementInvoice.items', 'creator']);
        });
    }

    protected function isReturnNumberCollision(QueryException $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, 'sales_returns_return_number_unique')
            || (str_contains($message, 'duplicate') && str_contains($message, 'return_number'));
    }

    protected function isIdempotencyKeyCollision(QueryException $e): bool
    {
        $message = strtolower($e->getMessage());

        return str_contains($message, 'sales_returns_idempotency_key_unique')
            || (str_contains($message, 'duplicate') && str_contains($message, 'idempotency_key'));
    }
}
