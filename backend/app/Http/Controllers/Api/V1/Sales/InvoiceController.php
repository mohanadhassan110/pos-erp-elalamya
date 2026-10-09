<?php

namespace App\Http\Controllers\Api\V1\Sales;

use App\Actions\Sales\CreateInvoiceAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sales\CreateInvoiceRequest;
use App\Http\Resources\Sales\InvoicePrintResource;
use App\Http\Resources\Sales\InvoiceResource;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class InvoiceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Invoice::with(['customer', 'creator', 'payments.paymentMethod']);

        if ($request->filled('search')) {
            $search = trim($request->query('search'));
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'LIKE', "%{$search}%")
                    ->orWhereHas('customer', function ($cq) use ($search) {
                        $cq->where('name', 'LIKE', "%{$search}%")
                            ->orWhere('phone', 'LIKE', "%{$search}%");
                    });
            });
        }

        if ($request->filled('sale_type')) {
            $query->where('sale_type', $request->query('sale_type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
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
        $invoices = $query->latest('id')->paginate($perPage);

        return InvoiceResource::collection($invoices);
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        $invoice->load(['items.product.category', 'payments.paymentMethod', 'customer', 'creator']);

        return new InvoiceResource($invoice);
    }

    public function print(Invoice $invoice): InvoicePrintResource
    {
        $invoice->load(['items', 'payments.paymentMethod', 'customer', 'creator']);

        return new InvoicePrintResource($invoice);
    }

    public function store(CreateInvoiceRequest $request, CreateInvoiceAction $action): JsonResponse
    {
        $invoice = $action->execute($request->validated(), $request->user());

        $statusCode = $invoice->wasRecentlyCreated ? 201 : 200;

        return (new InvoiceResource($invoice))
            ->response()
            ->setStatusCode($statusCode);
    }
}
