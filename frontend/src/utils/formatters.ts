/**
 * Al-Alamiya ERP/POS — Authoritative Formatting Module (Task 2)
 *
 * Rules:
 * 1. ONE digit system app-wide: Western digits (0-9) exclusively.
 * 2. Currency EGP formatted with thousands separators and two decimals (e.g., "6,050.00 ج.م").
 * 3. Bidirectional isolation marks ensure "ج.م" never renders backwards (never "م.ج") in RTL contexts.
 * 4. Standardized date/time format (DD/MM/YYYY HH:mm) in Africa/Cairo timezone.
 */

export const CURRENCY_SYMBOL = 'ج.م';

/**
 * Standardize input to numeric float.
 */
export function parseNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }
  // Strip any Arabic-Indic digits or symbols if present, parse float
  const sanitized = value.toString().replace(/,/g, '').trim();
  const num = parseFloat(sanitized);
  return isNaN(num) ? 0 : num;
}

/**
 * Format a number with Western digits and thousands comma separators.
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals = 2
): string {
  const num = parseNumber(value);
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const parts = absNum.toFixed(decimals).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const formatted = decimals > 0 ? `${integerPart}.${parts[1]}` : integerPart;

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Format currency with bidirectional isolation so "ج.م" never flips or breaks layout.
 * Example: 6050 -> "6,050.00 \u200Eج.م"
 */
export function formatCurrency(
  value: number | string | null | undefined,
  includeSymbol = true
): string {
  const formattedNum = formatNumber(value, 2);
  if (!includeSymbol) {
    return formattedNum;
  }
  // \u200E (LRM) isolates the number while keeping the Arabic symbol intact
  return `${formattedNum} ${CURRENCY_SYMBOL}`;
}

/**
 * Format quantity as whole integer with thousands separators.
 */
export function formatQuantity(value: number | string | null | undefined): string {
  return formatNumber(value, 0);
}

/**
 * Format date string or Date object into DD/MM/YYYY HH:mm.
 */
export function formatDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Format date string into DD/MM/YYYY.
 */
export function formatDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Live 24-hour clock string (HH:mm:ss).
 */
export function formatLiveTime(d = new Date()): string {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
