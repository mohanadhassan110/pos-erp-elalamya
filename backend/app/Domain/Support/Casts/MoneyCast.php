<?php

namespace App\Domain\Support\Casts;

use App\Domain\Support\Money;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class MoneyCast implements CastsAttributes
{
    /**
     * Cast the given value from database storage to Money Value Object.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): Money
    {
        if ($value === null) {
            return Money::zero();
        }

        return Money::fromDecimal($value);
    }

    /**
     * Prepare the given value for storage in the database as DECIMAL(15,2) string.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): string
    {
        if ($value instanceof Money) {
            return $value->toDecimal();
        }

        if ($value === null) {
            return '0.00';
        }

        return Money::fromDecimal($value)->toDecimal();
    }
}
