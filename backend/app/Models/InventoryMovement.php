<?php

namespace App\Models;

use App\Domain\Inventory\Enums\InventoryMovementType;
use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Casts\QuantityCast;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property int $product_id
 * @property InventoryMovementType $type
 * @property Quantity $quantity
 * @property Money|null $unit_cost
 * @property Quantity $resulting_stock
 * @property string|null $reference_type
 * @property int|null $reference_id
 * @property string|null $reason
 * @property int|null $created_by
 */
class InventoryMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'type',
        'quantity',
        'unit_cost',
        'resulting_stock',
        'reference_type',
        'reference_id',
        'reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => InventoryMovementType::class,
            'quantity' => QuantityCast::class,
            'unit_cost' => MoneyCast::class,
            'resulting_stock' => QuantityCast::class,
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
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
