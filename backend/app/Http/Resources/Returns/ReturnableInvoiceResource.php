<?php

namespace App\Http\Resources\Returns;

use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Invoice
 */
class ReturnableInvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'sale_type' => $this->sale_type->value,
            'sale_type_label' => $this->sale_type->label(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'total' => $this->total->toDecimal(),
            'paid_amount' => $this->paid_amount->toDecimal(),
            'remaining_amount' => $this->remaining_amount->toDecimal(),
            'credit_amount' => $this->credit_amount->toDecimal(),
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer?->name,
            'customer_phone' => $this->customer?->phone,
            'created_at' => $this->created_at?->toISOString(),
            'created_at_formatted' => $this->created_at?->format('Y-m-d H:i'),
            'items' => $this->items->map(function ($item) {
                $previouslyReturned = $item->getPreviouslyReturnedQuantity();
                $remaining = $item->getRemainingReturnableQuantity();

                return [
                    'id' => $item->id,
                    'invoice_item_id' => $item->id,
                    'product_id' => $item->product_id,
                    'item_type' => $item->item_type->value,
                    'product_name' => $item->product_name,
                    'barcode' => $item->barcode,
                    'unit_sale_price' => $item->unit_sale_price->toDecimal(),
                    'originally_sold_quantity' => $item->quantity->toInt(),
                    'previously_returned_quantity' => $previouslyReturned,
                    'remaining_returnable_quantity' => $remaining,
                    'subtotal' => $item->subtotal->toDecimal(),
                ];
            }),
        ];
    }
}
