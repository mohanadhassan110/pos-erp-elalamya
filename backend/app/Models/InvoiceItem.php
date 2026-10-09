<?php

namespace App\Models;

use App\Domain\Sales\Enums\InvoiceItemType;
use App\Domain\Support\Casts\MoneyCast;
use App\Domain\Support\Casts\QuantityCast;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $invoice_id
 * @property int|null $product_id
 * @property InvoiceItemType $item_type
 * @property string $product_name
 * @property string|null $barcode
 * @property Quantity $quantity
 * @property Money $unit_sale_price
 * @property Money $unit_cost
 * @property Money $subtotal
 * @property Money $total_cost
 * @property Money $profit
 */
class InvoiceItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_id',
        'product_id',
        'item_type',
        'product_name',
        'barcode',
        'quantity',
        'unit_sale_price',
        'unit_cost',
        'subtotal',
        'total_cost',
        'profit',
    ];

    protected function casts(): array
    {
        return [
            'item_type' => InvoiceItemType::class,
            'quantity' => QuantityCast::class,
            'unit_sale_price' => MoneyCast::class,
            'unit_cost' => MoneyCast::class,
            'subtotal' => MoneyCast::class,
            'total_cost' => MoneyCast::class,
            'profit' => MoneyCast::class,
        ];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function returnItems(): HasMany
    {
        return $this->hasMany(SalesReturnItem::class);
    }

    public function getPreviouslyReturnedQuantity(): int
    {
        return (int) $this->returnItems()->sum('quantity');
    }

    public function getRemainingReturnableQuantity(): int
    {
        return max(0, $this->quantity->toInt() - $this->getPreviouslyReturnedQuantity());
    }

    public function isNormalProduct(): bool
    {
        return $this->item_type === InvoiceItemType::PRODUCT;
    }

    public function isExternalProduct(): bool
    {
        return $this->item_type === InvoiceItemType::EXTERNAL;
    }

    /**
     * Compute and populate snapshot line values according to AGENTS.md Section 4:
     * Line Profit = (Actual Sale Price - Historical Unit Cost) * Quantity
     */
    public static function computeLineCalculations(
        Money $unitSalePrice,
        Money $unitCost,
        int|Quantity $quantity
    ): array {
        $qty = $quantity instanceof Quantity ? $quantity->toInt() : $quantity;
        $subtotal = $unitSalePrice->multiply($qty);
        $totalCost = $unitCost->multiply($qty);
        $profit = $subtotal->subtract($totalCost);

        return [
            'subtotal' => $subtotal,
            'total_cost' => $totalCost,
            'profit' => $profit,
        ];
    }
}
