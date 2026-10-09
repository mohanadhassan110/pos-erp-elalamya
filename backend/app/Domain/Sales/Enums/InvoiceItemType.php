<?php

namespace App\Domain\Sales\Enums;

enum InvoiceItemType: string
{
    case PRODUCT = 'product';
    case EXTERNAL = 'external';

    public function label(): string
    {
        return match ($this) {
            self::PRODUCT => 'منتج معرض',
            self::EXTERNAL => 'منتج خارجي',
        };
    }

    public function isNormalProduct(): bool
    {
        return $this === self::PRODUCT;
    }

    public function isExternalProduct(): bool
    {
        return $this === self::EXTERNAL;
    }
}
