<?php

namespace App\Services\Ledger;

use App\Domain\Suppliers\Enums\SupplierTransactionDirection;
use App\Domain\Support\Money;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\StockReceipt;
use App\Models\Supplier;
use Carbon\Carbon;
use Illuminate\Http\Request;

class SupplierStatementService
{
    /**
     * Build detailed chronological statement of account (كشف حساب مورد)
     * with running balance, period summaries, and resolved reference numbers.
     */
    public function getStatement(Supplier $supplier, Request $request): array
    {
        $fromDate = $request->filled('from_date') ? Carbon::parse($request->query('from_date'))->startOfDay() : null;
        $toDate = $request->filled('to_date') ? Carbon::parse($request->query('to_date'))->endOfDay() : null;

        // 1. Calculate opening balance (prior payable debt = prior credits - prior debits)
        $openingBalance = Money::zero();
        $openingCredits = Money::zero();
        $openingDebits = Money::zero();

        if ($fromDate) {
            $priorTransactions = $supplier->transactions()
                ->where('created_at', '<', $fromDate)
                ->get();

            foreach ($priorTransactions as $pt) {
                if ($pt->direction === SupplierTransactionDirection::CREDIT) {
                    $openingCredits = $openingCredits->add($pt->amount);
                } else {
                    $openingDebits = $openingDebits->add($pt->amount);
                }
            }
            $openingBalance = $openingCredits->subtract($openingDebits);
        }

        // 2. Fetch transactions in chronological order
        $query = $supplier->transactions()
            ->with(['creator', 'reference'])
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc');

        if ($fromDate) {
            $query->where('created_at', '>=', $fromDate);
        }
        if ($toDate) {
            $query->where('created_at', '<=', $toDate);
        }

        $transactions = $query->get();

        $runningPayable = $openingBalance;
        $periodCredits = Money::zero(); // توريدات / زيادة مستحق
        $periodDebits = Money::zero();  // سداد / تقليل مستحق
        $items = [];

        foreach ($transactions as $tx) {
            $isCredit = ($tx->direction === SupplierTransactionDirection::CREDIT);
            $amount = $tx->amount;

            if ($isCredit) {
                $periodCredits = $periodCredits->add($amount);
                $runningPayable = $runningPayable->add($amount);
                $creditAmount = $amount->toDecimal();
                $debitAmount = '0.00';
            } else {
                $periodDebits = $periodDebits->add($amount);
                $runningPayable = $runningPayable->subtract($amount);
                $creditAmount = '0.00';
                $debitAmount = $amount->toDecimal();
            }

            // Resolve reference number
            $referenceNumber = null;
            if ($tx->reference) {
                if ($tx->reference instanceof StockReceipt) {
                    $referenceNumber = $tx->reference->receipt_number;
                } elseif ($tx->reference instanceof Payment) {
                    $referenceNumber = $tx->reference->payment_number;
                }
            }

            $items[] = [
                'id' => $tx->id,
                'created_at' => $tx->created_at->toISOString(),
                'date_formatted' => $tx->created_at->format('Y-m-d H:i'),
                'type' => $tx->type->value,
                'type_label' => $tx->type->label(),
                'direction' => $tx->direction->value,
                'direction_label' => $tx->direction->label(),
                'amount' => $amount->toDecimal(),
                'debit' => $debitAmount,   // مسدد للمورد
                'credit' => $creditAmount, // توريد / مستحق
                'running_balance' => $runningPayable->toDecimal(),
                'running_balance_formatted' => $runningPayable->formattedArabic(),
                'reference_type' => $tx->reference_type,
                'reference_id' => $tx->reference_id,
                'reference_number' => $referenceNumber,
                'description' => $tx->description,
                'creator_name' => $tx->creator?->name,
            ];
        }

        $currentPayable = $supplier->calculatePayable();

        return [
            'supplier' => [
                'id' => $supplier->id,
                'name' => $supplier->name,
                'phone' => $supplier->phone,
                'address' => $supplier->address,
                'is_active' => $supplier->is_active,
                'current_payable' => $currentPayable->toDecimal(),
                'current_payable_formatted' => $currentPayable->formattedArabic(),
                'is_settled' => $currentPayable->isZero(),
            ],
            'period' => [
                'from_date' => $fromDate?->format('Y-m-d'),
                'to_date' => $toDate?->format('Y-m-d'),
            ],
            'opening_balance' => $openingBalance->toDecimal(),
            'opening_balance_formatted' => $openingBalance->formattedArabic(),
            'period_summary' => [
                'total_credits' => $periodCredits->toDecimal(), // إجمالي التوريدات
                'total_debits' => $periodDebits->toDecimal(),   // إجمالي المسدد
                'net_change' => $periodCredits->subtract($periodDebits)->toDecimal(),
                'closing_balance' => $runningPayable->toDecimal(),
                'closing_balance_formatted' => $runningPayable->formattedArabic(),
                'transactions_count' => count($items),
            ],
            'transactions' => $items,
            'showroom' => [
                'name' => Setting::get('showroom_name', 'معرض العالمية للمفروشات'),
                'phone' => Setting::get('showroom_phone', '01012345678'),
                'address' => Setting::get('showroom_address', 'المنصورة'),
            ],
            'generated_at' => now()->format('Y-m-d H:i'),
        ];
    }
}
