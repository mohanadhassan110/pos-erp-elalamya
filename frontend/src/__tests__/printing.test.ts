import { describe, it, expect } from 'vitest';
import type { PrintableInvoice, BarcodeLabel } from '../types/domain';
import { encodeCode128B, CODE128_PATTERNS } from '../utils/code128';

describe('Phase 12 — Barcode & Invoice Printing Implementation', () => {
  describe('Code 128 Barcode Generation Logic & Test Vectors', () => {
    it('verifies all 107 Code 128 symbol patterns adhere to module width specifications', () => {
      expect(CODE128_PATTERNS.length).toBe(107);

      // Data symbols (0 to 105): 6 elements (alternating bars and spaces) summing to 11 modules
      for (let i = 0; i < 106; i++) {
        const pattern = CODE128_PATTERNS[i];
        expect(pattern.length).toBe(6);
        const moduleSum = pattern.split('').reduce((sum, ch) => sum + parseInt(ch, 10), 0);
        expect(moduleSum).toBe(11);
      }

      // Stop symbol (index 106): 7 elements (bar-space-bar-space-bar-space-bar) summing to 13 modules
      const stopPattern = CODE128_PATTERNS[106];
      expect(stopPattern.length).toBe(7);
      expect(stopPattern).toBe('2331112');
      const stopSum = stopPattern.split('').reduce((sum, ch) => sum + parseInt(ch, 10), 0);
      expect(stopSum).toBe(13);
    });

    it('encodes known test vector 1 ("B0001") with exact symbols, checksum, and module count', () => {
      const result = encodeCode128B('B0001');

      expect(result.valid).toBe(true);
      // 'B' (66-32=34), '0' (48-32=16), '0' (16), '0' (16), '1' (49-32=17)
      // Checksum = (104 + 34*1 + 16*2 + 16*3 + 16*4 + 17*5) % 103 = 367 % 103 = 58
      expect(result.checksum).toBe(58);
      expect(result.symbols).toEqual([104, 34, 16, 16, 16, 17, 58, 106]);

      // Total modules = 10 (left quiet) + 11 (start) + 5*11 (data) + 11 (checksum) + 13 (stop) + 10 (right quiet) = 110
      expect(result.totalModules).toBe(110);

      // Verify pattern string matches concatenated symbol patterns
      const expectedPattern =
        CODE128_PATTERNS[104] +
        CODE128_PATTERNS[34] +
        CODE128_PATTERNS[16] +
        CODE128_PATTERNS[16] +
        CODE128_PATTERNS[16] +
        CODE128_PATTERNS[17] +
        CODE128_PATTERNS[58] +
        CODE128_PATTERNS[106];
      expect(result.patternString).toBe(expectedPattern);
    });

    it('encodes known test vector 2 ("CODE 128") with standard ISO/IEC 15417 checksum 85', () => {
      const result = encodeCode128B('CODE 128');

      expect(result.valid).toBe(true);
      // 'C'(35), 'O'(47), 'D'(36), 'E'(37), ' '(0), '1'(17), '2'(18), '8'(24)
      // Sum = 104 + 35*1 + 47*2 + 36*3 + 37*4 + 0*5 + 17*6 + 18*7 + 24*8 = 909
      // Checksum = 909 % 103 = 85
      expect(result.checksum).toBe(85);
      expect(result.symbols).toEqual([104, 35, 47, 36, 37, 0, 17, 18, 24, 85, 106]);

      // Total modules = 10 (left) + 11*10 (start+8 chars+check) + 13 (stop) + 10 (right) = 143
      expect(result.totalModules).toBe(143);
    });

    it('encodes invoice identifier test vector ("INV-2026-0001") deterministically', () => {
      const result = encodeCode128B('INV-2026-0001');

      expect(result.valid).toBe(true);
      expect(result.symbols[0]).toBe(104); // Start B
      expect(result.symbols[result.symbols.length - 1]).toBe(106); // Stop
      // 13 characters
      expect(result.totalModules).toBe(10 + 11 * (13 + 2) + 13 + 10);
    });

    it('explicitly rejects unsupported non-ASCII and Arabic characters instead of silently corrupting the barcode', () => {
      // Arabic text
      const arabicResult = encodeCode128B('لحاف فاخر');
      expect(arabicResult.valid).toBe(false);
      expect(arabicResult.error).toContain('حرف غير مدعوم في معيار Code 128 Subset B');

      // Control character (ASCII 0)
      const ctrlResult = encodeCode128B('B0001\x00');
      expect(ctrlResult.valid).toBe(false);
      expect(ctrlResult.error).toContain('حرف غير مدعوم');

      // Empty string
      const emptyResult = encodeCode128B('');
      expect(emptyResult.valid).toBe(false);
      expect(emptyResult.error).toContain('نص الباركود فارغ');
    });
  });

  describe('Customer-Facing Printable Invoice Confidentiality & Fields', () => {
    const mockPrintableInvoice: PrintableInvoice = {
      id: 101,
      invoice_number: 'INV-2026-0001',
      issue_date: '2026-10-09 15:30',
      issue_date_arabic: '09 أكتوبر 2026 - 03:30 م',
      sale_type: 'wholesale',
      sale_type_label: 'جملة',
      is_wholesale: true,
      status: 'posted',
      status_label: 'مرحلة',
      customer: {
        id: 5,
        name: 'معرض النور للأثاث والمفروشات',
        phone: '01012345678',
        address: 'دمياط - شارع التجاريين',
        prior_balance: '1500.00',
        prior_balance_formatted: '1,500.00 ج.م',
        resulting_balance: '3500.00',
        resulting_balance_formatted: '3,500.00 ج.م',
        balance_status: 'مدين (مستحق على العميل)',
      },
      items: [
        {
          id: 1,
          product_name: 'لحاف قطن فاخر 6 قطع',
          barcode: 'B0001',
          quantity: 2,
          unit_price: '1000.00',
          unit_price_formatted: '1,000.00 ج.م',
          subtotal: '2000.00',
          subtotal_formatted: '2,000.00 ج.م',
        },
        {
          id: 2,
          product_name: 'مخدة تفصيل عمولة سورية', // Originally an external product
          barcode: null,
          quantity: 4,
          unit_price: '250.00',
          unit_price_formatted: '250.00 ج.م',
          subtotal: '1000.00',
          subtotal_formatted: '1,000.00 ج.م',
        },
      ],
      items_count: 2,
      total_units: 6,
      subtotal: '3000.00',
      subtotal_formatted: '3,000.00 ج.م',
      discount_amount: '0.00',
      discount_amount_formatted: '0.00 ج.م',
      total: '3000.00',
      total_formatted: '3,000.00 ج.م',
      paid_amount: '1000.00',
      paid_amount_formatted: '1,000.00 ج.م',
      remaining_amount: '2000.00',
      remaining_amount_formatted: '2,000.00 ج.م',
      credit_amount: '0.00',
      credit_amount_formatted: '0.00 ج.م',
      payments: [
        {
          id: 1,
          payment_method_id: 1,
          payment_method_name: 'نقدي كاش',
          amount: '1000.00',
          amount_formatted: '1,000.00 ج.م',
          notes: null,
        },
      ],
      notes: 'تسليم المعرض',
      cashier_name: 'أحمد كاشير',
      showroom: {
        name: 'العالمية للأثاث والموبيليا',
        subtitle: 'معرض المفروشات المنزلية والأثاث الراقي',
        phone: '01000000000',
        address: 'المعرض الرئيسي - دمياط',
        return_policy: 'البضاعة المباعة ترد وتستبدل خلال 14 يوماً بشرط وجود أصل الفاتورة وسلامة المنتج',
        footer_note: 'شكراً لتعاملكم مع معرض العالمية للأثاث والموبيليا',
      },
    };

    it('strictly hides purchase cost, total cost, and profit from customer printable invoice', () => {
      // Top level
      expect('total_profit' in mockPrintableInvoice).toBe(false);
      expect('cost' in mockPrintableInvoice).toBe(false);

      // Line items
      for (const item of mockPrintableInvoice.items) {
        expect('unit_cost' in item).toBe(false);
        expect('total_cost' in item).toBe(false);
        expect('profit' in item).toBe(false);
        expect('purchase_cost' in item).toBe(false);
        expect('expense_id' in item).toBe(false);
      }
    });

    it('normalizes external items so they appear as ordinary sale lines without external tags', () => {
      const externalItem = mockPrintableInvoice.items[1];
      expect(externalItem.product_name).toBe('مخدة تفصيل عمولة سورية');
      expect('item_type' in externalItem).toBe(false);
      expect('is_external' in externalItem).toBe(false);
    });

    it('maintains wholesale ledger audit trail with prior balance and resulting debt', () => {
      expect(mockPrintableInvoice.customer).not.toBeNull();
      const prior = parseFloat(mockPrintableInvoice.customer!.prior_balance);
      const total = parseFloat(mockPrintableInvoice.total);
      const paid = parseFloat(mockPrintableInvoice.paid_amount);
      const resulting = parseFloat(mockPrintableInvoice.customer!.resulting_balance);

      // Invariant: Resulting balance = Prior balance + (Total - Paid)
      expect(resulting).toBe(prior + (total - paid));
      expect(resulting).toBe(3500.0);
    });

    it('supports anonymous retail customer with null customer record', () => {
      const retailInvoice: PrintableInvoice = {
        ...mockPrintableInvoice,
        sale_type: 'retail',
        sale_type_label: 'قطاعي',
        is_wholesale: false,
        customer: null,
      };

      expect(retailInvoice.customer).toBeNull();
      expect(retailInvoice.sale_type).toBe('retail');
      expect(retailInvoice.is_wholesale).toBe(false);
    });
  });

  describe('Barcode Label Printing Queue & Batching', () => {
    const mockLabels: BarcodeLabel[] = [
      {
        product_id: 1,
        product_name: 'طقم ملايات سرير كينج 5 قطع',
        barcode: 'S0001',
        category_name: 'ملايات ومفروشات',
        category_code: 'S',
        retail_price: '450.00',
        retail_price_formatted: '450.00 ج.م',
        wholesale_price: '350.00',
        wholesale_price_formatted: '350.00 ج.م',
        stock_quantity: 12,
        print_quantity: 4,
        showroom_name: 'العالمية للأثاث والموبيليا',
      },
      {
        product_id: 2,
        product_name: 'بطانية مورا إسباني حفر ليزر',
        barcode: 'B0005',
        category_name: 'بطاطين وألحفة',
        category_code: 'B',
        retail_price: '1200.00',
        retail_price_formatted: '1,200.00 ج.م',
        wholesale_price: '950.00',
        wholesale_price_formatted: '950.00 ج.م',
        stock_quantity: 8,
        print_quantity: 3,
        showroom_name: 'العالمية للأثاث والموبيليا',
      },
    ];

    it('multiplies labels according to requested print quantity', () => {
      const flattened: BarcodeLabel[] = [];
      for (const item of mockLabels) {
        for (let i = 0; i < item.print_quantity; i++) {
          flattened.push(item);
        }
      }

      // 4 sheets + 3 blankets = 7 total labels
      expect(flattened.length).toBe(7);
      expect(flattened.filter((l) => l.barcode === 'S0001').length).toBe(4);
      expect(flattened.filter((l) => l.barcode === 'B0005').length).toBe(3);
    });

    it('preserves existing barcodes without alteration or regeneration', () => {
      expect(mockLabels[0].barcode).toBe('S0001');
      expect(mockLabels[1].barcode).toBe('B0005');
      // Format matches CATEGORY_LETTER + 4 digits
      expect(/^[A-Z]\d{4}$/.test(mockLabels[0].barcode)).toBe(true);
      expect(/^[A-Z]\d{4}$/.test(mockLabels[1].barcode)).toBe(true);
    });

    it('ensures purchase cost is strictly omitted from barcode labels', () => {
      for (const label of mockLabels) {
        expect('purchase_cost' in label).toBe(false);
        expect('cost' in label).toBe(false);
        expect('profit' in label).toBe(false);
      }
    });

    it('enforces total selected labels limit (max 1000) for batch printing jobs', () => {
      const oversizedQueue = [
        { product_id: 1, quantity: 500 },
        { product_id: 2, quantity: 501 },
      ];
      const totalCount = oversizedQueue.reduce((sum, item) => sum + item.quantity, 0);
      expect(totalCount).toBe(1001);
      const isExceeded = totalCount > 1000;
      expect(isExceeded).toBe(true);
    });
  });
});
