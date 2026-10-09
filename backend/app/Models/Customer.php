<?php

namespace App\Models;

use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'phone',
        'address',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(CustomerTransaction::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Compute authoritative account balance from ledger movements.
     * Balance = Total Debits (Invoices/Debts) - Total Credits (Payments/Credits/Returns).
     * Positive = Customer Debt (Receivable).
     * Negative = Customer Credit (Overpayment on account).
     * Zero = Fully settled.
     */
    public function calculateBalance(): Money
    {
        $debits = $this->transactions()
            ->where('direction', CustomerTransactionDirection::DEBIT->value)
            ->sum('amount');

        $credits = $this->transactions()
            ->where('direction', CustomerTransactionDirection::CREDIT->value)
            ->sum('amount');

        return Money::fromDecimal($debits)->subtract(Money::fromDecimal($credits));
    }
}
