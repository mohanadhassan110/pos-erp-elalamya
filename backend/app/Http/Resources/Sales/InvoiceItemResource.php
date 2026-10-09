<?php

namespace App\Http\Resources\Sales;

use App\Domain\Auth\Enums\UserRole;
use App\Models\InvoiceItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InvoiceItem
 */
class InvoiceItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $isOwner = $user && $user->role === UserRole::OWNER;

        return [
            'id' => $this->id,
            'product_id' => $this->product_id,
            'item_type' => $this->item_type->value,
            'product_name' => $this->product_name,
            'barcode' => $this->barcode,
            'quantity' => $this->quantity->toInt(),
            'unit_sale_price' => $this->unit_sale_price->toDecimal(),
            'subtotal' => $this->subtotal->toDecimal(),

            // Historical Cost and Profit are strictly confidential and Owner-only.
            // Cashiers, customers, and printable templates never receive internal purchase cost or profit.
            'unit_cost' => $this->when($isOwner, fn () => $this->unit_cost->toDecimal()),
            'total_cost' => $this->when($isOwner, fn () => $this->total_cost->toDecimal()),
            'profit' => $this->when($isOwner, fn () => $this->profit->toDecimal()),
        ];
    }
}
