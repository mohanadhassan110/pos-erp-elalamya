<?php

namespace App\Domain\Returns\Enums;

enum SalesReturnResolution: string
{
    case REFUND_CASH = 'refund_cash';                       // استرداد المبلغ نقداً
    case EXCHANGE_EQUAL = 'exchange_equal';                 // استبدال ببضاعة بنفس القيمة
    case EXCHANGE_UPGRADE = 'exchange_upgrade';             // استبدال بقيمة أعلى وتحصيل الفرق
    case CUSTOMER_ACCOUNT_CREDIT = 'customer_account_credit'; // خصم من حساب العميل / إضافة رصيد دائن

    public function label(): string
    {
        return match ($this) {
            self::REFUND_CASH => 'استرداد نقدي',
            self::EXCHANGE_EQUAL => 'استبدال ببضاعة بنفس القيمة',
            self::EXCHANGE_UPGRADE => 'استبدال بقيمة أعلى وتحصيل الفرق',
            self::CUSTOMER_ACCOUNT_CREDIT => 'إضافة كرصيد دائن لحساب العميل',
        };
    }
}
