<?php

namespace App\Domain\Suppliers\Enums;

enum SupplierTransactionDirection: string
{
    case DEBIT = 'debit';   // مدين: يسدد للمورد ويقلل المستحق له
    case CREDIT = 'credit'; // دائن: يزيد المبلغ المستحق للمورد

    public function label(): string
    {
        return match ($this) {
            self::DEBIT => 'مدين (سداد / تقليل المستحق)',
            self::CREDIT => 'دائن (توريد / زيادة المستحق)',
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
