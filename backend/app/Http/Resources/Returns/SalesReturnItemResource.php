<?php

namespace App\Http\Resources\Returns;

use App\Domain\Auth\Enums\UserRole;
use App\Models\SalesReturnItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SalesReturnItem
 */
class SalesReturnItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $isOwner = $user && $user->role === UserRole::OWNER;

        return [
            'id' => $this->id,
            'sales_return_id' => $this->sales_return_id,
            'invoice_item_id' => $this->invoice_item_id,
            'product_id' => $this->product_id,
            'product_name' => $this->invoiceItem?->product_name ?? $this->product?->name,
            'barcode' => $this->invoiceItem?->barcode ?? $this->product?->barcode,
            'quantity' => $this->quantity->toInt(),
            'unit_sale_price' => $this->unit_sale_price->toDecimal(),
            'subtotal' => $this->subtotal->toDecimal(),

            // Historical Cost and Profit Reversal are strictly confidential and Owner-only.
            // Cashiers, customers, and printable templates never receive internal purchase cost or profit.
            'unit_cost' => $this->when($isOwner, fn () => $this->unit_cost->toDecimal()),
            'profit_reversal' => $this->when($isOwner, fn () => $this->profit_reversal->toDecimal()),
        ];
    }
}
