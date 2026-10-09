<?php

namespace App\Http\Resources\Returns;

use App\Domain\Auth\Enums\UserRole;
use App\Domain\Support\Money;
use App\Http\Resources\Customers\CustomerResource;
use App\Http\Resources\Sales\InvoiceResource;
use App\Models\SalesReturn;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalesReturn
 */
class SalesReturnResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $isOwner = $user && $user->role === UserRole::OWNER;

        return [
            'id' => $this->id,
            'return_number' => $this->return_number,
            'idempotency_key' => $this->idempotency_key,
            'invoice_id' => $this->invoice_id,
            'invoice_number' => $this->invoice?->invoice_number,
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer?->name,
            'customer' => new CustomerResource($this->whenLoaded('customer')),
            'resolution' => $this->resolution->value,
            'resolution_label' => $this->resolution->label(),
            'total_return_amount' => $this->total_return_amount->toDecimal(),
            'replacement_invoice_id' => $this->replacement_invoice_id,
            'replacement_invoice' => new InvoiceResource($this->whenLoaded('replacementInvoice')),
            'difference_amount' => $this->difference_amount->toDecimal(),
            'notes' => $this->notes,
            'items' => SalesReturnItemResource::collection($this->whenLoaded('items')),
            'created_by' => $this->created_by,
            'creator_name' => $this->creator?->name,
            'created_at' => $this->created_at?->toISOString(),
            'created_at_formatted' => $this->created_at?->format('Y-m-d H:i'),

            // Owner-only total profit reversed
            'total_profit_reversed' => $this->when($isOwner, function () {
                $sum = Money::zero();
                if ($this->relationLoaded('items')) {
                    foreach ($this->items as $item) {
                        $sum = $sum->add($item->profit_reversal);
                    }
                }

                return $sum->toDecimal();
            }),
        ];
    }
}
