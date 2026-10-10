import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatNumber,
  formatQuantity,
  formatDateTime,
  formatDate,
  CURRENCY_SYMBOL,
} from '../utils/formatters';

describe('Authoritative Formatting Module (Task 2)', () => {
  describe('formatCurrency', () => {
    it('formats positive amount with thousands separator, two decimals and ج.م', () => {
      expect(formatCurrency(6050)).toBe('6,050.00 ج.م');
      expect(formatCurrency('6050.00')).toBe('6,050.00 ج.م');
    });

    it('formats large numbers accurately', () => {
      expect(formatCurrency(1250000.5)).toBe('1,250,000.50 ج.م');
      expect(formatCurrency(99999999.99)).toBe('99,999,999.99 ج.م');
    });

    it('formats exact zero', () => {
      expect(formatCurrency(0)).toBe('0.00 ج.م');
      expect(formatCurrency('0')).toBe('0.00 ج.م');
      expect(formatCurrency(null)).toBe('0.00 ج.م');
      expect(formatCurrency(undefined)).toBe('0.00 ج.م');
    });

    it('formats negative amounts with minus sign before numbers', () => {
      expect(formatCurrency(-350.25)).toBe('-350.25 ج.م');
      expect(formatCurrency(-1500)).toBe('-1,500.00 ج.م');
    });

    it('handles mathematical rounding correctly', () => {
      expect(formatCurrency(100.556)).toBe('100.56 ج.م');
      expect(formatCurrency(100.554)).toBe('100.55 ج.م');
    });

    it('omits currency symbol when requested', () => {
      expect(formatCurrency(6050, false)).toBe('6,050.00');
    });

    it('uses Western digits exclusively (0-9) and never Arabic-Indic digits', () => {
      const formatted = formatCurrency(1234567890);
      expect(formatted).toMatch(/^[0-9,.]+\sج\.م$/);
      // Ensure no Arabic-Indic digits (\u0660 - \u0669)
      expect(/[\u0660-\u0669]/.test(formatted)).toBe(false);
    });

    it('contains the official showroom currency symbol ج.م', () => {
      expect(CURRENCY_SYMBOL).toBe('ج.م');
      expect(formatCurrency(100)).toContain('ج.م');
    });
  });

  describe('formatNumber & formatQuantity', () => {
    it('formats numbers with customizable decimals', () => {
      expect(formatNumber(1234.567, 1)).toBe('1,234.6');
      expect(formatNumber(1234.567, 3)).toBe('1,234.567');
      expect(formatNumber(1234, 0)).toBe('1,234');
    });

    it('formats whole integer quantities', () => {
      expect(formatQuantity(1500)).toBe('1,500');
      expect(formatQuantity(4)).toBe('4');
      expect(formatQuantity(0)).toBe('0');
      expect(formatQuantity(12.8)).toBe('13'); // integer rounded
    });
  });

  describe('formatDateTime & formatDate', () => {
    it('formats date and time in DD/MM/YYYY HH:mm standard format', () => {
      const date = new Date(2026, 9, 10, 14, 45); // Oct 10, 2026 14:45
      expect(formatDateTime(date)).toBe('10/10/2026 14:45');
    });

    it('formats date-only in DD/MM/YYYY standard format', () => {
      const date = new Date(2026, 9, 10);
      expect(formatDate(date)).toBe('10/10/2026');
    });

    it('handles null and invalid inputs gracefully', () => {
      expect(formatDateTime(null)).toBe('-');
      expect(formatDateTime(undefined)).toBe('-');
      expect(formatDate(null)).toBe('-');
    });
  });
});
