<?php

namespace App\Domain\Customers\Enums;

enum CustomerTransactionDirection: string
{
    case DEBIT = 'debit';   // مدين: يزيد مديونية العميل على حسابه
    case CREDIT = 'credit'; // دائن: يسدد من مديونية العميل أو يمنحه رصيداً دائناً

    public function label(): string
    {
        return match ($this) {
            self::DEBIT => 'مدين (+ مديونية)',
            self::CREDIT => 'دائن (- مديونية / + رصيد)',
        };
    }

    public function isDebit(): bool
    {
        return $this === self::DEBIT;
    }

    public function isCredit(): bool
    {
        return $this === self::CREDIT;
    }
}
