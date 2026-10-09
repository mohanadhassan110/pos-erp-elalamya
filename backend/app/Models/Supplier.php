<?php

namespace App\Models;

use App\Domain\Suppliers\Enums\SupplierTransactionDirection;
use App\Domain\Support\Money;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
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
        return $this->hasMany(SupplierTransaction::class);
    }

    public function stockReceipts(): HasMany
    {
        return $this->hasMany(StockReceipt::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Compute authoritative payable balance from supplier ledger movements.
     * Payable = Total Credits (Purchases / Manual balance increases) - Total Debits (Payments to supplier).
     * Positive = Payable debt owed to supplier.
     */
    public function calculatePayable(): Money
    {
        $credits = $this->transactions()
            ->where('direction', SupplierTransactionDirection::CREDIT->value)
            ->sum('amount');

        $debits = $this->transactions()
            ->where('direction', SupplierTransactionDirection::DEBIT->value)
            ->sum('amount');

        return Money::fromDecimal($credits)->subtract(Money::fromDecimal($debits));
    }
}
