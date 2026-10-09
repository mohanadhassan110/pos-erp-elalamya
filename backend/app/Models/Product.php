<?php

namespace App\Models;

use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Casts\QuantityCast;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * @property int $id
 * @property int $category_id
 * @property string $name
 * @property string $barcode
 * @property Money $purchase_cost
 * @property Money $wholesale_price
 * @property Money $retail_price
 * @property Quantity $stock_quantity
 * @property bool $is_active
 */
class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'category_id',
        'name',
        'barcode',
        'purchase_cost',
        'wholesale_price',
        'retail_price',
        'stock_quantity',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'purchase_cost' => MoneyCast::class,
            'wholesale_price' => MoneyCast::class,
            'retail_price' => MoneyCast::class,
            'stock_quantity' => QuantityCast::class,
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function inventoryMovements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(InvoiceItem::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function hasStock(int|Quantity $required): bool
    {
        $needed = $required instanceof Quantity ? $required->toInt() : $required;

        return $this->stock_quantity->toInt() >= $needed;
    }

    /**
     * Compute current showroom stock valuation = Current Stock * Current Purchase Cost
     * According to AGENTS.md Section 22: "Stock valuation is current: Current Stock x Current Purchase Cost"
     */
    public function currentStockValuation(): Money
    {
        return $this->purchase_cost->multiply($this->stock_quantity->toInt());
    }
}
