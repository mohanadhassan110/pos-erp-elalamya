<?php

namespace App\Services\Reports;

use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Support\Money;
use App\Models\Customer;

class CustomerReportService
{
    /**
     * Compute authoritative customer debt and credit balances from the transaction ledger.
     */
    public function getSummary(
        ?string $filter = null,
        ?string $search = null,
        ?int $page = null,
        ?int $perPage = null
    ): array {
        $customers = Customer::with(['transactions'])
            ->orderBy('name')
            ->get();

        $totalReceivableDebts = Money::zero();
        $totalCustomerCredits = Money::zero();
        $totalDebitsAll = Money::zero();
        $totalCreditsAll = Money::zero();

        $debtorsCount = 0;
        $creditorsCount = 0;
        $settledCount = 0;

        $customerRows = [];

        foreach ($customers as $customer) {
            $debits = Money::zero();
            $credits = Money::zero();

            foreach ($customer->transactions as $tx) {
                if ($tx->direction === CustomerTransactionDirection::DEBIT) {
                    $debits = $debits->add($tx->amount);
                    $totalDebitsAll = $totalDebitsAll->add($tx->amount);
                } else {
                    $credits = $credits->add($tx->amount);
                    $totalCreditsAll = $totalCreditsAll->add($tx->amount);
                }
            }

            // Balance = Debits - Credits (Positive = customer owes showroom, Negative = customer credit)
            $balance = $debits->subtract($credits);

            if ($balance->isPositive()) {
                $totalReceivableDebts = $totalReceivableDebts->add($balance);
                $debtorsCount++;
                $status = 'debtor'; // مدين (عليه فلوس للمعرض)
            } elseif ($balance->isNegative()) {
                $totalCustomerCredits = $totalCustomerCredits->add($balance->abs());
                $creditorsCount++;
                $status = 'creditor'; // دائن (له رصيد عند المعرض)
            } else {
                $settledCount++;
                $status = 'settled'; // خالص / رصيد صفر
            }

            // Filter status if specified
            if ($filter === 'debtors' && $status !== 'debtor') {
                continue;
            }
            if ($filter === 'creditors' && $status !== 'creditor') {
                continue;
            }
            if ($filter === 'settled' && $status !== 'settled') {
                continue;
            }

            // Filter search (name or phone)
            if ($search) {
                $normalizedSearch = mb_strtolower(trim($search));
                $nameMatches = str_contains(mb_strtolower($customer->name), $normalizedSearch);
                $phoneMatches = $customer->phone && str_contains($customer->phone, $normalizedSearch);

                if (! $nameMatches && ! $phoneMatches) {
                    continue;
                }
            }

            $customerRows[] = [
                'id' => $customer->id,
                'name' => $customer->name,
                'phone' => $customer->phone,
                'is_active' => $customer->is_active,
                'total_debits' => $debits->toDecimal(),
                'total_credits' => $credits->toDecimal(),
                'balance' => $balance->toDecimal(),
                'status' => $status,
                'transactions_count' => $customer->transactions->count(),
            ];
        }

        $netLedgerBalance = $totalDebitsAll->subtract($totalCreditsAll);
        $totalFiltered = count($customerRows);

        $result = [
            'total_receivable_debts' => $totalReceivableDebts->toDecimal(),
            'total_customer_credits' => $totalCustomerCredits->toDecimal(),
            'net_ledger_balance' => $netLedgerBalance->toDecimal(),
            'total_customers_count' => $customers->count(),
            'debtors_count' => $debtorsCount,
            'creditors_count' => $creditorsCount,
            'settled_count' => $settledCount,
            'customers' => $customerRows,
        ];

        // Paginate if requested
        if ($perPage !== null && $perPage > 0) {
            $currentPage = max(1, $page ?? 1);
            $offset = ($currentPage - 1) * $perPage;
            $paginatedItems = array_slice($customerRows, $offset, $perPage);

            $result['customers'] = $paginatedItems;
            $result['pagination'] = [
                'current_page' => $currentPage,
                'last_page' => (int) ceil($totalFiltered / $perPage),
                'per_page' => $perPage,
                'total' => $totalFiltered,
            ];
        }

        return $result;
    }
}
