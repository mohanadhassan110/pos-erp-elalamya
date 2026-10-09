<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Domain\Support\Money;
use App\Http\Controllers\Controller;
use App\Http\Resources\Inventory\InventoryItemResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function index(Request $request): JsonResponse
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

        if ($request->filled('stock_status')) {
            $status = $request->query('stock_status');
            if ($status === 'in_stock') {
                $query->where('stock_quantity', '>', 0);
            } elseif ($status === 'out_of_stock') {
                $query->where('stock_quantity', '<=', 0);
            }
        }

        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->query('is_active'), FILTER_VALIDATE_BOOLEAN));
        }

        // Calculate summary valuation across matching products
        $matchingProducts = (clone $query)->get();
        $totalValuation = Money::zero();
        $totalQuantity = 0;

        foreach ($matchingProducts as $p) {
            $totalValuation = $totalValuation->add($p->currentStockValuation());
            $totalQuantity += $p->stock_quantity->toInt();
        }

        $perPage = min((int) $request->query('per_page', 25), 100);
        $paginated = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'data' => InventoryItemResource::collection($paginated),
            'summary' => [
                'total_quantity' => $totalQuantity,
                'total_valuation' => $totalValuation->toDecimal(),
                'total_valuation_formatted' => $totalValuation->formattedArabic(),
            ],
            'meta' => [
                'current_page' => $paginated->currentPage(),
                'last_page' => $paginated->lastPage(),
                'per_page' => $paginated->perPage(),
                'total' => $paginated->total(),
            ],
        ]);
    }
}
