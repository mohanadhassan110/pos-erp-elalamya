<?php

namespace App\Actions\Suppliers;

use App\Domain\Payments\Enums\PaymentType;
use App\Domain\Suppliers\Enums\SupplierTransactionDirection;
use App\Domain\Suppliers\Enums\SupplierTransactionType;
use App\Domain\Support\Money;
use App\Models\AuditLog;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\Supplier;
use App\Models\SupplierTransaction;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateSupplierPaymentAction
{
    /**
     * Records a payment/installment paid to a supplier.
     * Debits supplier ledger (reduces payable owed to supplier).
     */
    public function execute(Supplier $supplier, array $data, ?User $actor = null): Payment
    {
        if (! $supplier->is_active) {
            throw ValidationException::withMessages([
                'supplier_id' => ['لا يمكن تسجيل سداد دفعة لمورد معطل.'],
            ]);
        }

        $amount = Money::fromDecimal($data['amount']);
        if ($amount->isZero() || $amount->isNegative()) {
            throw ValidationException::withMessages([
                'amount' => ['مبلغ السداد يجب أن يكون أكبر من الصفر.'],
            ]);
        }

        $paymentMethod = PaymentMethod::findOrFail($data['payment_method_id']);
        if (! $paymentMethod->is_active) {
            throw ValidationException::withMessages([
                'payment_method_id' => ['طريقة الدفع المحددة غير نشطة.'],
            ]);
        }

        $notes = ! empty($data['notes']) ? trim($data['notes']) : null;

        return DB::transaction(function () use ($supplier, $amount, $paymentMethod, $notes, $actor) {
            $maxAttempts = 5;
            for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
                try {
                    $paymentDatePrefix = Carbon::now()->format('Ymd');
                    $latestPayment = Payment::where('payment_number', 'LIKE', "PAY-{$paymentDatePrefix}-%")
                        ->lockForUpdate()
                        ->orderBy('payment_number', 'desc')
                        ->value('payment_number');

                    $nextSeq = 1;
                    if ($latestPayment && preg_match('/PAY-\d{8}-(\d{4})$/', $latestPayment, $m)) {
                        $nextSeq = ((int) $m[1]) + 1;
                    }
                    $paymentNumber = sprintf('PAY-%s-%04d', $paymentDatePrefix, $nextSeq);

                    $payment = Payment::create([
                        'payment_number' => $paymentNumber,
                        'payment_method_id' => $paymentMethod->id,
                        'amount' => $amount,
                        'payment_type' => PaymentType::SUPPLIER_PAYMENT,
                        'payable_type' => Supplier::class,
                        'payable_id' => $supplier->id,
                        'notes' => $notes,
                        'paid_at' => now(),
                        'created_by' => $actor?->id,
                    ]);

                    $transactionDesc = 'سداد دفعة للمورد';
                    if ($notes) {
                        $transactionDesc .= " - {$notes}";
                    }

                    $transaction = SupplierTransaction::create([
                        'supplier_id' => $supplier->id,
                        'type' => SupplierTransactionType::PAYMENT,
                        'direction' => SupplierTransactionDirection::DEBIT,
                        'amount' => $amount,
                        'reference_type' => Payment::class,
                        'reference_id' => $payment->id,
                        'description' => $transactionDesc,
                        'created_by' => $actor?->id,
                    ]);

                    if ($actor) {
                        AuditLog::create([
                            'user_id' => $actor->id,
                            'action' => 'supplier_payment_created',
                            'auditable_type' => Supplier::class,
                            'auditable_id' => $supplier->id,
                            'new_values' => [
                                'amount' => $amount->toDecimal(),
                                'payment_number' => $payment->payment_number,
                                'payment_method_id' => $paymentMethod->id,
                                'payment_id' => $payment->id,
                                'transaction_id' => $transaction->id,
                                'notes' => $notes,
                            ],
                        ]);
                    }

                    return $payment;
                } catch (QueryException $e) {
                    if ($attempt < $maxAttempts && $e->errorInfo[1] == 1062) {
                        usleep(10000 * $attempt);

                        continue;
                    }
                    throw $e;
                }
            }

            throw new \RuntimeException('تعذر توليد رقم دفعة فريد.');
        });
    }
}
