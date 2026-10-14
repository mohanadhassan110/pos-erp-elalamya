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
        $previouslyReturnedTotal = '0.00';
        $remainingReturnableTotal = '0.00';
        $totalOriginalQty = 0;
        $totalRemainingQty = 0;

        $items = $this->items->map(function ($item) use (&$previouslyReturnedTotal, &$remainingReturnableTotal, &$totalOriginalQty, &$totalRemainingQty) {
            $previouslyReturned = $item->getPreviouslyReturnedQuantity();
            $remaining = $item->getRemainingReturnableQuantity();
            $totalOriginalQty += $item->quantity->toInt();
            $totalRemainingQty += $remaining;

            $returnedSubtotal = bcmul($item->unit_sale_price->toDecimal(), (string) $previouslyReturned, 2);
            $remainingSubtotal = bcmul($item->unit_sale_price->toDecimal(), (string) $remaining, 2);

            $previouslyReturnedTotal = bcadd($previouslyReturnedTotal, $returnedSubtotal, 2);
            $remainingReturnableTotal = bcadd($remainingReturnableTotal, $remainingSubtotal, 2);

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
        });

        $hasReturns = (float) $previouslyReturnedTotal > 0;
        $isFullyReturned = ($totalRemainingQty === 0);

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
            'has_returns' => $hasReturns,
            'is_fully_returned' => $isFullyReturned,
            'previously_returned_amount' => $previouslyReturnedTotal,
            'remaining_returnable_amount' => $remainingReturnableTotal,
            'total_original_quantity' => $totalOriginalQty,
            'total_remaining_quantity' => $totalRemainingQty,
            'returns_summary' => $this->relationLoaded('returns')
                ? $this->returns->map(fn ($r) => [
                    'id' => $r->id,
                    'return_number' => $r->return_number,
                    'amount' => $r->total_return_amount->toDecimal(),
                    'created_at' => $r->created_at?->format('Y-m-d H:i'),
                    'resolution_label' => $r->resolution->label(),
                ])->values()->all()
                : [],
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer?->name,
            'customer_phone' => $this->customer?->phone,
            'customer_balance' => $this->customer ? $this->customer->calculateBalance()->toDecimal() : null,
            'customer_balance_formatted' => $this->customer ? $this->customer->calculateBalance()->formattedArabic() : null,
            'created_at' => $this->created_at?->toISOString(),
            'created_at_formatted' => $this->created_at?->format('Y-m-d H:i'),
            'items' => $items,
        ];
    }
}
