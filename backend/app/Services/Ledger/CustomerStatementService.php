<?php

namespace App\Services\Ledger;

use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Support\Money;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\SalesReturn;
use App\Models\Setting;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CustomerStatementService
{
    /**
     * Build detailed chronological statement of account (كشف حساب عميل)
     * with running balance, period summaries, and resolved reference numbers.
     */
    public function getStatement(Customer $customer, Request $request): array
    {
        $fromDate = $request->filled('from_date') ? Carbon::parse($request->query('from_date'))->startOfDay() : null;
        $toDate = $request->filled('to_date') ? Carbon::parse($request->query('to_date'))->endOfDay() : null;

        // 1. Calculate opening balance (all transactions before $fromDate)
        $openingBalance = Money::zero();
        $openingDebits = Money::zero();
        $openingCredits = Money::zero();

        if ($fromDate) {
            $priorTransactions = $customer->transactions()
                ->where('created_at', '<', $fromDate)
                ->get();

            foreach ($priorTransactions as $pt) {
                if ($pt->direction === CustomerTransactionDirection::DEBIT) {
                    $openingDebits = $openingDebits->add($pt->amount);
                } else {
                    $openingCredits = $openingCredits->add($pt->amount);
                }
            }
            $openingBalance = $openingDebits->subtract($openingCredits);
        }

        // 2. Fetch transactions within range in chronological order
        $query = $customer->transactions()
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

        $runningBalance = $openingBalance;
        $periodDebits = Money::zero();
        $periodCredits = Money::zero();
        $items = [];

        foreach ($transactions as $tx) {
            $isDebit = ($tx->direction === CustomerTransactionDirection::DEBIT);
            $amount = $tx->amount;

            if ($isDebit) {
                $periodDebits = $periodDebits->add($amount);
                $runningBalance = $runningBalance->add($amount);
                $debitAmount = $amount->toDecimal();
                $creditAmount = '0.00';
            } else {
                $periodCredits = $periodCredits->add($amount);
                $runningBalance = $runningBalance->subtract($amount);
                $debitAmount = '0.00';
                $creditAmount = $amount->toDecimal();
            }

            // Resolve human-readable reference number
            $referenceNumber = null;
            if ($tx->reference) {
                if ($tx->reference instanceof Invoice) {
                    $referenceNumber = $tx->reference->invoice_number;
                } elseif ($tx->reference instanceof Payment) {
                    $referenceNumber = $tx->reference->payment_number;
                } elseif ($tx->reference instanceof SalesReturn) {
                    $referenceNumber = $tx->reference->return_number;
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
                'debit' => $debitAmount,
                'credit' => $creditAmount,
                'running_balance' => $runningBalance->toDecimal(),
                'running_balance_formatted' => $runningBalance->formattedArabic(),
                'reference_type' => $tx->reference_type,
                'reference_id' => $tx->reference_id,
                'reference_number' => $referenceNumber,
                'description' => $tx->description,
                'creator_name' => $tx->creator?->name,
            ];
        }

        $currentAccountBalance = $customer->calculateBalance();

        return [
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'address' => $customer->address,
                'is_active' => $customer->is_active,
                'current_balance' => $currentAccountBalance->toDecimal(),
                'current_balance_formatted' => $currentAccountBalance->formattedArabic(),
            ],
            'period' => [
                'from_date' => $fromDate?->format('Y-m-d'),
                'to_date' => $toDate?->format('Y-m-d'),
            ],
            'opening_balance' => $openingBalance->toDecimal(),
            'opening_balance_formatted' => $openingBalance->formattedArabic(),
            'period_summary' => [
                'total_debits' => $periodDebits->toDecimal(),
                'total_credits' => $periodCredits->toDecimal(),
                'net_change' => $periodDebits->subtract($periodCredits)->toDecimal(),
                'closing_balance' => $runningBalance->toDecimal(),
                'closing_balance_formatted' => $runningBalance->formattedArabic(),
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
