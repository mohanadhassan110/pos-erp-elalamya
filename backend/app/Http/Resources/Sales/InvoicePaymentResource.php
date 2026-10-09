<?php

namespace App\Http\Resources\Sales;

use App\Models\InvoicePayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin InvoicePayment
 */
class InvoicePaymentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'payment_method_id' => $this->payment_method_id,
            'payment_method_name' => $this->paymentMethod?->name ?? 'غير محدد',
            'amount' => $this->amount->toDecimal(),
            'notes' => $this->notes,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
