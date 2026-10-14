import type { ReturnableInvoice } from '../../types/domain';

export interface ReturnEligibility {
  canReturn: boolean;
  reason: string | null;
}

/**
 * Reads the backend's returnable-invoice response and reports whether the
 * "عمل مرتجع / استبدال" action should be offered. It does not re-implement the
 * return rules: status and remaining_returnable_quantity are computed by the
 * backend (ReturnableInvoiceResource), and CreateSalesReturnAction still
 * re-validates everything on submit.
 */
export const getReturnEligibility = (invoice: ReturnableInvoice | null | undefined): ReturnEligibility => {
  if (!invoice) {
    return { canReturn: false, reason: 'تعذر التحقق من الأصناف المتاحة للإرجاع' };
  }

  if (invoice.status === 'cancelled') {
    return { canReturn: false, reason: 'لا يمكن عمل مرتجع على فاتورة ملغاة' };
  }

  const remaining = invoice.items.reduce((sum, item) => sum + item.remaining_returnable_quantity, 0);
  if (remaining <= 0) {
    return { canReturn: false, reason: 'تم إرجاع جميع أصناف هذه الفاتورة بالكامل' };
  }

  return { canReturn: true, reason: null };
};

/** Legacy /returns bookmarks land on the returns tab of the invoices page. */
export const RETURNS_TAB_PATH = '/invoices?tab=returns';
