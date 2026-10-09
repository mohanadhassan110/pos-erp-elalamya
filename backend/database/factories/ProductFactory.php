<?php

namespace Database\Factories;

use App\Domain\Support\Money;
use App\Domain\Support\Quantity;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'category_id' => Category::factory(),
            'name' => 'كنبة '.fake()->word(),
            'barcode' => strtoupper(fake()->unique()->lexify('?')).str_pad((string) fake()->unique()->numberBetween(1, 9999), 4, '0', STR_PAD_LEFT),
            'purchase_cost' => Money::from(500),
            'wholesale_price' => Money::from(650),
            'retail_price' => Money::from(750),
            'stock_quantity' => Quantity::from(10),
            'is_active' => true,
        ];
    }
}
