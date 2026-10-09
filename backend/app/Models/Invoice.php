<?php

namespace App\Models;

use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Sales\Enums\SaleType;
use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Money;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property string $invoice_number
 * @property int|null $customer_id
 * @property SaleType $sale_type
 * @property InvoiceStatus $status
 * @property Money $subtotal
 * @property Money $discount_amount
 * @property Money $total
 * @property Money $paid_amount
 * @property Money $remaining_amount
 * @property Money $credit_amount
 * @property string|null $notes
 * @property int|null $created_by
 * @property int|null $cancelled_by
 * @property Carbon|null $cancelled_at
 * @property string|null $cancellation_reason
 */
class Invoice extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'invoice_number',
        'idempotency_key',
        'customer_id',
        'sale_type',
        'status',
        'subtotal',
        'discount_amount',
        'total',
        'paid_amount',
        'remaining_amount',
        'credit_amount',
        'notes',
        'created_by',
        'cancelled_by',
        'cancelled_at',
        'cancellation_reason',
    ];

    protected function casts(): array
    {
        return [
            'sale_type' => SaleType::class,
            'status' => InvoiceStatus::class,
            'subtotal' => MoneyCast::class,
            'discount_amount' => MoneyCast::class,
            'total' => MoneyCast::class,
            'paid_amount' => MoneyCast::class,
            'remaining_amount' => MoneyCast::class,
            'credit_amount' => MoneyCast::class,
            'cancelled_at' => 'datetime',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(InvoicePayment::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function canceller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    public function returns(): HasMany
    {
        return $this->hasMany(SalesReturn::class);
    }

    public function scopePosted(Builder $query): Builder
    {
        return $query->where('status', InvoiceStatus::POSTED->value);
    }

    public function scopeCancelled(Builder $query): Builder
    {
        return $query->where('status', InvoiceStatus::CANCELLED->value);
    }

    public function isRetail(): bool
    {
        return $this->sale_type === SaleType::RETAIL;
    }

    public function isWholesale(): bool
    {
        return $this->sale_type === SaleType::WHOLESALE;
    }

    public function isPosted(): bool
    {
        return $this->status === InvoiceStatus::POSTED;
    }

    public function isCancelled(): bool
    {
        return $this->status === InvoiceStatus::CANCELLED;
    }

    /**
     * Compute total gross profit from historical item snapshots.
     * NEVER uses current product cost! Satisfies AGENTS.md Section 4 & 22.
     */
    public function calculateTotalProfit(): Money
    {
        $profitSum = $this->items()->sum('profit');

        return Money::fromDecimal($profitSum);
    }

    /**
     * Compute authoritative customer prior and resulting balances at invoice time.
     * Uses the historical customer ledger sequence so subsequent customer transactions
     * never alter printed balance history.
     *
     * @return array{prior_balance: Money, resulting_balance: Money}
     */
    public function calculateCustomerBalances(): array
    {
        if (! $this->customer) {
            return [
                'prior_balance' => Money::zero(),
                'resulting_balance' => Money::zero(),
            ];
        }

        // Find the earliest customer transaction created by this invoice
        $firstInvoiceTxId = CustomerTransaction::query()
            ->where('customer_id', $this->customer->id)
            ->where('reference_type', Invoice::class)
            ->where('reference_id', $this->id)
            ->min('id');

        if ($firstInvoiceTxId !== null) {
            $priorDebits = CustomerTransaction::query()
                ->where('customer_id', $this->customer->id)
                ->where('id', '<', $firstInvoiceTxId)
                ->where('direction', CustomerTransactionDirection::DEBIT->value)
                ->sum('amount');

            $priorCredits = CustomerTransaction::query()
                ->where('customer_id', $this->customer->id)
                ->where('id', '<', $firstInvoiceTxId)
                ->where('direction', CustomerTransactionDirection::CREDIT->value)
                ->sum('amount');

            $priorBalance = Money::fromDecimal($priorDebits)->subtract(Money::fromDecimal($priorCredits));
            $netImpact = $this->total->subtract($this->paid_amount);
            $resultingBalance = $priorBalance->add($netImpact);
        } else {
            // For invoices without direct customer transactions (e.g. retail with attached customer),
            // calculate ledger balance strictly prior to invoice creation timestamp.
            $priorDebits = CustomerTransaction::query()
                ->where('customer_id', $this->customer->id)
                ->where('created_at', '<', $this->created_at ?? now())
                ->where('direction', CustomerTransactionDirection::DEBIT->value)
                ->sum('amount');

            $priorCredits = CustomerTransaction::query()
                ->where('customer_id', $this->customer->id)
                ->where('created_at', '<', $this->created_at ?? now())
                ->where('direction', CustomerTransactionDirection::CREDIT->value)
                ->sum('amount');

            $priorBalance = Money::fromDecimal($priorDebits)->subtract(Money::fromDecimal($priorCredits));
            $resultingBalance = $priorBalance;
        }

        return [
            'prior_balance' => $priorBalance,
            'resulting_balance' => $resultingBalance,
        ];
    }
}
