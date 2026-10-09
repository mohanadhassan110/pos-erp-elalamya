<?php

namespace App\Http\Controllers\Api\V1\Returns;

use App\Actions\Returns\CreateSalesReturnAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Returns\CreateSalesReturnRequest;
use App\Http\Resources\Returns\ReturnableInvoiceResource;
use App\Http\Resources\Returns\SalesReturnResource;
use App\Models\Invoice;
use App\Models\SalesReturn;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SalesReturnController extends Controller
{
    /**
     * List returns with pagination and filters.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = SalesReturn::with(['customer', 'creator', 'invoice', 'replacementInvoice']);

        if ($request->filled('search')) {
            $search = trim($request->query('search'));
            $query->where(function ($q) use ($search) {
                $q->where('return_number', 'LIKE', "%{$search}%")
                    ->orWhereHas('invoice', function ($iq) use ($search) {
                        $iq->where('invoice_number', 'LIKE', "%{$search}%");
                    })
                    ->orWhereHas('customer', function ($cq) use ($search) {
                        $cq->where('name', 'LIKE', "%{$search}%")
                            ->orWhere('phone', 'LIKE', "%{$search}%");
                    });
            });
        }

        if ($request->filled('resolution')) {
            $query->where('resolution', $request->query('resolution'));
        }

        if ($request->filled('customer_id')) {
            $query->where('customer_id', $request->query('customer_id'));
        }

        if ($request->filled('from_date')) {
            $query->whereDate('created_at', '>=', $request->query('from_date'));
        }

        if ($request->filled('to_date')) {
            $query->whereDate('created_at', '<=', $request->query('to_date'));
        }

        $perPage = min((int) $request->query('per_page', 25), 100);
        $returns = $query->latest('id')->paginate($perPage);

        return SalesReturnResource::collection($returns);
    }

    /**
     * Search and retrieve an invoice for return processing.
     */
    public function searchInvoice(Request $request): JsonResponse
    {
        $search = trim($request->query('query', $request->query('invoice_number', '')));

        if (empty($search)) {
            return response()->json([
                'message' => 'يرجى إدخال رقم الفاتورة للبحث.',
            ], 422);
        }

        $invoice = Invoice::where('invoice_number', $search)
            ->with(['customer', 'items.returnItems', 'items.product'])
            ->first();

        if (! $invoice) {
            return response()->json([
                'message' => 'لم يتم العثور على فاتورة مبيعات بهذا الرقم.',
            ], 404);
        }

        return response()->json([
            'data' => new ReturnableInvoiceResource($invoice),
        ]);
    }

    /**
     * Get returnable items for a specific invoice.
     */
    public function getReturnableInvoice(Invoice $invoice): JsonResponse
    {
        $invoice->load(['customer', 'items.returnItems', 'items.product']);

        return response()->json([
            'data' => new ReturnableInvoiceResource($invoice),
        ]);
    }

    /**
     * Store a new sales return or exchange.
     */
    public function store(CreateSalesReturnRequest $request, CreateSalesReturnAction $action): JsonResponse
    {
        $salesReturn = $action->execute($request->validated(), $request->user());

        $statusCode = $salesReturn->wasRecentlyCreated ? 201 : 200;

        return (new SalesReturnResource($salesReturn))
            ->response()
            ->setStatusCode($statusCode);
    }

    /**
     * Display a specific sales return.
     */
    public function show(SalesReturn $salesReturn): SalesReturnResource
    {
        $salesReturn->load([
            'items.product',
            'items.invoiceItem',
            'invoice',
            'customer',
            'replacementInvoice.items',
            'creator',
        ]);

        return new SalesReturnResource($salesReturn);
    }
}
