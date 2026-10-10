<?php

namespace Database\Factories;

use App\Models\Supplier;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Supplier>
 */
class SupplierFactory extends Factory
{
    protected $model = Supplier::class;

    public function definition(): array
    {
        return [
            'name' => 'مورد تجريبي '.fake()->unique()->numberBetween(100, 9999),
            'phone' => '01'.fake()->numberBetween(100000000, 999999999),
            'address' => 'المحلة الكبرى، مصر',
            'notes' => null,
            'is_active' => true,
        ];
    }
}
