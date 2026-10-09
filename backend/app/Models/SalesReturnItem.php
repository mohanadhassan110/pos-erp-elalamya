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
 * @property int $sales_return_id
 * @property int $invoice_item_id
 * @property int|null $product_id
 * @property Quantity $quantity
 * @property Money $unit_sale_price
 * @property Money $unit_cost
 * @property Money $subtotal
 * @property Money $profit_reversal
 */
class SalesReturnItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'sales_return_id',
        'invoice_item_id',
        'product_id',
        'quantity',
        'unit_sale_price',
        'unit_cost',
        'subtotal',
        'profit_reversal',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => QuantityCast::class,
            'unit_sale_price' => MoneyCast::class,
            'unit_cost' => MoneyCast::class,
            'subtotal' => MoneyCast::class,
            'profit_reversal' => MoneyCast::class,
        ];
    }

    public function salesReturn(): BelongsTo
    {
        return $this->belongsTo(SalesReturn::class);
    }

    public function invoiceItem(): BelongsTo
    {
        return $this->belongsTo(InvoiceItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
