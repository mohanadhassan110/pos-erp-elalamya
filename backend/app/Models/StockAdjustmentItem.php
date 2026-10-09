<?php

namespace App\Models;

use App\Domain\Support\Casts\QuantityCast;
use App\Domain\Support\Quantity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $stock_adjustment_id
 * @property int $product_id
 * @property Quantity $system_quantity
 * @property Quantity $actual_quantity
 * @property int $difference_quantity
 */
class StockAdjustmentItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_adjustment_id',
        'product_id',
        'system_quantity',
        'actual_quantity',
        'difference_quantity',
    ];

    protected function casts(): array
    {
        return [
            'system_quantity' => QuantityCast::class,
            'actual_quantity' => QuantityCast::class,
            'difference_quantity' => 'integer',
        ];
    }

    public function stockAdjustment(): BelongsTo
    {
        return $this->belongsTo(StockAdjustment::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
