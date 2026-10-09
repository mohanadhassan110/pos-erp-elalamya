<?php

namespace App\Http\Controllers\Api\V1\Purchasing;

use App\Actions\Purchasing\ReceiveStockAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Purchasing\ReceiveStockRequest;
use App\Http\Resources\Purchasing\StockReceiptResource;
use App\Models\StockReceipt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class StockReceiptController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = StockReceipt::with(['supplier', 'creator']);

        if ($request->filled('search')) {
            $search = trim($request->query('search'));
            $query->where('receipt_number', 'LIKE', "%{$search}%");
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->query('supplier_id'));
        }

        if ($request->filled('from_date')) {
            $query->whereDate('received_date', '>=', $request->query('from_date'));
        }

        if ($request->filled('to_date')) {
            $query->whereDate('received_date', '<=', $request->query('to_date'));
        }

        $perPage = min((int) $request->query('per_page', 25), 100);
        $receipts = $query->latest('id')->paginate($perPage);

        return StockReceiptResource::collection($receipts);
    }

    public function show(StockReceipt $stockReceipt): StockReceiptResource
    {
        $stockReceipt->load(['supplier', 'items.product', 'creator']);

        return new StockReceiptResource($stockReceipt);
    }

    public function store(ReceiveStockRequest $request, ReceiveStockAction $action): JsonResponse
    {
        $receipt = $action->execute($request->validated(), $request->user());

        return (new StockReceiptResource($receipt))
            ->response()
            ->setStatusCode(201);
    }
}
