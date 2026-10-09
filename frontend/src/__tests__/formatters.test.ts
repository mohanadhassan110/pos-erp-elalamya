import { describe, it, expect } from 'vitest';

describe('Financial and Quantity Invariants (Frontend)', () => {
  it('formats fixed decimal monetary amounts safely', () => {
    const formatMoney = (amount: string | number): string => {
      const str = typeof amount === 'number' ? amount.toFixed(2) : String(amount);
      const isNegative = str.startsWith('-');
      const cleanStr = isNegative ? str.slice(1) : str;

      const [intPart, decPart] = cleanStr.split('.');
      const formattedInt = Number(intPart || 0).toLocaleString('en-US');
      const formattedDec = (decPart || '00').padEnd(2, '0').slice(0, 2);

      return `${isNegative ? '-' : ''}${formattedInt}.${formattedDec}`;
    };

    expect(formatMoney('12500.50')).toBe('12,500.50');
    expect(formatMoney('0')).toBe('0.00');
    expect(formatMoney('-450.75')).toBe('-450.75');
    expect(formatMoney(350)).toBe('350.00');
  });

  it('validates whole number quantities without decimals', () => {
    const isWholeQuantity = (val: string | number): boolean => {
      const str = String(val).trim();
      return /^-?\d+$/.test(str);
    };

    expect(isWholeQuantity(5)).toBe(true);
    expect(isWholeQuantity('42')).toBe(true);
    expect(isWholeQuantity('3.5')).toBe(false);
    expect(isWholeQuantity('abc')).toBe(false);
  });
});
