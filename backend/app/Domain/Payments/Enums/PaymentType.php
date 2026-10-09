<?php

namespace App\Domain\Payments\Enums;

enum PaymentType: string
{
    case INVOICE_PAYMENT = 'invoice_payment';
    case CUSTOMER_PAYMENT = 'customer_payment';
    case SUPPLIER_PAYMENT = 'supplier_payment';
    case REFUND = 'refund';
    case EXCHANGE_PAYMENT = 'exchange_payment';
    case OTHER = 'other';

    public function label(): string
    {
        return match ($this) {
            self::INVOICE_PAYMENT => 'دفعة فاتورة مبيعات',
            self::CUSTOMER_PAYMENT => 'سداد عميل على الحساب',
            self::SUPPLIER_PAYMENT => 'سداد للمورد',
            self::REFUND => 'استرداد نقدي لمرتجع',
            self::EXCHANGE_PAYMENT => 'سداد فارق استبدال',
            self::OTHER => 'دفعة أخرى',
        };
    }
}
