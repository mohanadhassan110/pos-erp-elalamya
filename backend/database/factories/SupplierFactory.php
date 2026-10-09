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
            'name' => 'مصنع '.fake()->company(),
            'phone' => '01'.fake()->numberBetween(100000000, 999999999),
            'address' => 'دمياط، مصر',
            'notes' => null,
            'is_active' => true,
        ];
    }
}
