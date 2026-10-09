<?php

namespace App\Http\Controllers\Api\V1\Catalog;

use App\Actions\Catalog\CreateCategoryAction;
use App\Actions\Catalog\ToggleCategoryStatusAction;
use App\Actions\Catalog\UpdateCategoryAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\CategoryRequest;
use App\Http\Resources\Catalog\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class CategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Category::withCount('products');

        if ($request->filled('search')) {
            $search = trim($request->query('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'LIKE', "%{$search}%")
                    ->orWhere('code', 'LIKE', "%{$search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        $categories = $query->orderBy('name')->get();

        return CategoryResource::collection($categories);
    }

    public function show(Category $category): CategoryResource
    {
        $category->loadCount('products');

        return new CategoryResource($category);
    }

    public function store(CategoryRequest $request, CreateCategoryAction $action): JsonResponse
    {
        $category = $action->execute($request->validated(), $request->user());

        return (new CategoryResource($category))
            ->response()
            ->setStatusCode(201);
    }

    public function update(CategoryRequest $request, Category $category, UpdateCategoryAction $action): CategoryResource
    {
        $updated = $action->execute($category, $request->validated(), $request->user());

        return new CategoryResource($updated);
    }

    public function toggleStatus(Request $request, Category $category, ToggleCategoryStatusAction $action): CategoryResource
    {
        $status = $request->has('is_active') ? $request->boolean('is_active') : null;
        $updated = $action->execute($category, $status, $request->user());

        return new CategoryResource($updated);
    }
}
