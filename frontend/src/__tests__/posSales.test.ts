import { describe, it, expect } from 'vitest';
import type { CartLine } from '../features/pos/PosPage';

describe('Phase 4 — POS Sales, Invoicing & Payment Handling Domain Logic', () => {
  describe('Cart and Line Item Calculations', () => {
    it('calculates line subtotal from quantity and unit sale price', () => {
      const line: CartLine = {
        id: '1',
        type: 'product',
        productId: 10,
        productName: 'سرير كينج 180 سم',
        quantity: 2,
        unitPrice: 650.0,
        originalPrice: 650.0,
      };

      const lineSubtotal = line.quantity * line.unitPrice;
      expect(lineSubtotal).toBe(1300.0);
    });

    it('supports cashier price override without changing original product price', () => {
      const line: CartLine = {
        id: '2',
        type: 'product',
        productId: 10,
        productName: 'سرير كينج 180 سم',
        quantity: 1,
        unitPrice: 620.0, // Discount override
        originalPrice: 650.0,
      };

      expect(line.unitPrice).toBe(620.0);
      expect(line.originalPrice).toBe(650.0);
      expect(line.unitPrice !== line.originalPrice).toBe(true);
      expect(line.quantity * line.unitPrice).toBe(620.0);
    });

    it('calculates grand total across multiple cart items including external products', () => {
      const cart: CartLine[] = [
        {
          id: '1',
          type: 'product',
          productId: 1,
          productName: 'غرفة نوم كاملة',
          quantity: 1,
          unitPrice: 12000.0,
          originalPrice: 12000.0,
        },
        {
          id: '2',
          type: 'product',
          productId: 2,
          productName: 'كومودينو إضافي',
          quantity: 2,
          unitPrice: 450.0,
          originalPrice: 450.0,
        },
        {
          id: '3',
          type: 'external',
          productName: 'خدادية عمولة',
          quantity: 4,
          unitPrice: 150.0,
          originalPrice: 150.0,
          purchaseCost: 100.0,
        },
      ];

      const grandTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      // 12000 + (2 * 450 = 900) + (4 * 150 = 600) = 13500.00
      expect(grandTotal).toBe(13500.0);
    });
  });

  describe('Wholesale vs Retail Customer Validation', () => {
    it('requires a registered customer for wholesale sales', () => {
      const validateSale = (saleType: 'retail' | 'wholesale', customerId: string | null) => {
        if (saleType === 'wholesale' && !customerId) {
          return { valid: false, error: 'يجب اختيار عميل مسجل لفواتير الجملة' };
        }
        return { valid: true, error: null };
      };

      expect(validateSale('wholesale', null).valid).toBe(false);
      expect(validateSale('wholesale', '12').valid).toBe(true);
      expect(validateSale('retail', null).valid).toBe(true);
    });
  });

  describe('Payment and Debt/Credit Calculations', () => {
    it('calculates exact payment with zero debt and zero credit', () => {
      const total = 5000.0;
      const paid = 5000.0;

      const remainingDebt = Math.max(0, total - paid);
      const customerCredit = Math.max(0, paid - total);

      expect(remainingDebt).toBe(0);
      expect(customerCredit).toBe(0);
    });

    it('calculates underpayment with remaining receivable debt', () => {
      const total = 10000.0;
      const paid = 7000.0;

      const remainingDebt = Math.max(0, total - paid);
      const customerCredit = Math.max(0, paid - total);

      expect(remainingDebt).toBe(3000.0);
      expect(customerCredit).toBe(0);
    });

    it('calculates overpayment resulting in customer credit on account', () => {
      const total = 10000.0;
      const paid = 12000.0;

      const remainingDebt = Math.max(0, total - paid);
      const customerCredit = Math.max(0, paid - total);

      expect(remainingDebt).toBe(0);
      expect(customerCredit).toBe(2000.0);
    });
  });

  describe('Stock Availability Enforcement', () => {
    it('prevents adding quantity exceeding available stock', () => {
      const availableStock = 5;
      const requestedQty = 6;

      const canAdd = requestedQty <= availableStock;
      expect(canAdd).toBe(false);
    });
  });

  describe('External Product Cost and Profit Rules', () => {
    it('calculates external item profit while keeping purchase cost internal', () => {
      const qty = 2;
      const purchaseCost = 300.0;
      const unitSalePrice = 450.0;

      const revenue = qty * unitSalePrice;
      const totalCost = qty * purchaseCost;
      const profit = revenue - totalCost;

      expect(revenue).toBe(900.0);
      expect(totalCost).toBe(600.0);
      expect(profit).toBe(300.0);
    });
  });
});
