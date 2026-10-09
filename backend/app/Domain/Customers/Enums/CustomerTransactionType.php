<?php

namespace App\Domain\Customers\Enums;

enum CustomerTransactionType: string
{
    case INVOICE = 'invoice';
    case PAYMENT = 'payment';
    case RETURN = 'return';
    case REFUND = 'refund';
    case CREDIT = 'credit';
    case ADJUSTMENT = 'adjustment';

    public function label(): string
    {
        return match ($this) {
            self::INVOICE => 'فاتورة مبيعات جملة',
            self::PAYMENT => 'دفعة / سداد عميل',
            self::RETURN => 'مرتجع مبيعات',
            self::REFUND => 'استرداد نقدي لمرتجع',
            self::CREDIT => 'رصيد دائن إضافي',
            self::ADJUSTMENT => 'تسوية حساب',
        };
    }
}
