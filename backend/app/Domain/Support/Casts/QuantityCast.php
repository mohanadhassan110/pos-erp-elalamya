<?php

namespace App\Domain\Support\Casts;

use App\Domain\Support\Quantity;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class QuantityCast implements CastsAttributes
{
    /**
     * Cast the given value from database storage to Quantity Value Object.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): Quantity
    {
        if ($value === null) {
            return Quantity::zero();
        }

        return Quantity::from((int) $value);
    }

    /**
     * Prepare the given value for storage in the database as an integer.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): int
    {
        if ($value instanceof Quantity) {
            return $value->toInt();
        }

        if ($value === null) {
            return 0;
        }

        return Quantity::from($value)->toInt();
    }
}
