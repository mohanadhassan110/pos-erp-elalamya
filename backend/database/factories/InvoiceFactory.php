<?php

namespace Database\Factories;

use App\Domain\Sales\Enums\InvoiceStatus;
use App\Domain\Sales\Enums\SaleType;
use App\Domain\Support\Money;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Invoice>
 */
class InvoiceFactory extends Factory
{
    protected $model = Invoice::class;

    public function definition(): array
    {
        return [
            'invoice_number' => 'INV-'.strtoupper(fake()->unique()->bothify('####??')),
            'sale_type' => SaleType::RETAIL,
            'customer_id' => null,
            'status' => InvoiceStatus::POSTED,
            'subtotal' => Money::from(1000),
            'discount_amount' => Money::zero(),
            'total' => Money::from(1000),
            'paid_amount' => Money::from(1000),
            'remaining_amount' => Money::zero(),
            'credit_amount' => Money::zero(),
            'notes' => null,
            'created_by' => User::factory(),
        ];
    }

    public function wholesale(): static
    {
        return $this->state(fn (array $attributes) => [
            'sale_type' => SaleType::WHOLESALE,
            'customer_id' => Customer::factory(),
        ]);
    }
}
