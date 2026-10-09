<?php

namespace App\Services\Reports;

use App\Domain\Suppliers\Enums\SupplierTransactionDirection;
use App\Domain\Support\Money;
use App\Models\Supplier;

class SupplierReportService
{
    /**
     * Compute authoritative supplier payable balances from the transaction ledger.
     */
    public function getSummary(
        ?string $filter = null,
        ?string $search = null,
        ?int $page = null,
        ?int $perPage = null
    ): array {
        $suppliers = Supplier::with(['transactions'])
            ->orderBy('name')
            ->get();

        $totalPayablesOwed = Money::zero();
        $totalOverpayments = Money::zero();
        $totalCreditsAll = Money::zero();
        $totalDebitsAll = Money::zero();

        $withPayableCount = 0;
        $overpaidCount = 0;
        $settledCount = 0;

        $supplierRows = [];

        foreach ($suppliers as $supplier) {
            $credits = Money::zero();
            $debits = Money::zero();

            foreach ($supplier->transactions as $tx) {
                if ($tx->direction === SupplierTransactionDirection::CREDIT) {
                    $credits = $credits->add($tx->amount);
                    $totalCreditsAll = $totalCreditsAll->add($tx->amount);
                } else {
                    $debits = $debits->add($tx->amount);
                    $totalDebitsAll = $totalDebitsAll->add($tx->amount);
                }
            }

            // Payable = Credits (Incurred) - Debits (Paid)
            $payable = $credits->subtract($debits);

            if ($payable->isPositive()) {
                $totalPayablesOwed = $totalPayablesOwed->add($payable);
                $withPayableCount++;
                $status = 'payable'; // مستحق للمورد (فلوس له على المعرض)
            } elseif ($payable->isNegative()) {
                $totalOverpayments = $totalOverpayments->add($payable->abs());
                $overpaidCount++;
                $status = 'overpaid'; // مدفوع مقدماً
            } else {
                $settledCount++;
                $status = 'settled'; // مصفى بالكامل
            }

            if ($filter === 'with_payable' && $status !== 'payable') {
                continue;
            }
            if ($filter === 'overpaid' && $status !== 'overpaid') {
                continue;
            }
            if ($filter === 'settled' && $status !== 'settled') {
                continue;
            }

            if ($search) {
                $normalizedSearch = mb_strtolower(trim($search));
                $nameMatches = str_contains(mb_strtolower($supplier->name), $normalizedSearch);
                $phoneMatches = $supplier->phone && str_contains($supplier->phone, $normalizedSearch);

                if (! $nameMatches && ! $phoneMatches) {
                    continue;
                }
            }

            $supplierRows[] = [
                'id' => $supplier->id,
                'name' => $supplier->name,
                'phone' => $supplier->phone,
                'is_active' => $supplier->is_active,
                'total_purchases_credits' => $credits->toDecimal(),
                'total_payments_debits' => $debits->toDecimal(),
                'payable_balance' => $payable->toDecimal(),
                'status' => $status,
                'transactions_count' => $supplier->transactions->count(),
            ];
        }

        $netPayableAll = $totalCreditsAll->subtract($totalDebitsAll);
        $totalFiltered = count($supplierRows);

        $result = [
            'total_payables_owed' => $totalPayablesOwed->toDecimal(),
            'total_overpayments' => $totalOverpayments->toDecimal(),
            'net_supplier_payable' => $netPayableAll->toDecimal(),
            'total_suppliers_count' => $suppliers->count(),
            'with_payable_count' => $withPayableCount,
            'overpaid_count' => $overpaidCount,
            'settled_count' => $settledCount,
            'suppliers' => $supplierRows,
            'manual_adjustment_notice' => 'وفقاً لدستور المشروع، فإن التسويات اليدوية لأرصدة الموردين هي قيود محاسبية دفترية بحتة ولا تُنشئ أي حركة مخزنية أو تؤثر على رصيد المخزن.',
        ];

        // Paginate if requested
        if ($perPage !== null && $perPage > 0) {
            $currentPage = max(1, $page ?? 1);
            $offset = ($currentPage - 1) * $perPage;
            $paginatedItems = array_slice($supplierRows, $offset, $perPage);

            $result['suppliers'] = $paginatedItems;
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
