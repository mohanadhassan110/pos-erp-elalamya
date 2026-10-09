<?php

namespace App\Http\Controllers\Api\V1\Catalog;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\BarcodePrintPreviewRequest;
use App\Http\Resources\Catalog\BarcodeLabelResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;

class BarcodePrintController extends Controller
{
    /**
     * Prepare printable barcode labels for one or more products.
     *
     * Invariants (AGENTS.md & Phase 12):
     * - Preserves existing product barcodes without regenerating or modifying them.
     * - Never mutates master products or category sequence logic.
     * - Does not expose internal purchase costs or profits.
     * - Multiplies or batches labels based on user-requested label quantities.
     */
    public function preview(BarcodePrintPreviewRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $items = collect($validated['items']);
        $productIds = $items->pluck('product_id')->unique()->all();

        $products = Product::with('category')
            ->whereIn('id', $productIds)
            ->get()
            ->keyBy('id');

        $labels = [];
        $totalLabels = 0;

        foreach ($items as $item) {
            $product = $products->get($item['product_id']);
            if (! $product) {
                continue;
            }

            $quantity = (int) $item['quantity'];
            $totalLabels += $quantity;

            $labels[] = (new BarcodeLabelResource($product, $quantity))->resolve();
        }

        return response()->json([
            'data' => [
                'labels' => $labels,
                'summary' => [
                    'products_count' => count($labels),
                    'total_labels' => $totalLabels,
                ],
            ],
        ]);
    }
}
