<?php

namespace App\Domain\Suppliers\Enums;

enum SupplierTransactionType: string
{
    case STOCK_RECEIPT = 'stock_receipt';                     // استلام بضاعة فعلي
    case PAYMENT = 'payment';                                   // سداد دفعة للمورد
    case MANUAL_BALANCE_INCREASE = 'manual_balance_increase';   // زيادة رصيد دائنية يدوية
    case ADJUSTMENT = 'adjustment';                             // تسوية حساب

    public function label(): string
    {
        return match ($this) {
            self::STOCK_RECEIPT => 'استلام بضاعة / توريد',
            self::PAYMENT => 'سداد دفعة للمورد',
            self::MANUAL_BALANCE_INCREASE => 'إضافة رصيد مستحق (فاتورة خارجية)',
            self::ADJUSTMENT => 'تسوية حساب مورد',
        };
    }
}
