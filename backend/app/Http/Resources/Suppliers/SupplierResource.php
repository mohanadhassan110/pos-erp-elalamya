<?php

namespace App\Http\Resources\Suppliers;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Supplier
 */
class SupplierResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $payable = $this->calculatePayable();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'address' => $this->address,
            'notes' => $this->notes,
            'is_active' => $this->is_active,
            'payable' => $payable->toDecimal(),
            'payable_formatted' => $payable->formattedArabic(),
            'is_settled' => $payable->isZero(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
