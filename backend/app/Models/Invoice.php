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
     *
     * Ordering rule:
     * Transactions are strictly ordered by event time first (`created_at` ASC),
     * using transaction ID (`id` ASC) as the deterministic tiebreaker.
     *
     * A transaction is strictly BEFORE this invoice if:
     * - its `created_at` is earlier than this invoice's earliest transaction event time, OR
     * - its `created_at` equals the invoice event time AND its `id` is lower than the invoice transaction ID.
     *
     * Resulting balance = prior balance + (invoice total - amount paid on invoice).
     * Consistent with the invariant: Customer Balance = SUM(debits) - SUM(credits).
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

        // Find the earliest customer transaction created by this invoice in chronological ordering (created_at ASC, id ASC)
        $firstInvoiceTx = CustomerTransaction::query()
            ->where('customer_id', $this->customer->id)
            ->where('reference_type', Invoice::class)
            ->where('reference_id', $this->id)
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->first();

        if ($firstInvoiceTx !== null) {
            $anchorCreatedAt = $firstInvoiceTx->created_at;
            $anchorId = $firstInvoiceTx->id;

            $priorQuery = CustomerTransaction::query()
                ->where('customer_id', $this->customer->id)
                ->where(function ($query) use ($anchorCreatedAt, $anchorId) {
                    $query->where('created_at', '<', $anchorCreatedAt)
                        ->orWhere(function ($subQuery) use ($anchorCreatedAt, $anchorId) {
                            $subQuery->where('created_at', '=', $anchorCreatedAt)
                                ->where('id', '<', $anchorId);
                        });
                })
                ->where(function ($q) {
                    $q->where('reference_type', '!=', Invoice::class)
                        ->orWhere('reference_id', '!=', $this->id)
                        ->orWhereNull('reference_type');
                });

            $priorDebits = (clone $priorQuery)
                ->where('direction', CustomerTransactionDirection::DEBIT->value)
                ->sum('amount');

            $priorCredits = (clone $priorQuery)
                ->where('direction', CustomerTransactionDirection::CREDIT->value)
                ->sum('amount');

            $priorBalance = Money::fromDecimal($priorDebits)->subtract(Money::fromDecimal($priorCredits));
            $netImpact = $this->total->subtract($this->paid_amount);
            $resultingBalance = $priorBalance->add($netImpact);
        } else {
            // For invoices without direct customer transactions (e.g. retail with attached customer or unposted invoice),
            // calculate ledger balance strictly prior to invoice creation timestamp.
            $anchorCreatedAt = $this->created_at ?? now();

            $priorQuery = CustomerTransaction::query()
                ->where('customer_id', $this->customer->id)
                ->where('created_at', '<', $anchorCreatedAt);

            $priorDebits = (clone $priorQuery)
                ->where('direction', CustomerTransactionDirection::DEBIT->value)
                ->sum('amount');

            $priorCredits = (clone $priorQuery)
                ->where('direction', CustomerTransactionDirection::CREDIT->value)
                ->sum('amount');

            $priorBalance = Money::fromDecimal($priorDebits)->subtract(Money::fromDecimal($priorCredits));
            $resultingBalance = $this->sale_type === SaleType::WHOLESALE
                ? $priorBalance->add($this->total->subtract($this->paid_amount))
                : $priorBalance;
        }

        return [
            'prior_balance' => $priorBalance,
            'resulting_balance' => $resultingBalance,
        ];
    }
}
