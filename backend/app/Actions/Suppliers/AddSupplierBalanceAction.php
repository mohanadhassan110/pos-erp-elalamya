<?php

namespace App\Actions\Suppliers;

use App\Domain\Suppliers\Enums\SupplierTransactionDirection;
use App\Domain\Suppliers\Enums\SupplierTransactionType;
use App\Domain\Support\Money;
use App\Models\AuditLog;
use App\Models\Supplier;
use App\Models\SupplierTransaction;
use App\Models\User;
use InvalidArgumentException;

class AddSupplierBalanceAction
{
    /**
     * Adds balance to supplier payable account.
     * Note: This is strictly an accounting operation.
     * It does NOT modify product inventory or stock movements.
     */
    public function execute(Supplier $supplier, array $data, ?User $actor = null): SupplierTransaction
    {
        if (! $supplier->is_active) {
            throw new InvalidArgumentException('لا يمكن إضافة رصيد لمورد معطل.');
        }

        $amount = Money::fromDecimal($data['amount']);
        if ($amount->isZero() || $amount->isNegative()) {
            throw new InvalidArgumentException('مبلغ الرصيد المضاف يجب أن يكون أكبر من الصفر.');
        }

        $description = trim($data['description'] ?? '');
        if (empty($description)) {
            throw new InvalidArgumentException('يجب كتابة بيان/تفاصيل إضافة الرصيد (مثل: فاتورة شراء خارجية).');
        }

        $transaction = SupplierTransaction::create([
            'supplier_id' => $supplier->id,
            'type' => SupplierTransactionType::MANUAL_BALANCE_INCREASE,
            'direction' => SupplierTransactionDirection::CREDIT,
            'amount' => $amount,
            'reference_type' => null,
            'reference_id' => null,
            'description' => $description,
            'created_by' => $actor?->id,
        ]);

        if ($actor) {
            AuditLog::create([
                'user_id' => $actor->id,
                'action' => 'supplier_balance_added',
                'auditable_type' => Supplier::class,
                'auditable_id' => $supplier->id,
                'new_values' => [
                    'amount' => $amount->toDecimal(),
                    'description' => $description,
                    'transaction_id' => $transaction->id,
                ],
            ]);
        }

        return $transaction;
    }
}
