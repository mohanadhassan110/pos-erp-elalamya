<?php

namespace App\Http\Resources\Purchasing;

use App\Models\StockReceiptItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StockReceiptItem
 */
class StockReceiptItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'product_name' => $this->product?->name,
            'product_barcode' => $this->product?->barcode,
            'quantity' => $this->quantity->toInt(),
            'unit_cost' => $this->unit_cost->toDecimal(),
            'unit_cost_formatted' => $this->unit_cost->formattedArabic(),
            'subtotal' => $this->subtotal->toDecimal(),
            'subtotal_formatted' => $this->subtotal->formattedArabic(),
        ];
    }
}
