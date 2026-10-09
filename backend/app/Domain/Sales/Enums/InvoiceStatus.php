<?php

namespace App\Domain\Sales\Enums;

enum InvoiceStatus: string
{
    case POSTED = 'posted';
    case CANCELLED = 'cancelled';

    public function label(): string
    {
        return match ($this) {
            self::POSTED => 'معتمدة ومرحلة',
            self::CANCELLED => 'ملغاة',
        };
    }

    public function isPosted(): bool
    {
        return $this === self::POSTED;
    }

    public function isCancelled(): bool
    {
        return $this === self::CANCELLED;
    }
}
