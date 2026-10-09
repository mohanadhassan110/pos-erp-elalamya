<?php

namespace App\Domain\Sales\Enums;

enum SaleType: string
{
    case RETAIL = 'retail';
    case WHOLESALE = 'wholesale';

    public function label(): string
    {
        return match ($this) {
            self::RETAIL => 'قطاعي',
            self::WHOLESALE => 'جملة',
        };
    }

    public function isRetail(): bool
    {
        return $this === self::RETAIL;
    }

    public function isWholesale(): bool
    {
        return $this === self::WHOLESALE;
    }

    public function requiresRegisteredCustomer(): bool
    {
        return $this === self::WHOLESALE;
    }
}
