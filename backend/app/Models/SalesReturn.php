<?php

namespace App\Models;

use App\Domain\Returns\Enums\SalesReturnResolution;
use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Money;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * @property int $id
 * @property string $return_number
 * @property string|null $idempotency_key
 * @property int $invoice_id
 * @property int|null $customer_id
 * @property SalesReturnResolution $resolution
 * @property Money $total_return_amount
 * @property int|null $replacement_invoice_id
 * @property Money $difference_amount
 * @property string|null $notes
 * @property int|null $created_by
 */
class SalesReturn extends Model
{
    use HasFactory;

    protected $fillable = [
        'return_number',
        'idempotency_key',
        'invoice_id',
        'customer_id',
        'resolution',
        'total_return_amount',
        'replacement_invoice_id',
        'difference_amount',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'resolution' => SalesReturnResolution::class,
            'total_return_amount' => MoneyCast::class,
            'difference_amount' => MoneyCast::class,
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function replacementInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'replacement_invoice_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SalesReturnItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payments(): MorphMany
    {
        return $this->morphMany(Payment::class, 'payable');
    }
}
