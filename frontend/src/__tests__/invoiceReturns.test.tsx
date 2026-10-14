import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Navigate, createRoutesFromChildren, matchRoutes } from 'react-router-dom';
import type { ReturnableInvoice, ReturnableItem } from '../types/domain';
import { getReturnEligibility, RETURNS_TAB_PATH } from '../features/returns/returnEligibility';
import { InvoiceReturnAction } from '../features/returns/InvoiceReturnAction';
import { ReturnFlow } from '../features/returns/ReturnFlow';
import { AuthContext, type AuthContextValue } from '../app/providers/authContextDef';
import { ToastContext } from '../app/providers/toastContextDef';
import { AppRoutes } from '../app/router/routes';
import { InvoicesPage } from '../features/invoices/InvoicesPage';

const item = (overrides: Partial<ReturnableItem> = {}): ReturnableItem => ({
  id: 11,
  invoice_item_id: 11,
  product_id: 5,
  item_type: 'product',
  product_name: 'لحاف قطن كينج 3 قطع',
  barcode: 'L0001',
  unit_sale_price: '700.00',
  originally_sold_quantity: 2,
  previously_returned_quantity: 0,
  remaining_returnable_quantity: 2,
  subtotal: '1400.00',
  ...overrides,
});

const invoice = (overrides: Partial<ReturnableInvoice> = {}): ReturnableInvoice => ({
  id: 7,
  invoice_number: 'INV-20261013-0007',
  sale_type: 'retail',
  sale_type_label: 'قطاعي',
  status: 'posted',
  status_label: 'معتمدة ومرحلة',
  total: '1520.00',
  paid_amount: '1520.00',
  remaining_amount: '0.00',
  credit_amount: '0.00',
  customer_id: null,
  customer_name: null,
  customer_phone: null,
  created_at: '2026-10-13T10:00:00Z',
  created_at_formatted: '2026-10-13 10:00',
  items: [
    item(),
    item({ id: 12, invoice_item_id: 12, product_id: null, item_type: 'external', product_name: 'مفرش تفصيل خاص', barcode: null, unit_sale_price: '120.00', originally_sold_quantity: 1, remaining_returnable_quantity: 1, subtotal: '120.00' }),
  ],
  ...overrides,
});

const fullyReturned = invoice({
  items: [
    item({ previously_returned_quantity: 2, remaining_returnable_quantity: 0 }),
  ],
});

const authValue = (role: 'owner' | 'cashier'): AuthContextValue => ({
  user: null,
  token: 'test',
  isAuthenticated: true,
  isLoading: false,
  isOwner: role === 'owner',
  isCashier: role === 'cashier',
  can: () => true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => {},
});

const renderFlow = (role: 'owner' | 'cashier', initialInvoice: ReturnableInvoice | null) =>
  renderToStaticMarkup(
    <ToastContext.Provider value={{ toasts: [], showToast: () => {}, removeToast: () => {} }}>
      <AuthContext.Provider value={authValue(role)}>
        <ReturnFlow initialInvoice={initialInvoice} />
      </AuthContext.Provider>
    </ToastContext.Provider>
  );

describe('Phase 15-E — Returns inside Invoices', () => {
  describe('Return eligibility (reads the backend returnable-invoice response)', () => {
    it('allows a return for a posted invoice with remaining returnable quantity', () => {
      expect(getReturnEligibility(invoice())).toEqual({ canReturn: true, reason: null });
    });

    it('blocks cancelled invoices with a reason', () => {
      const result = getReturnEligibility(invoice({ status: 'cancelled', status_label: 'ملغاة' }));
      expect(result.canReturn).toBe(false);
      expect(result.reason).toBe('لا يمكن عمل مرتجع على فاتورة ملغاة');
    });

    it('blocks fully returned invoices with a reason', () => {
      const result = getReturnEligibility(fullyReturned);
      expect(result.canReturn).toBe(false);
      expect(result.reason).toBe('تم إرجاع جميع أصناف هذه الفاتورة بالكامل');
    });

    it('blocks when the backend response is unavailable', () => {
      expect(getReturnEligibility(null).canReturn).toBe(false);
    });
  });

  describe('"عمل مرتجع / استبدال" button visibility in invoice details', () => {
    const render = (returnable: ReturnableInvoice | null, isLoading = false) =>
      renderToStaticMarkup(<InvoiceReturnAction returnable={returnable} isLoading={isLoading} onStart={() => {}} />);

    it('renders an enabled button for a returnable invoice', () => {
      const html = render(invoice());
      expect(html).toContain('عمل مرتجع / استبدال');
      expect(html).not.toMatch(/<button[^>]*disabled/);
      expect(html).not.toContain('invoice-return-blocked-reason');
    });

    it('renders a disabled button with the reason for a cancelled invoice', () => {
      const html = render(invoice({ status: 'cancelled', status_label: 'ملغاة' }));
      expect(html).toMatch(/<button[^>]*disabled/);
      expect(html).toContain('لا يمكن عمل مرتجع على فاتورة ملغاة');
    });

    it('renders a disabled button with the reason for a fully returned invoice', () => {
      const html = render(fullyReturned);
      expect(html).toMatch(/<button[^>]*disabled/);
      expect(html).toContain('تم إرجاع جميع أصناف هذه الفاتورة بالكامل');
    });

    it('renders a disabled loading button while eligibility is being fetched', () => {
      const html = render(null, true);
      expect(html).toMatch(/<button[^>]*disabled/);
      expect(html).not.toContain('invoice-return-blocked-reason');
    });
  });

  describe('ReturnFlow pre-loaded from an invoice', () => {
    it('shows the invoice and its returnable items without asking for the invoice number', () => {
      const html = renderFlow('owner', invoice());
      expect(html).toContain('INV-20261013-0007');
      expect(html).toContain('لحاف قطن كينج 3 قطع');
      expect(html).toContain('الكمية المرتجعة من لحاف قطن كينج 3 قطع');
      expect(html).not.toContain('رقم الفاتورة الأصلية');
    });

    it('keeps all four resolutions, with account credit disabled for an invoice without a customer', () => {
      const html = renderFlow('owner', invoice());
      for (const value of ['refund_cash', 'exchange_equal', 'exchange_upgrade', 'customer_account_credit']) {
        expect(html).toContain(`value="${value}"`);
      }
      expect(html).toMatch(/<input[^>]*disabled=""[^>]*value="customer_account_credit"/);
      expect(html).toMatch(/<input[^>]*checked=""[^>]*value="refund_cash"/);
    });

    it('defaults wholesale customer invoices to customer account credit', () => {
      const html = renderFlow('owner', invoice({ sale_type: 'wholesale', customer_id: 3, customer_name: 'مؤسسة الهدى' }));
      expect(html).toMatch(/<input[^>]*checked=""[^>]*value="customer_account_credit"/);
    });

    it('limits each quantity input to the backend remaining returnable quantity', () => {
      const html = renderFlow('owner', invoice());
      expect(html).toMatch(/<input[^>]*max="2"[^>]*aria-label="الكمية المرتجعة من لحاف قطن كينج 3 قطع"/);
    });

    it('keeps the submit button disabled until items are selected and the cashier confirms', () => {
      const html = renderFlow('owner', invoice());
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*تأكيد وتنفيذ عملية المرتجع/s);
    });

    it('shows the blocked reason instead of the form for a fully returned invoice', () => {
      const html = renderFlow('owner', fullyReturned);
      expect(html).toContain('تم إرجاع جميع أصناف هذه الفاتورة بالكامل');
      expect(html).not.toContain('تأكيد وتنفيذ عملية المرتجع');
    });

    it('never shows the external-product classification to a cashier', () => {
      expect(renderFlow('owner', invoice())).toContain('صنف خارجي');
      const cashierHtml = renderFlow('cashier', invoice());
      expect(cashierHtml).toContain('مفرش تفصيل خاص');
      expect(cashierHtml).not.toContain('صنف خارجي');
      expect(cashierHtml).not.toMatch(/تكلفة|ربح|unit_cost|profit/);
    });

    it('starts with the original-invoice search when opened from the toolbar', () => {
      const html = renderFlow('cashier', null);
      expect(html).toContain('رقم الفاتورة الأصلية');
      expect(html).toContain('ابحث عن الفاتورة الأصلية لبدء المرتجع');
    });
  });

  describe('Routing', () => {
    const routes = createRoutesFromChildren(
      (AppRoutes({}) as React.ReactElement<{ children: React.ReactNode }>).props.children
    );

    const leafElement = (path: string) => {
      const matches = matchRoutes(routes, path);
      expect(matches).not.toBeNull();
      return matches![matches!.length - 1].route.element as React.ReactElement<{ to?: string; replace?: boolean }>;
    };

    it('redirects legacy /returns bookmarks to the returns tab of the invoices page', () => {
      expect(RETURNS_TAB_PATH).toBe('/invoices?tab=returns');
      const element = leafElement('/returns');
      expect(element.type).toBe(Navigate);
      expect(element.props.to).toBe(RETURNS_TAB_PATH);
      expect(element.props.replace).toBe(true);
    });

    it('serves the invoices page (which hosts the returns tab) at /invoices', () => {
      expect(leafElement('/invoices').type).toBe(InvoicesPage);
    });
  });
});
