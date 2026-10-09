<?php

namespace App\Models;

use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Money;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $receipt_number
 * @property int|null $supplier_id
 * @property CarbonInterface $received_date
 * @property Money $total_cost
 * @property string|null $notes
 * @property int|null $created_by
 */
class StockReceipt extends Model
{
    use HasFactory;

    protected $fillable = [
        'receipt_number',
        'idempotency_key',
        'supplier_id',
        'received_date',
        'total_cost',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'received_date' => 'date',
            'total_cost' => MoneyCast::class,
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockReceiptItem::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
