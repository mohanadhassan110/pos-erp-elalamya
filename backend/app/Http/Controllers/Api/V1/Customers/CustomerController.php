<?php

namespace App\Http\Controllers\Api\V1\Customers;

use App\Actions\Customers\CreateCustomerAction;
use App\Actions\Customers\ToggleCustomerStatusAction;
use App\Actions\Customers\UpdateCustomerAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Customers\CustomerRequest;
use App\Http\Resources\Customers\CustomerResource;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CustomerController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Customer::query();

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
        $customers = $query->latest('id')->paginate($perPage);

        return CustomerResource::collection($customers);
    }

    public function show(Customer $customer): CustomerResource
    {
        return new CustomerResource($customer);
    }

    public function store(CustomerRequest $request, CreateCustomerAction $action): JsonResponse
    {
        $customer = $action->execute($request->validated(), $request->user());

        return (new CustomerResource($customer))
            ->response()
            ->setStatusCode(201);
    }

    public function update(CustomerRequest $request, Customer $customer, UpdateCustomerAction $action): CustomerResource
    {
        $updated = $action->execute($customer, $request->validated(), $request->user());

        return new CustomerResource($updated);
    }

    public function toggleStatus(Request $request, Customer $customer, ToggleCustomerStatusAction $action): CustomerResource
    {
        $status = $request->has('is_active') ? $request->boolean('is_active') : null;
        $updated = $action->execute($customer, $status, $request->user());

        return new CustomerResource($updated);
    }
}
