<?php

namespace App\Http\Controllers\Api\V1\Catalog;

use App\Actions\Catalog\CreateProductAction;
use App\Actions\Catalog\ToggleProductStatusAction;
use App\Actions\Catalog\UpdateProductAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\CreateProductRequest;
use App\Http\Requests\Catalog\UpdateProductRequest;
use App\Http\Resources\Catalog\ProductResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Product::with('category');

        if ($request->filled('search')) {
            $search = trim($request->query('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('barcode', 'LIKE', "%{$search}%");
            });
        }

        if ($request->filled('category_id')) {
            $query->where('category_id', $request->query('category_id'));
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $perPage = min((int) $request->query('per_page', 25), 100);
        $products = $query->latest('id')->paginate($perPage);

        return ProductResource::collection($products);
    }

    public function show(Product $product): ProductResource
    {
        $product->load('category');

        return new ProductResource($product);
    }

    public function getByBarcode(string $barcode): ProductResource
    {
        $product = Product::with('category')
            ->where('barcode', trim($barcode))
            ->where('is_active', true)
            ->firstOrFail();

        return new ProductResource($product);
    }

    public function store(CreateProductRequest $request, CreateProductAction $action): JsonResponse
    {
        $product = $action->execute($request->validated(), $request->user());

        return (new ProductResource($product->load('category')))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateProductRequest $request, Product $product, UpdateProductAction $action): ProductResource
    {
        $updated = $action->execute($product, $request->validated(), $request->user());

        return new ProductResource($updated->load('category'));
    }

    public function toggleStatus(Request $request, Product $product, ToggleProductStatusAction $action): ProductResource
    {
        $status = $request->has('is_active') ? $request->boolean('is_active') : null;
        $updated = $action->execute($product, $status, $request->user());

        return new ProductResource($updated->load('category'));
    }
}
