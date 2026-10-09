<?php

namespace App\Http\Resources\Customers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Customer
 */
class CustomerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $balance = $this->calculateBalance();

        $balanceStatus = 'settled';
        $balanceStatusLabel = 'حساب خالص / مسدد';

        if ($balance->isPositive()) {
            $balanceStatus = 'debt';
            $balanceStatusLabel = 'مديونية مستحقة على العميل';
        } elseif ($balance->isNegative()) {
            $balanceStatus = 'credit';
            $balanceStatusLabel = 'رصيد دائن للعميل';
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'address' => $this->address,
            'notes' => $this->notes,
            'is_active' => $this->is_active,
            'balance' => $balance->toDecimal(),
            'balance_formatted' => $balance->formattedArabic(),
            'balance_status' => $balanceStatus,
            'balance_status_label' => $balanceStatusLabel,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
