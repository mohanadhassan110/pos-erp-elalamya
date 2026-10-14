import { describe, it, expect } from 'vitest';
import {
  LABEL_FORMATS,
  LABEL_FORMAT_ORDER,
  A4_WIDTH_MM,
  chunkIntoSheets,
  pageRuleFor,
} from '../features/barcodes/labelFormats';

describe('Phase 15-E — Barcode label formats', () => {
  it('offers thermal 50×25, thermal 38×25, A4 3-column and A4 4-column formats', () => {
    expect(LABEL_FORMAT_ORDER).toEqual(['thermal-50x25', 'thermal-38x25', 'a4-3x7', 'a4-4x8']);
    expect([LABEL_FORMATS['thermal-50x25'].widthMm, LABEL_FORMATS['thermal-50x25'].heightMm]).toEqual([50, 25]);
    expect([LABEL_FORMATS['thermal-38x25'].widthMm, LABEL_FORMATS['thermal-38x25'].heightMm]).toEqual([38, 25]);
    expect(LABEL_FORMATS['a4-3x7'].perSheet).toBe(21);
    expect(LABEL_FORMATS['a4-4x8'].perSheet).toBe(32);
  });

  it('fits every A4 grid inside the 210×297 mm page', () => {
    for (const id of ['a4-3x7', 'a4-4x8'] as const) {
      const f = LABEL_FORMATS[id];
      expect(f.columns * f.rows).toBe(f.perSheet);
      expect(f.columns * f.widthMm).toBeLessThanOrEqual(A4_WIDTH_MM);
      expect(f.rows * f.heightMm).toBeLessThanOrEqual(297);
    }
  });

  it('prints one thermal label per page and splits A4 labels into full sheets', () => {
    const labels = Array.from({ length: 45 }, (_, i) => i);
    expect(chunkIntoSheets(labels, LABEL_FORMATS['thermal-50x25'])).toHaveLength(45);
    const a4 = chunkIntoSheets(labels, LABEL_FORMATS['a4-3x7']);
    expect(a4.map((s) => s.length)).toEqual([21, 21, 3]);
    expect(chunkIntoSheets(labels, LABEL_FORMATS['a4-4x8']).map((s) => s.length)).toEqual([32, 13]);
    expect(chunkIntoSheets([], LABEL_FORMATS['a4-4x8'])).toEqual([]);
  });

  it('emits a borderless @page rule matching the physical label or A4 sheet', () => {
    expect(pageRuleFor(LABEL_FORMATS['thermal-50x25'])).toBe('@page { size: 50mm 25mm; margin: 0; }');
    expect(pageRuleFor(LABEL_FORMATS['thermal-38x25'])).toBe('@page { size: 38mm 25mm; margin: 0; }');
    expect(pageRuleFor(LABEL_FORMATS['a4-4x8'])).toBe('@page { size: A4 portrait; margin: 0; }');
  });
});
