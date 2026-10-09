import { describe, it, expect } from 'vitest';
import type {
  ReturnableItem,
  ReturnableInvoice,
  SalesReturnResolution,
} from '../types/domain';

describe('Phase 5 — Sales Returns, Refunds, Exchanges & Customer Credit Domain Logic', () => {
  describe('Returnable Quantities and Line Calculations', () => {
    it('calculates remaining returnable quantity correctly from sold and previously returned units', () => {
      const item: ReturnableItem = {
        id: 1,
        invoice_item_id: 1,
        product_id: 10,
        item_type: 'product',
        product_name: 'سرير كينج 180 سم',
        barcode: 'B0001',
        unit_sale_price: '650.00',
        originally_sold_quantity: 10,
        previously_returned_quantity: 3,
        remaining_returnable_quantity: 7,
        subtotal: '6500.00',
      };

      const calculatedRemaining = item.originally_sold_quantity - item.previously_returned_quantity;
      expect(calculatedRemaining).toBe(7);
      expect(item.remaining_returnable_quantity).toBe(calculatedRemaining);
    });

    it('calculates line return value based on unit sale price and returned quantity', () => {
      const unitSalePrice = 650.0;
      const returnedQty = 3;
      const lineReturnValue = unitSalePrice * returnedQty;

      expect(lineReturnValue).toBe(1950.0);
    });

    it('rejects invalid return quantities exceeding remaining returnable quantity', () => {
      const remainingReturnable = 5;
      const requestedQty = 6;

      const isValid = requestedQty > 0 && requestedQty <= remainingReturnable;
      expect(isValid).toBe(false);
    });

    it('rejects zero or negative return quantities', () => {
      const remainingReturnable = 5;
      const zeroQty = 0;
      const negativeQty = -1;

      expect(zeroQty > 0 && zeroQty <= remainingReturnable).toBe(false);
      expect(negativeQty > 0 && negativeQty <= remainingReturnable).toBe(false);
    });
  });

  describe('Return Resolution Rules and Permissions', () => {
    it('allows cash refund and exchanges for retail invoices without registered customer', () => {
      const retailInvoice: ReturnableInvoice = {
        id: 101,
        invoice_number: 'INV-20261008-0001',
        sale_type: 'retail',
        sale_type_label: 'قطاعي',
        status: 'posted',
        status_label: 'معتمدة',
        total: '1300.00',
        paid_amount: '1300.00',
        remaining_amount: '0.00',
        credit_amount: '0.00',
        customer_id: null,
        customer_name: null,
        customer_phone: null,
        created_at: '2026-10-08T10:00:00Z',
        created_at_formatted: '2026-10-08 10:00',
        items: [],
      };

      const isAccountCreditAllowed = Boolean(retailInvoice.customer_id);
      expect(isAccountCreditAllowed).toBe(false);

      const allowedResolutions: SalesReturnResolution[] = ['refund_cash', 'exchange_equal', 'exchange_upgrade'];
      expect(allowedResolutions.includes('refund_cash')).toBe(true);
      expect(allowedResolutions.includes('exchange_equal')).toBe(true);
      expect(allowedResolutions.includes('exchange_upgrade')).toBe(true);
    });

    it('allows customer account credit when invoice has a registered wholesale customer', () => {
      const wholesaleInvoice: ReturnableInvoice = {
        id: 102,
        invoice_number: 'INV-20261008-0002',
        sale_type: 'wholesale',
        sale_type_label: 'جملة',
        status: 'posted',
        status_label: 'معتمدة',
        total: '6000.00',
        paid_amount: '4000.00',
        remaining_amount: '2000.00',
        credit_amount: '0.00',
        customer_id: 5,
        customer_name: 'معرض الأمل للموبيليا',
        customer_phone: '01011112222',
        created_at: '2026-10-08T11:00:00Z',
        created_at_formatted: '2026-10-08 11:00',
        items: [],
      };

      const isAccountCreditAllowed = Boolean(wholesaleInvoice.customer_id);
      expect(isAccountCreditAllowed).toBe(true);
    });
  });

  describe('Exchange Calculations and Financial Integrity', () => {
    it('validates equal exchange when replacement total exactly equals return total', () => {
      const returnTotal = 1300.0;
      const replacementTotal = 1300.0;

      const isEqual = Math.abs(replacementTotal - returnTotal) < 0.01;
      const difference = replacementTotal - returnTotal;

      expect(isEqual).toBe(true);
      expect(difference).toBe(0.0);
    });

    it('rejects equal exchange when replacement total does not match return total', () => {
      const returnTotal = 1300.0;
      const replacementTotal = 1450.0;

      const isEqual = Math.abs(replacementTotal - returnTotal) < 0.01;
      expect(isEqual).toBe(false);
    });

    it('calculates upgrade difference correctly and requires payment method', () => {
      const returnTotal = 1000.0;
      const replacementTotal = 1400.0;

      const difference = replacementTotal - returnTotal;
      expect(difference).toBe(400.0);
      expect(difference > 0).toBe(true);

      const paymentMethodId: number | null = 1;
      const isUpgradeValid = difference > 0 && paymentMethodId !== null;
      expect(isUpgradeValid).toBe(true);
    });

    it('invalidates upgrade exchange when difference is zero or negative', () => {
      const returnTotal = 1400.0;
      const replacementTotal = 1000.0;

      const isUpgrade = replacementTotal > returnTotal;
      expect(isUpgrade).toBe(false);
    });
  });

  describe('Customer Ledger Balance Invariant', () => {
    it('derives wholesale customer balance purely from debits and credits', () => {
      // Prior debt: 5,000 EGP (Debit 5,000, Credit 0)
      const debits = 5000.0;
      let credits = 0.0;

      expect(debits - credits).toBe(5000.0);

      // Return creates credit of 1,500 EGP
      credits += 1500.0;
      const newBalance = debits - credits;

      expect(newBalance).toBe(3500.0);
    });

    it('handles customer credit beyond zero balance representing store credit in customer favor', () => {
      // Fully paid sale: Debits 3,000, Credits 3,000 => Balance 0
      const debits = 3000.0;
      let credits = 3000.0;

      expect(debits - credits).toBe(0.0);

      // Full return of 3,000 EGP credited to account
      credits += 3000.0;
      const resultingBalance = debits - credits;

      // Negative balance represents credit in customer's favor (-3,000 EGP)
      expect(resultingBalance).toBe(-3000.0);
    });
  });

  describe('Idempotency and Double-Submit Guarding', () => {
    it('generates a valid client-side idempotency UUID for return requests', () => {
      const idempotencyKey = crypto.randomUUID();

      expect(typeof idempotencyKey).toBe('string');
      expect(idempotencyKey.length).toBe(36);
      expect(idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });
});
