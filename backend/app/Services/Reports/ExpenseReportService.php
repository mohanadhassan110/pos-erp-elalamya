<?php

namespace App\Services\Reports;

use App\Domain\Support\Money;
use App\Models\Expense;
use Carbon\Carbon;

class ExpenseReportService
{
    /**
     * Compute operating expenses summary and category breakdown.
     */
    public function getSummary(
        string $startDate,
        string $endDate,
        ?int $categoryId = null,
        ?int $paymentMethodId = null,
        ?string $search = null
    ): array {
        $startDateTime = Carbon::parse($startDate)->startOfDay()->toDateTimeString();
        $endDateTime = Carbon::parse($endDate)->endOfDay()->toDateTimeString();

        $query = Expense::where(function ($q) use ($startDate, $endDate, $startDateTime, $endDateTime) {
            $q->whereBetween('expense_date', [$startDate, $endDate])
                ->orWhereBetween('expense_date', [$startDateTime, $endDateTime])
                ->orWhere(function ($sq) use ($startDate, $endDate) {
                    $sq->whereDate('expense_date', '>=', $startDate)
                        ->whereDate('expense_date', '<=', $endDate);
                });
        })
            ->with(['expenseCategory', 'paymentMethod'])
            ->orderBy('expense_date', 'desc')
            ->orderBy('id', 'desc');

        if ($categoryId) {
            $query->where('expense_category_id', $categoryId);
        }

        if ($paymentMethodId) {
            $query->where('payment_method_id', $paymentMethodId);
        }

        if ($search) {
            $query->where('description', 'like', "%{$search}%");
        }

        $expenses = $query->get();

        $totalExpenses = Money::zero();
        $generalExpenses = Money::zero();
        $externalProductExpenses = Money::zero();

        $categoryMap = [];
        $paymentMethodMap = [];
        $itemsList = [];

        foreach ($expenses as $exp) {
            $amount = $exp->amount;
            $totalExpenses = $totalExpenses->add($amount);

            $catCode = $exp->expenseCategory?->code;
            $catName = $exp->expenseCategory?->name ?? 'غير محدد';
            $isExternal = ($catCode === 'external_product');

            if ($isExternal) {
                $externalProductExpenses = $externalProductExpenses->add($amount);
            } else {
                $generalExpenses = $generalExpenses->add($amount);
            }

            // Category breakdown
            if (! isset($categoryMap[$catName])) {
                $categoryMap[$catName] = [
                    'category_name' => $catName,
                    'code' => $catCode,
                    'is_external_product' => $isExternal,
                    'total_amount' => Money::zero(),
                    'count' => 0,
                ];
            }
            $categoryMap[$catName]['total_amount'] = $categoryMap[$catName]['total_amount']->add($amount);
            $categoryMap[$catName]['count']++;

            // Payment method breakdown
            $pmName = $exp->paymentMethod?->name ?? 'نقدي / عام';
            $pmCode = $exp->paymentMethod?->code ?? 'unknown';
            $isCash = (bool) ($exp->paymentMethod?->is_cash ?? false);

            if (! isset($paymentMethodMap[$pmName])) {
                $paymentMethodMap[$pmName] = [
                    'payment_method_name' => $pmName,
                    'code' => $pmCode,
                    'is_cash' => $isCash,
                    'total_amount' => Money::zero(),
                    'count' => 0,
                ];
            }
            $paymentMethodMap[$pmName]['total_amount'] = $paymentMethodMap[$pmName]['total_amount']->add($amount);
            $paymentMethodMap[$pmName]['count']++;

            $itemsList[] = [
                'id' => $exp->id,
                'expense_date' => $exp->expense_date->format('Y-m-d'),
                'category_name' => $catName,
                'is_external_product' => $isExternal,
                'payment_method_name' => $pmName,
                'amount' => $amount->toDecimal(),
                'description' => $exp->description,
                'reference_type' => $exp->reference_type,
            ];
        }

        $formattedCategories = [];
        foreach ($categoryMap as $cat) {
            $formattedCategories[] = [
                'category_name' => $cat['category_name'],
                'code' => $cat['code'],
                'is_external_product' => $cat['is_external_product'],
                'total_amount' => $cat['total_amount']->toDecimal(),
                'count' => $cat['count'],
            ];
        }

        $formattedPaymentMethods = [];
        foreach ($paymentMethodMap as $pm) {
            $formattedPaymentMethods[] = [
                'payment_method_name' => $pm['payment_method_name'],
                'code' => $pm['code'],
                'is_cash' => $pm['is_cash'],
                'total_amount' => $pm['total_amount']->toDecimal(),
                'count' => $pm['count'],
            ];
        }

        return [
            'total_expenses' => $totalExpenses->toDecimal(),
            'general_expenses' => $generalExpenses->toDecimal(),
            'external_product_expenses' => $externalProductExpenses->toDecimal(),
            'expenses_count' => $expenses->count(),

            // Support both keys for frontend and backend API compatibility
            'categories' => $formattedCategories,
            'categories_breakdown' => $formattedCategories,
            'payment_methods' => $formattedPaymentMethods,
            'payment_methods_breakdown' => $formattedPaymentMethods,
            'items' => $itemsList,
            'expenses_list' => $itemsList,

            'policy_c_notice' => 'وفقاً للسياسة C المعتمدة، فإن تكاليف المنتجات الخارجية تظل مقيدة كمصروفات مثبتة ولا تُحذف أو تُلغى تلقائياً عند مرتجع العميل ما لم يتوفر استرداد نقدي فعلي وموثق من التاجر الخارجي.',
        ];
    }
}
