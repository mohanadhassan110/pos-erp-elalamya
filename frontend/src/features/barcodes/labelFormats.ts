/**
 * Physical label formats for barcode printing. Sizes are in millimetres and are
 * used both for the on-screen preview and for the @media print output.
 */
export type LabelFormatId = 'thermal-50x25' | 'thermal-38x25' | 'a4-3x7' | 'a4-4x8';

export interface LabelTypography {
  headerFontPx: number;
  nameFontPx: number;
  priceFontPx: number;
  barHeightPx: number;
  moduleWidthPx: number;
  barTextFontPx: number;
}

export interface LabelFormat {
  id: LabelFormatId;
  kind: 'thermal' | 'a4';
  title: string;
  description: string;
  widthMm: number;
  heightMm: number;
  columns: number;
  rows: number;
  /** Labels per printed page (1 for thermal rolls). */
  perSheet: number;
  typography: LabelTypography;
}

export const A4_WIDTH_MM = 210;

export const LABEL_FORMATS: Record<LabelFormatId, LabelFormat> = {
  'thermal-50x25': {
    id: 'thermal-50x25',
    kind: 'thermal',
    title: 'رول حراري 50×25 مم',
    description: 'طابعة باركود حرارية — ملصق مفرد لكل صفحة',
    widthMm: 50,
    heightMm: 25,
    columns: 1,
    rows: 1,
    perSheet: 1,
    typography: { headerFontPx: 8, nameFontPx: 10, priceFontPx: 10, barHeightPx: 24, moduleWidthPx: 1, barTextFontPx: 9 },
  },
  'thermal-38x25': {
    id: 'thermal-38x25',
    kind: 'thermal',
    title: 'رول حراري 38×25 مم',
    description: 'رول ضيق للأصناف الصغيرة — ملصق مفرد لكل صفحة',
    widthMm: 38,
    heightMm: 25,
    columns: 1,
    rows: 1,
    perSheet: 1,
    typography: { headerFontPx: 7, nameFontPx: 9, priceFontPx: 9, barHeightPx: 22, moduleWidthPx: 0.9, barTextFontPx: 8 },
  },
  'a4-3x7': {
    id: 'a4-3x7',
    kind: 'a4',
    title: 'ورق A4 بثلاثة أعمدة (21 ملصق)',
    description: 'ورق A4 لاصق 3×7، ملصق 70×42.3 مم',
    widthMm: 70,
    heightMm: 42.3,
    columns: 3,
    rows: 7,
    perSheet: 21,
    typography: { headerFontPx: 9, nameFontPx: 12, priceFontPx: 12, barHeightPx: 34, moduleWidthPx: 1.3, barTextFontPx: 10 },
  },
  'a4-4x8': {
    id: 'a4-4x8',
    kind: 'a4',
    title: 'ورق A4 بأربعة أعمدة (32 ملصق)',
    description: 'ورق A4 لاصق 4×8، ملصق 52.5×37.1 مم',
    widthMm: 52.5,
    heightMm: 37.1,
    columns: 4,
    rows: 8,
    perSheet: 32,
    typography: { headerFontPx: 8, nameFontPx: 10, priceFontPx: 10, barHeightPx: 28, moduleWidthPx: 1.05, barTextFontPx: 9 },
  },
};

export const LABEL_FORMAT_ORDER: LabelFormatId[] = ['thermal-50x25', 'thermal-38x25', 'a4-3x7', 'a4-4x8'];

/** Splits labels into printed pages (sheets) for the given format. */
export const chunkIntoSheets = <T>(labels: T[], format: LabelFormat): T[][] => {
  const sheets: T[][] = [];
  for (let i = 0; i < labels.length; i += format.perSheet) {
    sheets.push(labels.slice(i, i + format.perSheet));
  }
  return sheets;
};

/** @page rule for the active format; injected only while the barcode page has labels to print. */
export const pageRuleFor = (format: LabelFormat): string =>
  format.kind === 'thermal'
    ? `@page { size: ${format.widthMm}mm ${format.heightMm}mm; margin: 0; }`
    : '@page { size: A4 portrait; margin: 0; }';

export const MAX_LABELS_PER_BATCH = 1000;
