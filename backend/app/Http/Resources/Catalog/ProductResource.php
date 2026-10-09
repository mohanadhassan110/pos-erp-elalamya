<?php

namespace App\Http\Resources\Catalog;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Product
 */
class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category_id' => $this->category_id,
            'category_name' => $this->category?->name,
            'category_code' => $this->category?->code,
            'name' => $this->name,
            'barcode' => $this->barcode,
            'purchase_cost' => $this->purchase_cost->toDecimal(),
            'purchase_cost_formatted' => $this->purchase_cost->formattedArabic(),
            'wholesale_price' => $this->wholesale_price->toDecimal(),
            'wholesale_price_formatted' => $this->wholesale_price->formattedArabic(),
            'retail_price' => $this->retail_price->toDecimal(),
            'retail_price_formatted' => $this->retail_price->formattedArabic(),
            'stock_quantity' => $this->stock_quantity->toInt(),
            'is_active' => $this->is_active,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
