<?php

namespace App\Http\Controllers\Api\V1\Suppliers;

use App\Actions\Suppliers\AddSupplierBalanceAction;
use App\Actions\Suppliers\CreateSupplierAction;
use App\Actions\Suppliers\ToggleSupplierStatusAction;
use App\Actions\Suppliers\UpdateSupplierAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Suppliers\AddSupplierBalanceRequest;
use App\Http\Requests\Suppliers\SupplierRequest;
use App\Http\Resources\Suppliers\SupplierResource;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class SupplierController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Supplier::query();

        if ($request->filled('search')) {
            $search = trim($request->query('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('phone', 'LIKE', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = min((int) $request->query('per_page', 25), 100);
        $suppliers = $query->latest('id')->paginate($perPage);

        return SupplierResource::collection($suppliers);
    }

    public function show(Supplier $supplier): SupplierResource
    {
        return new SupplierResource($supplier);
    }

    public function store(SupplierRequest $request, CreateSupplierAction $action): JsonResponse
    {
        $supplier = $action->execute($request->validated(), $request->user());

        return (new SupplierResource($supplier))
            ->response()
            ->setStatusCode(201);
    }

    public function update(SupplierRequest $request, Supplier $supplier, UpdateSupplierAction $action): SupplierResource
    {
        $updated = $action->execute($supplier, $request->validated(), $request->user());

        return new SupplierResource($updated);
    }

    public function toggleStatus(Request $request, Supplier $supplier, ToggleSupplierStatusAction $action): SupplierResource
    {
        $status = $request->has('is_active') ? $request->boolean('is_active') : null;
        $updated = $action->execute($supplier, $status, $request->user());

        return new SupplierResource($updated);
    }

    public function addBalance(AddSupplierBalanceRequest $request, Supplier $supplier, AddSupplierBalanceAction $action): JsonResponse
    {
        $transaction = $action->execute($supplier, $request->validated(), $request->user());

        return response()->json([
            'message' => 'تم إضافة الرصيد بنجاح لحساب المورد.',
            'supplier' => new SupplierResource($supplier->fresh()),
            'transaction_id' => $transaction->id,
        ], 201);
    }
}
