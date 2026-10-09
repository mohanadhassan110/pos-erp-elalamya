<?php

namespace App\Models;

use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Casts\QuantityCast;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $stock_receipt_id
 * @property int $product_id
 * @property Quantity $quantity
 * @property Money $unit_cost
 * @property Money $subtotal
 */
class StockReceiptItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_receipt_id',
        'product_id',
        'quantity',
        'unit_cost',
        'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => QuantityCast::class,
            'unit_cost' => MoneyCast::class,
            'subtotal' => MoneyCast::class,
        ];
    }

    public function stockReceipt(): BelongsTo
    {
        return $this->belongsTo(StockReceipt::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
