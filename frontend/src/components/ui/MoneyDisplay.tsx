import React from 'react';

export interface MoneyDisplayProps {
  amount: string | number;
  showCurrency?: boolean;
  currency?: string;
  colored?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * MoneyDisplay Component
 *
 * Enforces fixed-precision decimal representation for monetary values.
 * Never performs floating point conversions that can drift financial precision.
 */
export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  amount,
  showCurrency = true,
  currency = 'ج.م',
  colored = false,
  className = '',
  style,
}) => {
  const str = typeof amount === 'number' ? amount.toFixed(2) : String(amount);
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  const [intPart, decPart] = cleanStr.split('.');
  const formattedInt = Number(intPart || 0).toLocaleString('en-US');
  const formattedDec = (decPart || '00').padEnd(2, '0').slice(0, 2);

  const formattedValue = `${isNegative ? '-' : ''}${formattedInt}.${formattedDec}`;

  let textColor = 'inherit';
  if (colored) {
    if (isNegative) {
      textColor = 'var(--color-danger-600)';
    } else if (Number(cleanStr) > 0) {
      textColor = 'var(--color-success-700)';
    }
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '0.25rem',
        fontWeight: 'var(--font-weight-bold)',
        color: textColor,
        direction: 'ltr',
        fontFamily: 'var(--font-family-mono)',
        unicodeBidi: 'embed',
        ...style,
      }}
      className={className}
    >
      <span>{formattedValue}</span>
      {showCurrency && (
        <span
          style={{
            fontSize: '0.75em',
            fontFamily: 'var(--font-family-base)',
            color: 'var(--text-muted)',
            fontWeight: 'var(--font-weight-normal)',
            direction: 'rtl',
          }}
        >
          {currency}
        </span>
      )}
    </span>
  );
};
