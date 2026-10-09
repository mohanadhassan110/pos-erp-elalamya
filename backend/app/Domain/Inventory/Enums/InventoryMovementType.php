<?php

namespace App\Domain\Inventory\Enums;

enum InventoryMovementType: string
{
    case STOCK_RECEIPT = 'stock_receipt';           // استلام بضاعة وارد (+)
    case SALE = 'sale';                             // صرف فاتورة مبيعات (-)
    case SALE_CANCELLATION = 'sale_cancellation';   // استرجاع لإلغاء فاتورة مبيعات (+)
    case SALES_RETURN = 'sales_return';             // مرتجع مبيعات (+)
    case ADJUSTMENT = 'adjustment';                 // تسوية جردية (+ أو -)

    public function label(): string
    {
        return match ($this) {
            self::STOCK_RECEIPT => 'استلام بضاعة / وارد',
            self::SALE => 'صرف مبيعات',
            self::SALE_CANCELLATION => 'إلغاء فاتورة مبيعات (استعادة مخزون)',
            self::SALES_RETURN => 'مرتجع مبيعات',
            self::ADJUSTMENT => 'تسوية جردية',
        };
    }

    public function isStockAddition(): bool
    {
        return in_array($this, [self::STOCK_RECEIPT, self::SALE_CANCELLATION, self::SALES_RETURN], true);
    }

    public function isStockDeduction(): bool
    {
        return $this === self::SALE;
    }
}
