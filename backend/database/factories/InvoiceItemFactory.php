<?php

namespace Database\Factories;

use App\Domain\Sales\Enums\InvoiceItemType;
use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InvoiceItem>
 */
class InvoiceItemFactory extends Factory
{
    protected $model = InvoiceItem::class;

    public function definition(): array
    {
        return [
            'invoice_id' => Invoice::factory(),
            'product_id' => Product::factory(),
            'item_type' => InvoiceItemType::PRODUCT,
            'product_name' => 'طقم أنتريه فاخر',
            'barcode' => 'A0001',
            'quantity' => Quantity::from(1),
            'unit_sale_price' => Money::from(650),
            'unit_cost' => Money::from(500),
            'subtotal' => Money::from(650),
            'profit' => Money::from(150),
        ];
    }
}
