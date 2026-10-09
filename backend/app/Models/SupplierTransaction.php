<?php

namespace App\Models;

use App\Domain\Suppliers\Enums\SupplierTransactionDirection;
use App\Domain\Suppliers\Enums\SupplierTransactionType;
use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Money;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int $supplier_id
 * @property SupplierTransactionType $type
 * @property Money $amount
 * @property SupplierTransactionDirection $direction
 * @property string|null $reference_type
 * @property int|null $reference_id
 * @property string|null $description
 * @property int|null $created_by
 */
class SupplierTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_id',
        'type',
        'amount',
        'direction',
        'reference_type',
        'reference_id',
        'description',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => SupplierTransactionType::class,
            'direction' => SupplierTransactionDirection::class,
            'amount' => MoneyCast::class,
        ];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
