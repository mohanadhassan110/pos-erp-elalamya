<?php

namespace App\Models;

use App\Domain\Customers\Enums\CustomerTransactionDirection;
use App\Domain\Customers\Enums\CustomerTransactionType;
use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Money;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int $customer_id
 * @property CustomerTransactionType $type
 * @property Money $amount
 * @property CustomerTransactionDirection $direction
 * @property string|null $reference_type
 * @property int|null $reference_id
 * @property string|null $description
 * @property int|null $created_by
 */
class CustomerTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
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
            'type' => CustomerTransactionType::class,
            'direction' => CustomerTransactionDirection::class,
            'amount' => MoneyCast::class,
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
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
