<?php

namespace App\Http\Resources\Purchasing;

use App\Models\StockReceipt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StockReceipt
 */
class StockReceiptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'receipt_number' => $this->receipt_number,
            'supplier_id' => $this->supplier_id,
            'supplier_name' => $this->supplier?->name,
            'received_date' => $this->received_date->format('Y-m-d'),
            'total_cost' => $this->total_cost->toDecimal(),
            'total_cost_formatted' => $this->total_cost->formattedArabic(),
            'notes' => $this->notes,
            'items_count' => $this->items()->count(),
            'items' => StockReceiptItemResource::collection($this->whenLoaded('items')),
            'created_by' => $this->creator?->name,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
