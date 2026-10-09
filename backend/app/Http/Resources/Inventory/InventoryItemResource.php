<?php

namespace App\Http\Resources\Inventory;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
class InventoryItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $valuation = $this->currentStockValuation();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'barcode' => $this->barcode,
            'category_id' => $this->category_id,
            'category_name' => $this->category?->name,
            'current_stock' => $this->stock_quantity->toInt(),
            'current_purchase_cost' => $this->purchase_cost->toDecimal(),
            'current_purchase_cost_formatted' => $this->purchase_cost->formattedArabic(),
            'stock_valuation' => $valuation->toDecimal(),
            'stock_valuation_formatted' => $valuation->formattedArabic(),
            'is_in_stock' => $this->stock_quantity->toInt() > 0,
            'is_active' => $this->is_active,
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
