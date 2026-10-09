<?php

namespace App\Services\Reports;

use App\Domain\Support\Money;
use App\Models\Product;

class InventoryReportService
{
    /**
     * Compute current inventory valuation and category breakdown.
     */
    public function getSummary(
        ?int $categoryId = null,
        ?string $search = null,
        ?string $status = null,
        ?int $page = null,
        ?int $perPage = null
    ): array {
        $query = Product::with(['category'])
            ->orderBy('name');

        if ($categoryId) {
            $query->where('category_id', $categoryId);
        }

        if ($status === 'active') {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%");
            });
        }

        $products = $query->get();

        $totalUnits = 0;
        $totalCostValuation = Money::zero();
        $totalRetailValuation = Money::zero();
        $totalWholesaleValuation = Money::zero();

        $lowStockCount = 0;
        $outOfStockCount = 0;

        $categoryMap = [];
        $productRows = [];

        foreach ($products as $product) {
            $stock = $product->stock_quantity->toInt();
            $purchaseCost = $product->purchase_cost;
            $retailPrice = $product->retail_price;
            $wholesalePrice = $product->wholesale_price;

            $lineCostVal = $purchaseCost->multiply($stock);
            $lineRetailVal = $retailPrice->multiply($stock);
            $lineWholesaleVal = $wholesalePrice->multiply($stock);

            $totalUnits += $stock;
            $totalCostValuation = $totalCostValuation->add($lineCostVal);
            $totalRetailValuation = $totalRetailValuation->add($lineRetailVal);
            $totalWholesaleValuation = $totalWholesaleValuation->add($lineWholesaleVal);

            if ($stock === 0) {
                $outOfStockCount++;
            } elseif ($stock <= 5) {
                $lowStockCount++;
            }

            // Category breakdown
            $catName = $product->category?->name ?? 'غير مصنف';
            if (! isset($categoryMap[$catName])) {
                $categoryMap[$catName] = [
                    'category_name' => $catName,
                    'category_id' => $product->category_id,
                    'products_count' => 0,
                    'total_units' => 0,
                    'cost_valuation' => Money::zero(),
                    'retail_valuation' => Money::zero(),
                ];
            }
            $categoryMap[$catName]['products_count']++;
            $categoryMap[$catName]['total_units'] += $stock;
            $categoryMap[$catName]['cost_valuation'] = $categoryMap[$catName]['cost_valuation']->add($lineCostVal);
            $categoryMap[$catName]['retail_valuation'] = $categoryMap[$catName]['retail_valuation']->add($lineRetailVal);

            $productRows[] = [
                'id' => $product->id,
                'name' => $product->name,
                'barcode' => $product->barcode,
                'category_name' => $catName,
                'is_active' => $product->is_active,
                'stock_quantity' => $stock,
                'purchase_cost' => $purchaseCost->toDecimal(),
                'wholesale_price' => $wholesalePrice->toDecimal(),
                'retail_price' => $retailPrice->toDecimal(),
                'cost_valuation' => $lineCostVal->toDecimal(),
                'retail_valuation' => $lineRetailVal->toDecimal(),
            ];
        }

        $formattedCategories = [];
        foreach ($categoryMap as $cat) {
            $formattedCategories[] = [
                'category_name' => $cat['category_name'],
                'category_id' => $cat['category_id'],
                'products_count' => $cat['products_count'],
                'total_units' => $cat['total_units'],
                'cost_valuation' => $cat['cost_valuation']->toDecimal(),
                'retail_valuation' => $cat['retail_valuation']->toDecimal(),
            ];
        }

        $totalFiltered = count($productRows);

        $result = [
            'total_products_count' => $products->count(),
            'total_units_in_stock' => $totalUnits,
            'total_cost_valuation' => $totalCostValuation->toDecimal(),
            'total_retail_valuation' => $totalRetailValuation->toDecimal(),
            'total_wholesale_valuation' => $totalWholesaleValuation->toDecimal(),
            'low_stock_count' => $lowStockCount,
            'out_of_stock_count' => $outOfStockCount,
            // Return both keys for frontend and backend compatibility
            'categories' => $formattedCategories,
            'categories_breakdown' => $formattedCategories,
            'products' => $productRows,
            'valuation_methodology' => 'التقييم يعتمد على سعر الشراء الحالي للمنتجات مضروباً في رصيد المخزن الفعلي الحالي (Current Stock * Current Purchase Cost)، وهو منفصل تماماً عن تكلفة البضاعة المباعة التاريخية المستندة إلى لقطات الفواتير.',
        ];

        // Paginate if requested
        if ($perPage !== null && $perPage > 0) {
            $currentPage = max(1, $page ?? 1);
            $offset = ($currentPage - 1) * $perPage;
            $paginatedItems = array_slice($productRows, $offset, $perPage);

            $result['products'] = $paginatedItems;
            $result['pagination'] = [
                'current_page' => $currentPage,
                'last_page' => (int) ceil($totalFiltered / $perPage),
                'per_page' => $perPage,
                'total' => $totalFiltered,
            ];
        }

        return $result;
    }
}
