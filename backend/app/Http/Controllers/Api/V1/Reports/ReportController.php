<?php

namespace App\Http\Controllers\Api\V1\Reports;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reports\ReportDateFilterRequest;
use App\Models\Invoice;
use App\Models\SalesReturn;
use App\Services\Reports\CustomerReportService;
use App\Services\Reports\ExpenseReportService;
use App\Services\Reports\InventoryReportService;
use App\Services\Reports\PaymentReportService;
use App\Services\Reports\ReportSummaryService;
use App\Services\Reports\SalesReportService;
use App\Services\Reports\SupplierReportService;
use App\Support\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(
        protected ReportSummaryService $summaryService,
        protected SalesReportService $salesService,
        protected ExpenseReportService $expenseService,
        protected CustomerReportService $customerService,
        protected SupplierReportService $supplierService,
        protected InventoryReportService $inventoryService,
        protected PaymentReportService $paymentService
    ) {}

    /**
     * High-level financial and operational summary (Dashboard KPIs).
     */
    public function overview(ReportDateFilterRequest $request): JsonResponse
    {
        $range = $request->resolveDateRange();

        $data = $this->summaryService->getOverview(
            $range['start_utc'],
            $range['end_utc'],
            $range['start_date'],
            $range['end_date'],
            $range['period']
        );

        return ApiResponse::success($data, 'تم جلب ملخص مؤشرات الأداء بنجاح');
    }

    /**
     * Sales revenue, returns, and realized gross profit report.
     */
    public function sales(ReportDateFilterRequest $request): JsonResponse
    {
        $range = $request->resolveDateRange();

        $summary = $this->salesService->getSummary($range['start_utc'], $range['end_utc']);
        $profit = $this->salesService->getRealizedProfit($range['start_utc'], $range['end_utc']);

        $data = [
            'period' => $range['period'],
            'start_date' => $range['start_date'],
            'end_date' => $range['end_date'],
            'sales_summary' => $summary,
            'profit_analysis' => $profit,
        ];

        return ApiResponse::success($data, 'تم جلب تقرير المبيعات والأرباح بنجاح');
    }

    /**
     * Dedicated profit and Cost of Goods Sold report.
     */
    public function profit(ReportDateFilterRequest $request): JsonResponse
    {
        $range = $request->resolveDateRange();

        $data = $this->salesService->getProfitReport(
            $range['start_utc'],
            $range['end_utc'],
            $range['start_date'],
            $range['end_date'],
            $range['period'],
            $this->expenseService
        );

        return ApiResponse::success($data, 'تم جلب تقرير الأرباح وتكلفة المبيعات بنجاح');
    }

    /**
     * Operating expenses report.
     */
    public function expenses(ReportDateFilterRequest $request): JsonResponse
    {
        $range = $request->resolveDateRange();
        $categoryId = $request->query('category_id') ? (int) $request->query('category_id') : null;
        $paymentMethodId = $request->query('payment_method_id') ? (int) $request->query('payment_method_id') : null;
        $search = $request->query('search') ? trim($request->query('search')) : null;

        $summary = $this->expenseService->getSummary(
            $range['start_date'],
            $range['end_date'],
            $categoryId,
            $paymentMethodId,
            $search
        );

        $data = array_merge([
            'period' => $range['period'],
            'start_date' => $range['start_date'],
            'end_date' => $range['end_date'],
        ], $summary);

        return ApiResponse::success($data, 'تم جلب تقرير المصروفات بنجاح');
    }

    /**
     * Customer debts and ledger balances report.
     */
    public function customers(Request $request): JsonResponse
    {
        $filter = $request->query('filter'); // null, 'debtors', 'creditors', 'settled'
        $search = $request->query('search') ? trim($request->query('search')) : null;
        $page = $request->query('page') ? (int) $request->query('page') : null;
        $perPage = $request->query('per_page') ? (int) $request->query('per_page') : null;

        $data = $this->customerService->getSummary($filter, $search, $page, $perPage);

        return ApiResponse::success($data, 'تم جلب تقرير مديونيات وحسابات العملاء بنجاح');
    }

    /**
     * Customer balances endpoint alias.
     */
    public function customerBalances(Request $request): JsonResponse
    {
        return $this->customers($request);
    }

    /**
     * Supplier payables and ledger balances report.
     */
    public function suppliers(Request $request): JsonResponse
    {
        $filter = $request->query('filter'); // null, 'with_payable', 'overpaid', 'settled'
        $search = $request->query('search') ? trim($request->query('search')) : null;
        $page = $request->query('page') ? (int) $request->query('page') : null;
        $perPage = $request->query('per_page') ? (int) $request->query('per_page') : null;

        $data = $this->supplierService->getSummary($filter, $search, $page, $perPage);

        return ApiResponse::success($data, 'تم جلب تقرير مستحقات وحسابات الموردين بنجاح');
    }

    /**
     * Supplier payables endpoint alias.
     */
    public function supplierPayables(Request $request): JsonResponse
    {
        return $this->suppliers($request);
    }

    /**
     * Showroom inventory valuation report.
     */
    public function inventory(Request $request): JsonResponse
    {
        $categoryId = $request->query('category_id') ? (int) $request->query('category_id') : null;
        $search = $request->query('search') ? trim($request->query('search')) : null;
        $status = $request->query('status') ? trim($request->query('status')) : null;
        $page = $request->query('page') ? (int) $request->query('page') : null;
        $perPage = $request->query('per_page') ? (int) $request->query('per_page') : null;

        $data = $this->inventoryService->getSummary($categoryId, $search, $status, $page, $perPage);

        return ApiResponse::success($data, 'تم جلب تقرير تقييم المخزون بنجاح');
    }

    /**
     * Inventory valuation endpoint alias.
     */
    public function inventoryValuation(Request $request): JsonResponse
    {
        return $this->inventory($request);
    }

    /**
     * Payment methods breakdown and cash flow movement report.
     */
    public function payments(ReportDateFilterRequest $request): JsonResponse
    {
        $range = $request->resolveDateRange();

        $summary = $this->paymentService->getSummary($range['start_utc'], $range['end_utc']);

        $data = array_merge([
            'period' => $range['period'],
            'start_date' => $range['start_date'],
            'end_date' => $range['end_date'],
        ], $summary);

        return ApiResponse::success($data, 'تم جلب تقرير حركة وطرق الدفع بنجاح');
    }

    /**
     * Payment movements endpoint alias.
     */
    public function paymentMovements(ReportDateFilterRequest $request): JsonResponse
    {
        return $this->payments($request);
    }

    /**
     * Unified documents history endpoint (invoices and sales returns).
     */
    public function documents(Request $request): JsonResponse
    {
        $type = $request->query('type', 'invoices');

        if ($type === 'returns') {
            return $this->returnsHistory($request);
        }

        return $this->invoicesHistory($request);
    }

    /**
     * Invoices history list with filters and pagination.
     */
    public function invoicesHistory(Request $request): JsonResponse
    {
        $query = Invoice::with(['customer', 'items'])
            ->orderBy('id', 'desc');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($saleType = $request->query('sale_type')) {
            $query->where('sale_type', $saleType);
        }

        if ($fromDate = $request->query('from_date')) {
            $startUtc = Carbon::parse($fromDate, 'Africa/Cairo')->startOfDay()->utc();
            $query->where('created_at', '>=', $startUtc);
        }

        if ($toDate = $request->query('to_date')) {
            $endUtc = Carbon::parse($toDate, 'Africa/Cairo')->endOfDay()->utc();
            $query->where('created_at', '<=', $endUtc);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhereHas('customer', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = min(max((int) $request->query('per_page', 15), 5), 100);
        $paginated = $query->paginate($perPage);

        $items = collect($paginated->items())->map(function (Invoice $inv) {
            return [
                'id' => $inv->id,
                'invoice_number' => $inv->invoice_number,
                'created_at' => $inv->created_at?->format('Y-m-d H:i'),
                'customer_name' => $inv->customer?->name ?? 'عميل نقدي / عام',
                'sale_type' => $inv->sale_type->value,
                'sale_type_label' => $inv->sale_type->label(),
                'status' => $inv->status->value,
                'status_label' => $inv->status->label(),
                'total' => $inv->total->toDecimal(),
                'paid_amount' => $inv->paid_amount->toDecimal(),
                'remaining_amount' => $inv->remaining_amount->toDecimal(),
                'items_count' => $inv->items->count(),
            ];
        });

        return ApiResponse::success([
            'items' => $items,
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ], 'تم جلب سجل الفواتير بنجاح');
    }

    /**
     * Sales returns history list with filters and pagination.
     */
    public function returnsHistory(Request $request): JsonResponse
    {
        $query = SalesReturn::with(['customer', 'invoice', 'items'])
            ->orderBy('id', 'desc');

        if ($resolution = $request->query('resolution')) {
            $query->where('resolution', $resolution);
        }

        if ($fromDate = $request->query('from_date')) {
            $startUtc = Carbon::parse($fromDate, 'Africa/Cairo')->startOfDay()->utc();
            $query->where('created_at', '>=', $startUtc);
        }

        if ($toDate = $request->query('to_date')) {
            $endUtc = Carbon::parse($toDate, 'Africa/Cairo')->endOfDay()->utc();
            $query->where('created_at', '<=', $endUtc);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('return_number', 'like', "%{$search}%")
                    ->orWhereHas('invoice', function ($iq) use ($search) {
                        $iq->where('invoice_number', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = min(max((int) $request->query('per_page', 15), 5), 100);
        $paginated = $query->paginate($perPage);

        $items = collect($paginated->items())->map(function (SalesReturn $ret) {
            return [
                'id' => $ret->id,
                'return_number' => $ret->return_number,
                'created_at' => $ret->created_at?->format('Y-m-d H:i'),
                'invoice_number' => $ret->invoice?->invoice_number,
                'customer_name' => $ret->customer?->name ?? 'عميل نقدي / عام',
                'resolution' => $ret->resolution->value,
                'resolution_label' => $ret->resolution->label(),
                'total_return_amount' => $ret->total_return_amount->toDecimal(),
                'difference_amount' => $ret->difference_amount->toDecimal(),
                'items_count' => $ret->items->count(),
            ];
        });

        return ApiResponse::success([
            'items' => $items,
            'pagination' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ], 'تم جلب سجل المرتجعات بنجاح');
    }
}
