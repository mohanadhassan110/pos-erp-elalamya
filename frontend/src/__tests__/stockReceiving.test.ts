import { describe, it, expect } from 'vitest';

describe('Phase 3 — Master Data & Stock Receiving Calculations and Domain Rules', () => {
  describe('Stock Receiving Line and Total Calculations', () => {
    it('calculates line subtotal using fixed decimal precision', () => {
      const calculateSubtotal = (quantity: number, unitCost: string): string => {
        const qty = Math.floor(quantity);
        const costCents = Math.round(parseFloat(unitCost || '0') * 100);
        const subtotalCents = qty * costCents;
        return (subtotalCents / 100).toFixed(2);
      };

      expect(calculateSubtotal(3, '450.00')).toBe('1350.00');
      expect(calculateSubtotal(10, '125.50')).toBe('1255.00');
      expect(calculateSubtotal(0, '500.00')).toBe('0.00');
    });

    it('calculates receipt grand total across multiple items', () => {
      const items = [
        { quantity: 2, unit_cost: '500.00' },
        { quantity: 5, unit_cost: '250.50' },
        { quantity: 1, unit_cost: '1000.00' },
      ];

      const grandTotalCents = items.reduce((sum, item) => {
        const costCents = Math.round(parseFloat(item.unit_cost) * 100);
        return sum + item.quantity * costCents;
      }, 0);

      const grandTotal = (grandTotalCents / 100).toFixed(2);
      // 2 * 500 = 1000, 5 * 250.50 = 1252.50, 1 * 1000 = 1000 -> Total = 3252.50
      expect(grandTotal).toBe('3252.50');
    });
  });

  describe('Category Code Rules', () => {
    it('validates and normalizes single uppercase Latin letter', () => {
      const isValidCategoryCode = (code: string): boolean => {
        return /^[A-Za-z]$/.test(code.trim());
      };

      const normalizeCategoryCode = (code: string): string => {
        return code.trim().toUpperCase();
      };

      expect(isValidCategoryCode('b')).toBe(true);
      expect(normalizeCategoryCode('b')).toBe('B');
      expect(isValidCategoryCode('Z')).toBe(true);
      expect(isValidCategoryCode('AB')).toBe(false);
      expect(isValidCategoryCode('1')).toBe(false);
      expect(isValidCategoryCode('أ')).toBe(false);
      expect(isValidCategoryCode('')).toBe(false);
    });
  });

  describe('Customer Balance Status Mapping', () => {
    it('maps balance sign to Arabic operational business status', () => {
      const getBalanceStatus = (balance: number) => {
        if (balance > 0) return { status: 'debt', label: 'مستحق على العميل' };
        if (balance < 0) return { status: 'credit', label: 'رصيد دائن للعميل' };
        return { status: 'settled', label: 'خالص' };
      };

      expect(getBalanceStatus(1500).status).toBe('debt');
      expect(getBalanceStatus(1500).label).toBe('مستحق على العميل');

      expect(getBalanceStatus(-500).status).toBe('credit');
      expect(getBalanceStatus(-500).label).toBe('رصيد دائن للعميل');

      expect(getBalanceStatus(0).status).toBe('settled');
      expect(getBalanceStatus(0).label).toBe('خالص');
    });
  });

  describe('Inventory Valuation Rule', () => {
    it('calculates current stock valuation as current_stock × current_purchase_cost', () => {
      const calculateValuation = (currentStock: number, currentCost: string): string => {
        const costCents = Math.round(parseFloat(currentCost) * 100);
        const valuationCents = currentStock * costCents;
        return (valuationCents / 100).toFixed(2);
      };

      expect(calculateValuation(15, '600.00')).toBe('9000.00');
      expect(calculateValuation(0, '450.00')).toBe('0.00');
    });
  });
});
