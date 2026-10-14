<?php

namespace App\Http\Resources\Sales;

use App\Domain\Auth\Enums\UserRole;
use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Invoice
 */
class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $isOwner = $user && $user->role === UserRole::OWNER;

        $customerData = null;
        if ($this->customer) {
            $currentBalance = $this->customer->calculateBalance();
            $balances = $this->calculateCustomerBalances();
            $priorBalance = $balances['prior_balance'];
            $resultingBalance = $balances['resulting_balance'];

            $customerData = [
                'id' => $this->customer->id,
                'name' => $this->customer->name,
                'phone' => $this->customer->phone,
                'address' => $this->customer->address,
                'current_balance' => $currentBalance->toDecimal(),
                'prior_balance' => $priorBalance->toDecimal(),
                'resulting_balance' => $resultingBalance->toDecimal(),
            ];
        }

        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'idempotency_key' => $this->idempotency_key,
            'sale_type' => $this->sale_type->value,
            'sale_type_label' => $this->sale_type->label(),
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'customer' => $customerData,
            'subtotal' => $this->subtotal->toDecimal(),
            'discount_amount' => $this->discount_amount->toDecimal(),
            'total' => $this->total->toDecimal(),
            'paid_amount' => $this->paid_amount->toDecimal(),
            'remaining_amount' => $this->remaining_amount->toDecimal(),
            'credit_amount' => $this->credit_amount->toDecimal(),
            'notes' => $this->notes,
            'items' => InvoiceItemResource::collection($this->whenLoaded('items')),
            'payments' => InvoicePaymentResource::collection($this->whenLoaded('payments')),
            'created_at' => $this->created_at?->toIso8601String(),
            'creator' => $this->creator ? [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
            ] : null,

            'document_type' => $this->replacementForReturn ? 'replacement' : 'sale',
            'document_type_label' => $this->replacementForReturn ? 'فاتورة بديلة عن استبدال' : 'فاتورة بيع',
            'is_replacement' => $this->replacementForReturn !== null,
            'replacement_details' => $this->replacementForReturn ? [
                'return_id' => $this->replacementForReturn->id,
                'return_number' => $this->replacementForReturn->return_number,
                'original_invoice_id' => $this->replacementForReturn->invoice_id,
                'original_invoice_number' => $this->replacementForReturn->invoice?->invoice_number,
                'returned_value' => $this->replacementForReturn->total_return_amount->toDecimal(),
                'replacement_value' => $this->total->toDecimal(),
                'difference_amount' => $this->replacementForReturn->difference_amount->toDecimal(),
                'difference_paid_amount' => $this->replacementForReturn->difference_amount->toDecimal(),
            ] : null,
            'has_returns' => $this->relationLoaded('returns') ? $this->returns->isNotEmpty() : $this->returns()->exists(),
            'returned_value' => $this->relationLoaded('returns')
                ? (string) $this->returns->sum(fn ($r) => (float) $r->total_return_amount->toDecimal())
                : (string) $this->returns()->sum('total_return_amount'),
            'net_after_returns' => bcsub(
                $this->total->toDecimal(),
                $this->relationLoaded('returns')
                    ? (string) $this->returns->sum(fn ($r) => (float) $r->total_return_amount->toDecimal())
                    : (string) $this->returns()->sum('total_return_amount'),
                2
            ),
            'returns' => $this->relationLoaded('returns')
                ? $this->returns->map(fn ($ret) => [
                    'id' => $ret->id,
                    'return_number' => $ret->return_number,
                    'resolution' => $ret->resolution->value,
                    'resolution_label' => $ret->resolution->label(),
                    'total_return_amount' => $ret->total_return_amount->toDecimal(),
                    'created_at' => $ret->created_at?->format('Y-m-d H:i'),
                ])->values()->all()
                : [],

            // Profit metrics are strictly Owner-only per AGENTS.md Constitution
            'total_profit' => $this->when($isOwner, fn () => $this->calculateTotalProfit()->toDecimal()),
        ];
    }
}
