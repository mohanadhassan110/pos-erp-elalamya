<?php

namespace Database\Factories;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name().' (عميل جملة)',
            'phone' => '01'.fake()->numberBetween(100000000, 999999999),
            'address' => 'القاهرة، مصر',
            'notes' => null,
            'is_active' => true,
        ];
    }
}
