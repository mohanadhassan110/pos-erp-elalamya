<?php

namespace App\Actions\Customers;

use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Payments\Enums\PaymentType;
use App\Domain\Support\Money;
use App\Models\AuditLog;
use App\Models\Customer;
use App\Models\CustomerTransaction;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateCustomerPaymentAction
{
    /**
     * Records a standalone payment/installment received from a customer on account.
     * Credits customer ledger (reduces debt / increases customer credit).
     */
    public function execute(Customer $customer, array $data, ?User $actor = null): Payment
    {
        if (! $customer->is_active) {
            throw ValidationException::withMessages([
                'customer_id' => ['لا يمكن تسجيل دفعة لعميل معطل.'],
            ]);
        }

        $amount = Money::fromDecimal($data['amount']);
        if ($amount->isZero() || $amount->isNegative()) {
            throw ValidationException::withMessages([
                'amount' => ['مبلغ الدفعة يجب أن يكون أكبر من الصفر.'],
            ]);
        }

        $paymentMethod = PaymentMethod::findOrFail($data['payment_method_id']);
        if (! $paymentMethod->is_active) {
            throw ValidationException::withMessages([
                'payment_method_id' => ['طريقة الدفع المحددة غير نشطة.'],
            ]);
        }

        $notes = ! empty($data['notes']) ? trim($data['notes']) : null;

        return DB::transaction(function () use ($customer, $amount, $paymentMethod, $notes, $actor) {
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
                        'payment_type' => PaymentType::CUSTOMER_PAYMENT,
                        'payable_type' => Customer::class,
                        'payable_id' => $customer->id,
                        'notes' => $notes,
                        'paid_at' => now(),
                        'created_by' => $actor?->id,
                    ]);

                    $transactionDesc = 'سداد دفعة على الحساب';
                    if ($notes) {
                        $transactionDesc .= " - {$notes}";
                    }

                    $transaction = CustomerTransaction::create([
                        'customer_id' => $customer->id,
                        'type' => CustomerTransactionType::PAYMENT,
                        'direction' => CustomerTransactionDirection::CREDIT,
                        'amount' => $amount,
                        'reference_type' => Payment::class,
                        'reference_id' => $payment->id,
                        'description' => $transactionDesc,
                        'created_by' => $actor?->id,
                    ]);

                    if ($actor) {
                        AuditLog::create([
                            'user_id' => $actor->id,
                            'action' => 'customer_payment_created',
                            'auditable_type' => Customer::class,
                            'auditable_id' => $customer->id,
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
