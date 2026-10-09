<?php

namespace App\Services\Reports;

use App\Domain\Payments\Enums\PaymentType;
use App\Domain\Support\Money;
use App\Models\Payment;
use Carbon\Carbon;

class PaymentReportService
{
    /**
     * Compute payment methods breakdown and cash movements for the period.
     */
    public function getSummary(Carbon $startUtc, Carbon $endUtc): array
    {
        $payments = Payment::where(function ($q) use ($startUtc, $endUtc) {
            $q->whereBetween('paid_at', [$startUtc, $endUtc])
                ->orWhere(function ($q2) use ($startUtc, $endUtc) {
                    $q2->whereNull('paid_at')
                        ->whereBetween('created_at', [$startUtc, $endUtc]);
                });
        })
            ->with(['paymentMethod'])
            ->orderBy('id', 'desc')
            ->get();

        $totalInflows = Money::zero();
        $totalOutflows = Money::zero();

        $invoicePaymentsTotal = Money::zero();
        $exchangePaymentsTotal = Money::zero();
        $refundsTotal = Money::zero();

        $cashInflows = Money::zero();
        $cashOutflows = Money::zero();

        $methodMap = [];
        $paymentItems = [];

        foreach ($payments as $payment) {
            $amount = $payment->amount;
            $type = $payment->payment_type;
            $pm = $payment->paymentMethod;
            $pmName = $pm?->name ?? 'غير محدد';
            $pmCode = $pm?->code ?? 'unknown';
            $isCash = (bool) ($pm?->is_cash ?? false);

            $isOutflow = ($type === PaymentType::REFUND);

            if ($isOutflow) {
                $totalOutflows = $totalOutflows->add($amount);
                $refundsTotal = $refundsTotal->add($amount);
                if ($isCash) {
                    $cashOutflows = $cashOutflows->add($amount);
                }
            } else {
                $totalInflows = $totalInflows->add($amount);
                if ($type === PaymentType::EXCHANGE_PAYMENT) {
                    $exchangePaymentsTotal = $exchangePaymentsTotal->add($amount);
                } else {
                    $invoicePaymentsTotal = $invoicePaymentsTotal->add($amount);
                }
                if ($isCash) {
                    $cashInflows = $cashInflows->add($amount);
                }
            }

            if (! isset($methodMap[$pmName])) {
                $methodMap[$pmName] = [
                    'payment_method_name' => $pmName,
                    'code' => $pmCode,
                    'is_cash' => $isCash,
                    'inflows' => Money::zero(),
                    'outflows' => Money::zero(),
                    'count' => 0,
                ];
            }

            if ($isOutflow) {
                $methodMap[$pmName]['outflows'] = $methodMap[$pmName]['outflows']->add($amount);
            } else {
                $methodMap[$pmName]['inflows'] = $methodMap[$pmName]['inflows']->add($amount);
            }
            $methodMap[$pmName]['count']++;

            $paymentItems[] = [
                'id' => $payment->id,
                'payment_number' => $payment->payment_number,
                'payment_type' => $payment->payment_type->value,
                'payment_type_label' => $payment->payment_type->label(),
                'payment_method_name' => $pmName,
                'amount' => $amount->toDecimal(),
                'is_outflow' => $isOutflow,
                'paid_at' => $payment->paid_at?->format('Y-m-d H:i') ?? $payment->created_at?->format('Y-m-d H:i'),
                'notes' => $payment->notes,
            ];
        }

        $netMovement = $totalInflows->subtract($totalOutflows);
        $netCashMovement = $cashInflows->subtract($cashOutflows);

        $formattedMethods = [];
        foreach ($methodMap as $m) {
            $netM = $m['inflows']->subtract($m['outflows']);
            $formattedMethods[] = [
                'payment_method_name' => $m['payment_method_name'],
                'code' => $m['code'],
                'is_cash' => $m['is_cash'],
                'inflows' => $m['inflows']->toDecimal(),
                'outflows' => $m['outflows']->toDecimal(),
                'net' => $netM->toDecimal(),
                'transactions_count' => $m['count'],
            ];
        }

        return [
            'total_inflows' => $totalInflows->toDecimal(),
            'total_outflows' => $totalOutflows->toDecimal(),
            'net_movement' => $netMovement->toDecimal(),

            'invoice_payments_total' => $invoicePaymentsTotal->toDecimal(),
            'exchange_payments_total' => $exchangePaymentsTotal->toDecimal(),
            'refunds_total' => $refundsTotal->toDecimal(),

            'cash_inflows' => $cashInflows->toDecimal(),
            'cash_outflows' => $cashOutflows->toDecimal(),
            'net_cash_movement' => $netCashMovement->toDecimal(),

            // Support both keys for frontend and backend compatibility
            'payment_methods' => $formattedMethods,
            'methods_breakdown' => $formattedMethods,
            'payments' => $paymentItems,
            'scope_notice' => 'تقرير حركة وطرق الدفع يعكس المقبوضات والمردودات الفعلية المسجلة خلال الفترة، ولا يمثل رصيد درج النقدية لعدم تتبع رصيد الافتتاح والخزينة التراكمية.',
        ];
    }
}
