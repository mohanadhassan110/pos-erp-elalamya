import React, { useState, useEffect } from 'react';
import { returnsApi } from '../../services/api/returnsApi';
import { productsApi } from '../../services/api/productsApi';
import { paymentMethodsApi } from '../../services/api/paymentMethodsApi';
import { invoicesApi } from '../../services/api/invoicesApi';
import { customersApi } from '../../services/api/customersApi';
import { useToast } from '../../app/providers/useToast';
import { useAuth } from '../../app/providers/useAuth';
import type {
  ReturnableInvoice,
  SalesReturn,
  SalesReturnResolution,
  PaymentMethod,
  Product,
  Invoice,
  Customer,
  CreateSalesReturnPayload,
} from '../../types/domain';
import { Card, Button, Input, Select, Badge, Alert, EmptyState } from '../../components/ui';
import {
  Search,
  Banknote,
  Scale,
  TrendingUp,
  UserCheck,
  Trash2,
  CheckCircle2,
  FileText,
  Printer,
  RotateCw,
  Plus,
  Minus,
  Check,
} from 'lucide-react';
import { getReturnEligibility } from './returnEligibility';
import { ReturnPrintModal } from './ReturnPrintModal';

interface SelectedReturnItem {
  invoice_item_id: number;
  quantity: number;
  product_name: string;
  unit_sale_price: number;
  max_quantity: number;
}

interface ReplacementItemRow {
  product: Product;
  quantity: number;
  unit_sale_price: number;
}

export interface ReturnFlowProps {
  /** Invoice already loaded by the caller (opened from invoice details). Omit to start with invoice-number search. */
  initialInvoice?: ReturnableInvoice | null;
  /** Called after the backend accepted the return, with the refreshed returnable invoice. */
  onCompleted?: (result: SalesReturn, refreshedInvoice: ReturnableInvoice | null) => void;
  /** Opens another invoice (used for the exchange replacement invoice link). */
  onOpenInvoice?: (invoiceId: number) => void;
  onClose?: () => void;
}

const defaultResolutionFor = (inv: ReturnableInvoice): SalesReturnResolution =>
  inv.customer_id ? 'customer_account_credit' : 'refund_cash';

const RESOLUTION_OPTIONS: Array<{
  value: SalesReturnResolution;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'refund_cash',
    label: 'استرداد نقدي',
    description: 'صرف قيمة المرتجع نقداً للعميل مباشرة من الخزينة',
    icon: <Banknote size={16} />,
  },
  {
    value: 'exchange_equal',
    label: 'استبدال متطابق القيمة',
    description: 'استبدال ببضاعة بديلة بنفس قيمة المرتجع دون فارق نقدي',
    icon: <Scale size={16} />,
  },
  {
    value: 'exchange_upgrade',
    label: 'استبدال بقيمة أعلى (ترقية)',
    description: 'استبدال ببضاعة أعلى قيمة وتحصيل الفارق الإضافي من العميل',
    icon: <TrendingUp size={16} />,
  },
  {
    value: 'customer_account_credit',
    label: 'رصيد دائن لحساب العميل',
    description: 'إضافة المبلغ كرصيد دائن على كشف حساب العميل لتخفيض دينه أو شراء مستقبلي',
    icon: <UserCheck size={16} />,
  },
];

const RETURN_REASONS = [
  'عيب مصنعي في الخياطة أو القماش',
  'تلف أو عطل أثناء الاستخدام',
  'مقاس أو أبعاد غير مناسبة',
  'لون أو نقشة غير مطابقة',
  'رغبة العميل في الإرجاع / الاستبدال',
  'أخرى (مدونة في الملاحظات)',
];

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.625rem',
  fontSize: '0.82rem',
  whiteSpace: 'nowrap',
  fontWeight: 700,
  color: '#334155',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.625rem',
  fontSize: '0.85rem',
  verticalAlign: 'middle',
};

export const ReturnFlow: React.FC<ReturnFlowProps> = ({
  initialInvoice = null,
  onCompleted,
  onOpenInvoice,
  onClose,
}) => {
  const { showToast } = useToast();
  const { isOwner } = useAuth();

  // Wholesale Customer Filter State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState<boolean>(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | ''>('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [isLoadingCustomerInvoices, setIsLoadingCustomerInvoices] = useState<boolean>(false);

  // Invoice lookup
  const [searchInvoiceNumber, setSearchInvoiceNumber] = useState<string>('');
  const [isSearchingInvoice, setIsSearchingInvoice] = useState<boolean>(false);
  const [invoice, setInvoice] = useState<ReturnableInvoice | null>(initialInvoice);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);

  // Left Panel: Items to Return
  // returnQuantities: invoice_item_id -> quantity
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [returnConditions, setReturnConditions] = useState<Record<number, 'resellable' | 'damaged'>>({});
  const [returnReasons, setReturnReasons] = useState<Record<number, string>>({});

  // Right Panel: New Exchange Items
  const [replacementSearch, setReplacementSearch] = useState<string>('');
  const [isSearchingReplacement, setIsSearchingReplacement] = useState<boolean>(false);
  const [replacementSearchResults, setReplacementSearchResults] = useState<Product[]>([]);
  const [replacementItems, setReplacementItems] = useState<ReplacementItemRow[]>([]);

  // Financial Settlement & Resolution
  const [resolution, setResolution] = useState<SalesReturnResolution>(
    initialInvoice ? defaultResolutionFor(initialInvoice) : 'refund_cash'
  );
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [refundPaymentMethodId, setRefundPaymentMethodId] = useState<number | ''>('');
  const [differencePaymentMethodId, setDifferencePaymentMethodId] = useState<number | ''>('');
  const [returnNotes, setReturnNotes] = useState<string>('');

  // Confirmation & Completion
  const [isCashConfirmed, setIsCashConfirmed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedReturn, setCompletedReturn] = useState<SalesReturn | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    paymentMethodsApi
      .list()
      .then((methods) => {
        if (!active) return;
        setPaymentMethods(methods);
        const cash = methods.find((m) => m.is_cash);
        const fallback = cash ?? methods[0];
        if (fallback) {
          setRefundPaymentMethodId(fallback.id);
          setDifferencePaymentMethodId(fallback.id);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Fetch active customers for wholesale returns filter
  useEffect(() => {
    let active = true;
    customersApi
      .list({ is_active: true, per_page: 100 })
      .then((res) => {
        if (active) setCustomers(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingCustomers(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!initialInvoice) {
      invoicesApi
        .list({ per_page: 6, status: 'posted' })
        .then((res) => {
          if (active) setRecentInvoices(res.data);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [initialInvoice]);

  const resetForm = (inv: ReturnableInvoice) => {
    setReturnQuantities({});
    setReturnConditions({});
    setReturnReasons({});
    setReplacementItems([]);
    setReplacementSearchResults([]);
    setReturnNotes('');
    setIsCashConfirmed(false);
    setResolution(defaultResolutionFor(inv));
  };

  const handleSelectCustomer = async (customerId: number | '') => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      setSelectedCustomer(null);
      setCustomerInvoices([]);
      return;
    }

    const initialCust = customers.find((c) => c.id === customerId) || null;
    setSelectedCustomer(initialCust);
    setIsLoadingCustomerInvoices(true);
    try {
      const [freshCust, invRes] = await Promise.all([
        customersApi.getById(customerId).catch(() => initialCust),
        invoicesApi.list({ customer_id: customerId, status: 'posted', per_page: 50 }),
      ]);
      if (freshCust) setSelectedCustomer(freshCust);
      setCustomerInvoices(invRes.data);
    } catch {
      showToast('تعذر جلب فواتير العميل', 'error');
    } finally {
      setIsLoadingCustomerInvoices(false);
    }
  };

  const handleSelectInvoiceToReturn = async (invId: number) => {
    setIsSearchingInvoice(true);
    try {
      const inv = await returnsApi.getReturnableInvoice(invId);
      setInvoice(inv);
      setCompletedReturn(null);
      resetForm(inv);
      if (inv.is_fully_returned) {
        showToast(`الفاتورة ${inv.invoice_number} تم إرجاعها بالكامل سابقاً`, 'warning');
      } else if (inv.has_returns) {
        showToast(
          `تم فتح الفاتورة ${inv.invoice_number} (يوجد مرتجع جزئي سابق بقيمة ${inv.previously_returned_amount} ج.م)`,
          'info'
        );
      } else {
        showToast(`تم فتح الفاتورة ${inv.invoice_number} بنجاح`, 'success');
      }
    } catch {
      showToast('تعذر تحميل بيانات الفاتورة المحددة', 'error');
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  const handleSearchInvoice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchInvoiceNumber.trim();
    if (!query) {
      showToast('يرجى إدخال رقم الفاتورة للبحث', 'warning');
      return;
    }

    setIsSearchingInvoice(true);
    try {
      const inv = await returnsApi.searchInvoice(
        query,
        selectedCustomerId ? Number(selectedCustomerId) : undefined
      );
      setInvoice(inv);
      setCompletedReturn(null);
      resetForm(inv);
      if (inv.is_fully_returned) {
        showToast(`الفاتورة ${inv.invoice_number} تم إرجاعها بالكامل سابقاً`, 'warning');
      } else if (inv.has_returns) {
        showToast(
          `تم فتح الفاتورة ${inv.invoice_number} (يوجد مرتجع جزئي سابق بقيمة ${inv.previously_returned_amount} ج.م)`,
          'info'
        );
      } else {
        showToast(`تم العثور على الفاتورة ${inv.invoice_number}`, 'success');
      }
    } catch {
      setInvoice(null);
      showToast(
        selectedCustomerId
          ? 'لم يتم العثور على فاتورة بهذا الرقم تابعة لهذا العميل'
          : 'لم يتم العثور على فاتورة مبيعات بهذا الرقم',
        'error'
      );
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  const handleQuantityChange = (itemId: number, maxQty: number, valueStr: string) => {
    const val = parseInt(valueStr, 10);
    if (isNaN(val) || val <= 0) {
      const next = { ...returnQuantities };
      delete next[itemId];
      setReturnQuantities(next);
      return;
    }
    const clamped = Math.min(Math.max(1, val), maxQty);
    setReturnQuantities((prev) => ({ ...prev, [itemId]: clamped }));
    // Ensure default condition if not already set
    if (!returnConditions[itemId]) {
      setReturnConditions((prev) => ({ ...prev, [itemId]: 'resellable' }));
    }
  };

  const handleConditionChange = (itemId: number, condition: 'resellable' | 'damaged') => {
    setReturnConditions((prev) => ({ ...prev, [itemId]: condition }));
  };

  const handleReasonChange = (itemId: number, reason: string) => {
    setReturnReasons((prev) => ({ ...prev, [itemId]: reason }));
  };

  const selectedReturnItems: SelectedReturnItem[] = invoice
    ? invoice.items
        .filter((item) => (returnQuantities[item.id] || 0) > 0)
        .map((item) => ({
          invoice_item_id: item.id,
          quantity: returnQuantities[item.id],
          product_name: item.product_name,
          unit_sale_price: parseFloat(item.unit_sale_price),
          max_quantity: item.remaining_returnable_quantity,
        }))
    : [];

  const totalReturnAmount = selectedReturnItems.reduce(
    (sum, item) => sum + item.unit_sale_price * item.quantity,
    0
  );

  const handleSearchReplacement = async () => {
    const q = replacementSearch.trim();
    if (!q) return;
    setIsSearchingReplacement(true);
    try {
      const res = await productsApi.list({ search: q, is_active: true, per_page: 5 });
      setReplacementSearchResults(res.data);
    } catch {
      showToast('تعذر البحث عن منتجات الاستبدال', 'error');
    } finally {
      setIsSearchingReplacement(false);
    }
  };

  const syncResolutionWithItems = (nextReplacements: ReplacementItemRow[]) => {
    if (nextReplacements.length > 0) {
      const nextReplTotal = nextReplacements.reduce((sum, r) => sum + r.unit_sale_price * r.quantity, 0);
      const nextNet = nextReplTotal - totalReturnAmount;
      if (Math.abs(nextNet) < 0.01) {
        setResolution('exchange_equal');
      } else if (nextNet > 0) {
        setResolution('exchange_upgrade');
      }
    } else {
      if (resolution === 'exchange_equal' || resolution === 'exchange_upgrade') {
        setResolution(invoice?.customer_id ? 'customer_account_credit' : 'refund_cash');
      }
    }
  };

  const handleAddReplacementProduct = (product: Product) => {
    // Pricing context: Wholesale customers retain wholesale pricing, retail retains retail pricing!
    const defaultPrice =
      invoice?.sale_type === 'wholesale'
        ? parseFloat(product.wholesale_price)
        : parseFloat(product.retail_price);

    const existingIdx = replacementItems.findIndex((r) => r.product.id === product.id);
    let updated: ReplacementItemRow[];
    if (existingIdx >= 0) {
      updated = replacementItems.map((r, i) => (i === existingIdx ? { ...r, quantity: r.quantity + 1 } : r));
    } else {
      updated = [...replacementItems, { product, quantity: 1, unit_sale_price: defaultPrice }];
    }
    setReplacementItems(updated);
    syncResolutionWithItems(updated);
    setReplacementSearch('');
    setReplacementSearchResults([]);
    showToast(`تمت إضافة '${product.name}' كصنف استبدال`, 'info');
  };

  const handleUpdateReplacementQty = (index: number, qty: number) => {
    let updated: ReplacementItemRow[];
    if (qty <= 0) {
      updated = replacementItems.filter((_, i) => i !== index);
    } else {
      updated = replacementItems.map((r, i) => (i === index ? { ...r, quantity: qty } : r));
    }
    setReplacementItems(updated);
    syncResolutionWithItems(updated);
  };

  const handleRemoveReplacement = (index: number) => {
    const updated = replacementItems.filter((_, i) => i !== index);
    setReplacementItems(updated);
    syncResolutionWithItems(updated);
  };

  const totalReplacementAmount = replacementItems.reduce(
    (sum, r) => sum + r.unit_sale_price * r.quantity,
    0
  );

  // Financial Settlement Engine Computations:
  // Net Balance = Total New Items - Total Returned Items
  const netBalance = totalReplacementAmount - totalReturnAmount;
  const differenceAmount = Math.max(0, netBalance);

  const isResolutionValid = () => {
    if (selectedReturnItems.length === 0) return false;
    if (totalReturnAmount <= 0) return false;

    if (resolution === 'customer_account_credit') {
      return Boolean(invoice?.customer_id);
    }

    if (resolution === 'exchange_equal') {
      if (replacementItems.length === 0) return false;
      return Math.abs(totalReplacementAmount - totalReturnAmount) < 0.01;
    }

    if (resolution === 'exchange_upgrade') {
      if (replacementItems.length === 0) return false;
      if (totalReplacementAmount <= totalReturnAmount) return false;
      return Boolean(differencePaymentMethodId);
    }

    return true;
  };

  const handleSubmitReturn = async () => {
    if (!invoice || !isResolutionValid()) return;

    setIsSubmitting(true);
    try {
      const payload: CreateSalesReturnPayload = {
        idempotency_key: crypto.randomUUID(),
        invoice_id: invoice.id,
        resolution,
        notes: returnNotes.trim() || undefined,
        items: selectedReturnItems.map((item) => ({
          invoice_item_id: item.invoice_item_id,
          quantity: item.quantity,
          item_condition: returnConditions[item.invoice_item_id] || 'resellable',
          return_reason: returnReasons[item.invoice_item_id] || undefined,
        })),
        payment_method_id:
          resolution === 'refund_cash' && refundPaymentMethodId
            ? Number(refundPaymentMethodId)
            : undefined,
        replacement_items:
          resolution === 'exchange_equal' || resolution === 'exchange_upgrade'
            ? replacementItems.map((r) => ({
                product_id: r.product.id,
                quantity: r.quantity,
                unit_sale_price: r.unit_sale_price.toFixed(2),
              }))
            : undefined,
        difference_payment_method_id:
          resolution === 'exchange_upgrade' && differencePaymentMethodId
            ? Number(differencePaymentMethodId)
            : undefined,
      };

      const result = await returnsApi.create(payload);
      showToast(`تم تسجيل واعتماد المرتجع بنجاح برقم: ${result.return_number}`, 'success');
      setCompletedReturn(result);

      // Refresh invoice state
      let refreshed: ReturnableInvoice | null = null;
      try {
        refreshed = await returnsApi.getReturnableInvoice(invoice.id);
        setInvoice(refreshed);
        resetForm(refreshed);
      } catch {
        resetForm(invoice);
      }
      onCompleted?.(result, refreshed);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء تنفيذ عملية المرتجع';
      showToast(errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const eligibility = getReturnEligibility(invoice);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', direction: 'rtl' }}>
      {/* Standalone Search & Customer Filter Bar */}
      {!initialInvoice && !invoice && (
        <Card dense>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.75rem',
                alignItems: 'flex-end',
              }}
            >
              {/* Wholesale Customer Filter Dropdown */}
              <div>
                <Select
                  label="تصفية فواتير حسب عميل الجملة (اختياري)"
                  value={selectedCustomerId ? String(selectedCustomerId) : ''}
                  onChange={(e) => handleSelectCustomer(e.target.value ? Number(e.target.value) : '')}
                  disabled={isLoadingCustomers}
                  options={[
                    { value: '', label: 'جميع العملاء (بحث عام أو قطاعي)' },
                    ...customers.map((c) => ({
                      value: String(c.id),
                      label: `${c.name} ${c.phone ? `(${c.phone})` : ''} - [${
                        c.balance_status === 'debt'
                          ? `مدين: ${parseFloat(c.balance).toFixed(2)}`
                          : c.balance_status === 'credit'
                          ? `دائن: ${parseFloat(c.balance).toFixed(2)}`
                          : 'مسدد'
                      } ج.م]`,
                    })),
                  ]}
                />
              </div>

              {/* Invoice Number Search Form */}
              <form
                onSubmit={handleSearchInvoice}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}
              >
                <div style={{ flex: 1 }}>
                  <Input
                    label={
                      selectedCustomer
                        ? `بحث برقم الفاتورة لعميل: ${selectedCustomer.name}`
                        : 'رقم الفاتورة الأصلية (أو امسح الباركود)'
                    }
                    placeholder="مثال: INV-20261013-0002 أو امسح الباركود"
                    value={searchInvoiceNumber}
                    onChange={(e) => setSearchInvoiceNumber(e.target.value)}
                    autoFocus
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSearchingInvoice}
                  icon={<Search size={15} />}
                >
                  بحث
                </Button>
              </form>
            </div>

            {/* Selected Wholesale Customer Card Banner */}
            {selectedCustomer && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: '#DBEAFE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#1D4ED8',
                    }}
                  >
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#1E3A8A' }}>
                      عميل الجملة: {selectedCustomer.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      الهاتف: {selectedCustomer.phone || 'غير مسجل'} {selectedCustomer.address ? `| العنوان: ${selectedCustomer.address}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      backgroundColor:
                        selectedCustomer.balance_status === 'debt'
                          ? '#FEE2E2'
                          : selectedCustomer.balance_status === 'credit'
                          ? '#DCFCE7'
                          : '#F1F5F9',
                      color:
                        selectedCustomer.balance_status === 'debt'
                          ? '#B91C1C'
                          : selectedCustomer.balance_status === 'credit'
                          ? '#15803D'
                          : '#475569',
                      border: `1px solid ${
                        selectedCustomer.balance_status === 'debt'
                          ? '#FCA5A5'
                          : selectedCustomer.balance_status === 'credit'
                          ? '#86EFAC'
                          : '#CBD5E1'
                      }`,
                    }}
                  >
                    رصيد الحساب الحالي:{' '}
                    <span style={{ fontFamily: 'monospace' }}>
                      {parseFloat(selectedCustomer.balance).toLocaleString('ar-EG', {
                        minimumFractionDigits: 2,
                      })}{' '}
                      ج.م
                    </span>{' '}
                    ({selectedCustomer.balance_status_label})
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelectCustomer('')}
                    style={{ color: '#64748B' }}
                  >
                    إلغاء التصفية
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Customer Invoices Section (when a customer is selected) */}
      {!initialInvoice && !invoice && selectedCustomer && (
        <Card dense title={`فواتير مبيعات العميل المتاحة للإرجاع (${customerInvoices.length} فاتورة)`}>
          {isLoadingCustomerInvoices ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748B' }}>
              جاري تحميل فواتير العميل...
            </div>
          ) : customerInvoices.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748B' }}>
              لا توجد فواتير مبيعات مسجلة لهذا العميل حالياً.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={thStyle}>رقم الفاتورة</th>
                    <th style={thStyle}>تاريخ الفاتورة</th>
                    <th style={thStyle}>نوع البيع</th>
                    <th style={thStyle}>إجمالي الفاتورة</th>
                    <th style={thStyle}>المدفوع</th>
                    <th style={thStyle}>المتبقي (آجل)</th>
                    <th style={thStyle}>حالة الإرجاع</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {customerInvoices.map((inv) => {
                    const isFullyReturned =
                      inv.net_after_returns !== undefined && parseFloat(inv.net_after_returns) <= 0.001;
                    const hasPartialReturn =
                      !isFullyReturned &&
                      (inv.has_returns ||
                        (inv.net_after_returns !== undefined &&
                          parseFloat(inv.net_after_returns) < parseFloat(inv.total)));
                    const returnableVal =
                      hasPartialReturn && inv.net_after_returns ? inv.net_after_returns : inv.total;

                    return (
                      <tr
                        key={inv.id}
                        style={{
                          borderBottom: '1px solid #F1F5F9',
                          backgroundColor: isFullyReturned ? '#F8FAFC' : '#FFFFFF',
                          opacity: isFullyReturned ? 0.65 : 1,
                        }}
                      >
                        <td style={tdStyle}>
                          <strong style={{ fontFamily: 'monospace', color: '#1E293B' }}>
                            {inv.invoice_number}
                          </strong>
                        </td>
                        <td style={{ ...tdStyle, color: '#64748B', fontSize: '0.8rem' }}>
                          {inv.created_at ? new Date(inv.created_at).toLocaleString('ar-EG') : '-'}
                        </td>
                        <td style={tdStyle}>
                          <Badge variant={inv.sale_type === 'wholesale' ? 'primary' : 'neutral'} size="sm">
                            {inv.sale_type === 'wholesale' ? 'جملة' : 'قطاعي'}
                          </Badge>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>
                          {parseFloat(inv.total).toFixed(2)} ج.م
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#059669' }}>
                          {parseFloat(inv.paid_amount).toFixed(2)} ج.م
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            fontFamily: 'monospace',
                            color: parseFloat(inv.remaining_amount) > 0 ? '#DC2626' : '#64748B',
                          }}
                        >
                          {parseFloat(inv.remaining_amount).toFixed(2)} ج.م
                        </td>
                        <td style={tdStyle}>
                          {isFullyReturned ? (
                            <Badge variant="neutral" size="sm">
                              مرتجعة بالكامل
                            </Badge>
                          ) : hasPartialReturn ? (
                            <Badge variant="warning" size="sm">
                              مرتجع جزئي (متبقي: {parseFloat(returnableVal).toFixed(2)} ج.م)
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              متاحة للإرجاع
                            </Badge>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <Button
                            type="button"
                            size="sm"
                            variant={isFullyReturned ? 'secondary' : 'primary'}
                            disabled={isFullyReturned}
                            onClick={() => handleSelectInvoiceToReturn(inv.id)}
                            icon={<Check size={14} />}
                          >
                            {isFullyReturned ? 'مسترجعة' : 'اختيار للإرجاع'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Quick-pick invoices bar (when NO customer is selected and NO invoice loaded) */}
      {!initialInvoice && !selectedCustomer && recentInvoices.length > 0 && !invoice && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            padding: '0.625rem 0.875rem',
            backgroundColor: '#F8FAFC',
            borderRadius: '6px',
            border: '1px solid #E2E8F0',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
            أحدث الفواتير المسجلة للاختيار السريع:
          </span>
          {recentInvoices
            .filter((rec) => {
              if (rec.status === 'cancelled') return false;
              if (rec.net_after_returns !== undefined && parseFloat(rec.net_after_returns) <= 0.001) return false;
              return true;
            })
            .map((rec) => {
              const hasPartialReturn = Boolean(
                rec.has_returns ||
                  (rec.net_after_returns !== undefined && parseFloat(rec.net_after_returns) < parseFloat(rec.total))
              );
              const displayAmount = hasPartialReturn && rec.net_after_returns ? rec.net_after_returns : rec.total;

              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => {
                    setSearchInvoiceNumber(rec.invoice_number);
                    void (async () => {
                      setIsSearchingInvoice(true);
                      try {
                        const inv = await returnsApi.getReturnableInvoice(rec.id);
                        setInvoice(inv);
                        setCompletedReturn(null);
                        resetForm(inv);
                        if (inv.has_returns) {
                          showToast(
                            `تم فتح الفاتورة ${inv.invoice_number} (يوجد مرتجع جزئي سابق بقيمة ${inv.previously_returned_amount} ج.م)`,
                            'info'
                          );
                        } else {
                          showToast(`تم فتح الفاتورة ${inv.invoice_number}`, 'success');
                        }
                      } catch {
                        showToast('تعذر تحميل بيانات الفاتورة', 'error');
                      } finally {
                        setIsSearchingInvoice(false);
                      }
                    })();
                  }}
                  style={{
                    fontSize: '11px',
                    padding: '0.25rem 0.625rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    color: '#1E293B',
                    fontFamily: 'monospace',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563EB')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#CBD5E1')}
                >
                  <strong>{rec.invoice_number}</strong>
                  {hasPartialReturn && (
                    <span
                      style={{
                        fontSize: '10px',
                        backgroundColor: '#FEF3C7',
                        color: '#B45309',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontWeight: 600,
                      }}
                    >
                      مرتجع جزئي
                    </span>
                  )}
                  <span style={{ color: hasPartialReturn ? '#B45309' : '#059669', fontWeight: 600 }}>
                    ({parseFloat(displayAmount).toFixed(2)} ج.م{hasPartialReturn ? ' متبقي' : ''})
                  </span>
                </button>
              );
            })}
        </div>
      )}

      {/* Completion Screen with Print */}
      {completedReturn ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: '#F0FDF4',
              border: '2px solid #86EFAC',
              borderRadius: '8px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16A34A',
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#166534', margin: 0 }}>
              تم تسجيل واعتماد المرتجع / الاستبدال بنجاح!
            </h3>

            <p style={{ fontSize: '14px', color: '#15803D', margin: 0, maxWidth: '520px' }}>
              تم معالجة حركة المخزون واسترجاع السليم لمخزن المعرض وتحويل التالف للتوالف وتعديل الحساب المالي وإدراج الإيصال برقم:
            </p>

            <div
              style={{
                fontSize: '20px',
                fontWeight: 800,
                fontFamily: 'monospace',
                backgroundColor: '#FFFFFF',
                padding: '0.4rem 1.25rem',
                borderRadius: '6px',
                border: '1px solid #BBF7D0',
                color: '#166534',
              }}
            >
              {completedReturn.return_number}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                width: '100%',
                maxWidth: '650px',
                backgroundColor: '#FFFFFF',
                padding: '1rem',
                borderRadius: '6px',
                border: '1px solid #E2E8F0',
                fontSize: '13px',
                textAlign: 'right',
                marginTop: '0.5rem',
              }}
            >
              <div>
                الفاتورة الأصلية: <strong style={{ fontFamily: 'monospace' }}>{completedReturn.invoice_number}</strong>
              </div>
              <div>
                العميل: <strong>{completedReturn.customer_name || 'نقدي / عام'}</strong>
              </div>
              <div>
                طريقة التسوية: <strong>{completedReturn.resolution_label}</strong>
              </div>
              <div>
                إجمالي المرتجع:{' '}
                <strong style={{ color: '#B45309', fontSize: '15px' }}>
                  {parseFloat(completedReturn.total_return_amount).toFixed(2)} ج.م
                </strong>
              </div>
              {completedReturn.replacement_invoice_number && (
                <div style={{ gridColumn: '1 / -1', color: '#1D4ED8' }}>
                  فاتورة الاستبدال البديلة: <strong>{completedReturn.replacement_invoice_number}</strong>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.75rem' }}>
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsPrintModalOpen(true)}
                icon={<Printer size={16} />}
              >
                طباعة إيصال المرتجع
              </Button>

              {completedReturn.replacement_invoice_id && onOpenInvoice && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => onOpenInvoice(completedReturn.replacement_invoice_id as number)}
                  icon={<FileText size={16} />}
                >
                  عرض الفاتورة البديلة ({completedReturn.replacement_invoice_number})
                </Button>
              )}

              {onOpenInvoice && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => onOpenInvoice(completedReturn.invoice_id)}
                  icon={<FileText size={16} />}
                >
                  عرض الفاتورة الأصلية وموقفها
                </Button>
              )}

              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  setCompletedReturn(null);
                  setInvoice(null);
                  setSearchInvoiceNumber('');
                }}
                icon={<RotateCw size={16} />}
              >
                إجراء مرتجع آخر
              </Button>

              {onClose && (
                <Button variant="secondary" size="md" onClick={onClose}>
                  إغلاق
                </Button>
              )}
            </div>
          </div>

          <ReturnPrintModal
            salesReturn={completedReturn}
            isOpen={isPrintModalOpen}
            onClose={() => setIsPrintModalOpen(false)}
          />
        </div>
      ) : (
        <>
          {invoice ? (
            <>
              {/* Invoice Context Card */}
              <Card dense>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '0.6rem',
                    marginBottom: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 'bold',
                        color: 'var(--color-primary-700)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {invoice.invoice_number}
                    </span>
                    <Badge variant={invoice.sale_type === 'wholesale' ? 'primary' : 'neutral'} size="sm">
                      {invoice.sale_type_label} (
                      {invoice.sale_type === 'wholesale' ? 'تسعير جملة' : 'تسعير قطاعي'})
                    </Badge>
                    <Badge variant={invoice.status === 'posted' ? 'success' : 'danger'} size="sm">
                      {invoice.status_label}
                    </Badge>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      تاريخ الفاتورة: {invoice.created_at_formatted}
                    </span>
                    {!initialInvoice && (
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setInvoice(null);
                          setSearchInvoiceNumber('');
                        }}
                      >
                        تغيير الفاتورة / بحث جديد
                      </Button>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '0.75rem',
                    fontSize: '0.9rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>العميل: </span>
                    <span style={{ fontWeight: 600 }}>{invoice.customer_name || 'عميل قطاعي نقدي'}</span>
                    {invoice.sale_type === 'wholesale' && invoice.customer_phone && (
                      <span style={{ fontSize: '0.8rem', color: '#64748B', marginRight: '0.35rem' }}>
                        ({invoice.customer_phone})
                      </span>
                    )}
                  </div>
                  {invoice.sale_type === 'wholesale' && (
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>رصيد الحساب بالدفتر: </span>
                      <strong
                        style={{
                          fontFamily: 'monospace',
                          color:
                            invoice.customer_balance && parseFloat(invoice.customer_balance) > 0
                              ? '#DC2626'
                              : invoice.customer_balance && parseFloat(invoice.customer_balance) < 0
                              ? '#2563EB'
                              : '#16A34A',
                        }}
                      >
                        {invoice.customer_balance !== undefined && invoice.customer_balance !== null
                          ? `${parseFloat(invoice.customer_balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م (${parseFloat(invoice.customer_balance) > 0 ? 'مديونية عليه' : parseFloat(invoice.customer_balance) < 0 ? 'دائن له' : 'خالص'})`
                          : selectedCustomer?.balance
                          ? `${parseFloat(selectedCustomer.balance).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م`
                          : 'مسجل بالنظام'}
                      </strong>
                    </div>
                  )}
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>إجمالي الفاتورة: </span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                      {parseFloat(invoice.total).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>المدفوع: </span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-success-700)' }}>
                      {parseFloat(invoice.paid_amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>المتبقي (آجل): </span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--color-danger-700)' }}>
                      {parseFloat(invoice.remaining_amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                </div>

                {invoice.has_returns && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      backgroundColor: '#FFFBEB',
                      border: '1px solid #FCD34D',
                      borderRadius: '6px',
                      color: '#92400E',
                      fontSize: '0.875rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#B45309' }}>
                      <span>⚠️ تنبيه: تم تسجيل مرتجع سابق على هذه الفاتورة</span>
                      {invoice.is_fully_returned && <Badge variant="danger" size="sm">تم إرجاعها بالكامل</Badge>}
                    </div>
                    <div>
                      قيمة المرتجع السابق:{' '}
                      <strong>{parseFloat(invoice.previously_returned_amount || '0').toFixed(2)} ج.م</strong>
                      {' — '}
                      المتبقي المؤهل للإرجاع حالياً:{' '}
                      <strong style={{ color: invoice.is_fully_returned ? '#DC2626' : '#15803D' }}>
                        {parseFloat(invoice.remaining_returnable_amount || '0').toFixed(2)} ج.م
                      </strong>{' '}
                      ({invoice.total_remaining_quantity ?? 0} قطعة متبقية من أصل {invoice.total_original_quantity ?? 0})
                    </div>
                    {invoice.returns_summary && invoice.returns_summary.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#78350F' }}>
                        أرقام المرتجعات المسجلة:{' '}
                        {invoice.returns_summary
                          .map((r) => `${r.return_number} (${parseFloat(r.amount).toFixed(2)} ج.م - ${r.resolution_label})`)
                          .join('، ')}
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {!eligibility.canReturn ? (
                <Alert type="warning" message={eligibility.reason} />
              ) : (
                <>
                  {/* DUAL-TABLE / SPLIT-SCREEN WORK AREA */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
                      gap: '1rem',
                      alignItems: 'start',
                    }}
                  >
                    {/* LEFT PANEL: Items to Return (المرتجع المستلم من العميل) */}
                    <Card
                      dense
                      style={{ borderTop: '3px solid #EF4444' }}
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: '#B91C1C', fontWeight: 800 }}>الأصناف المراد إرجاعها (مرتجع)</span>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            ({selectedReturnItems.length} صنف محدد)
                          </span>
                        </div>
                      }
                      actions={
                        invoice.items.some((i) => i.remaining_returnable_quantity > 0) ? (
                          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={() => {
                                const allQtys: Record<number, number> = {};
                                const allConds: Record<number, 'resellable' | 'damaged'> = {};
                                invoice.items.forEach((item) => {
                                  if (item.remaining_returnable_quantity > 0) {
                                    allQtys[item.id] = item.remaining_returnable_quantity;
                                    allConds[item.id] = returnConditions[item.id] || 'resellable';
                                  }
                                });
                                setReturnQuantities(allQtys);
                                setReturnConditions(allConds);
                                showToast('تم تحديد جميع الأصناف المتبقية للإرجاع بالكامل', 'info');
                              }}
                            >
                              إرجاع كل المتبقي
                            </Button>
                            {Object.keys(returnQuantities).length > 0 && (
                              <Button
                                variant="secondary"
                                size="sm"
                                type="button"
                                onClick={() => setReturnQuantities({})}
                              >
                                تفريغ
                              </Button>
                            )}
                          </div>
                        ) : undefined
                      }
                    >
                      <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#FEF2F2', borderBottom: '2px solid #FCA5A5' }}>
                              <th style={thStyle}>الصنف</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>المتاح</th>
                              <th style={thStyle}>السعر</th>
                              <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>الكمية</th>
                              <th style={{ ...thStyle, width: '130px' }}>حالة الصنف</th>
                              <th style={{ ...thStyle, width: '150px' }}>سبب الإرجاع</th>
                              <th style={thStyle}>القيمة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoice.items.map((item, idx) => {
                              const currentQty = returnQuantities[item.id] || 0;
                              const lineReturnVal = currentQty * parseFloat(item.unit_sale_price);
                              const condition = returnConditions[item.id] || 'resellable';
                              const reason = returnReasons[item.id] || '';
                              const firstReturnableIdx = invoice.items.findIndex(
                                (i) => i.remaining_returnable_quantity > 0
                              );

                              return (
                                <tr
                                  key={item.id}
                                  style={{
                                    borderBottom: '1px solid #F1F5F9',
                                    backgroundColor: currentQty > 0 ? '#FFF5F5' : 'transparent',
                                  }}
                                >
                                  <td style={tdStyle}>
                                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                      {item.product_name}
                                      {isOwner && item.item_type === 'external' && (
                                        <Badge variant="warning" size="sm">
                                          صنف خارجي
                                        </Badge>
                                      )}
                                    </div>
                                    {item.barcode && (
                                      <div style={{ fontSize: '0.72rem', color: '#64748B', fontFamily: 'monospace' }}>
                                        {item.barcode}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>
                                    {item.remaining_returnable_quantity}
                                  </td>
                                  <td style={{ ...tdStyle, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                    {parseFloat(item.unit_sale_price).toFixed(2)}
                                  </td>
                                  <td style={tdStyle}>
                                    {item.remaining_returnable_quantity > 0 ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                        <button
                                          type="button"
                                          disabled={currentQty <= 0}
                                          onClick={() =>
                                            handleQuantityChange(
                                              item.id,
                                              item.remaining_returnable_quantity,
                                              String(Math.max(0, currentQty - 1))
                                            )
                                          }
                                          style={{
                                            padding: '2px 6px',
                                            border: '1px solid #CBD5E1',
                                            borderRadius: '3px',
                                            background: '#F8FAFC',
                                            cursor: currentQty <= 0 ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          <Minus size={11} />
                                        </button>
                                        <input
                                          type="number"
                                          min={0}
                                          max={item.remaining_returnable_quantity}
                                          value={currentQty || ''}
                                          placeholder="0"
                                          aria-label={`الكمية المرتجعة من ${item.product_name}`}
                                          autoFocus={Boolean(initialInvoice) && idx === firstReturnableIdx}
                                          onChange={(e) =>
                                            handleQuantityChange(
                                              item.id,
                                              item.remaining_returnable_quantity,
                                              e.target.value
                                            )
                                          }
                                          style={{
                                            width: '50px',
                                            padding: '0.25rem',
                                            borderRadius: '4px',
                                            border:
                                              currentQty > 0
                                                ? '2px solid #DC2626'
                                                : '1px solid #CBD5E1',
                                            textAlign: 'center',
                                            fontWeight: 'bold',
                                            fontFamily: 'monospace',
                                          }}
                                        />
                                        <button
                                          type="button"
                                          disabled={currentQty >= item.remaining_returnable_quantity}
                                          onClick={() =>
                                            handleQuantityChange(
                                              item.id,
                                              item.remaining_returnable_quantity,
                                              String(currentQty + 1)
                                            )
                                          }
                                          style={{
                                            padding: '2px 6px',
                                            border: '1px solid #CBD5E1',
                                            borderRadius: '3px',
                                            background: '#F8FAFC',
                                            cursor:
                                              currentQty >= item.remaining_returnable_quantity
                                                ? 'not-allowed'
                                                : 'pointer',
                                          }}
                                        >
                                          <Plus size={11} />
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>تم إرجاعه</span>
                                    )}
                                  </td>
                                  <td style={tdStyle}>
                                    {currentQty > 0 ? (
                                      <select
                                        value={condition}
                                        onChange={(e) =>
                                          handleConditionChange(item.id, e.target.value as 'resellable' | 'damaged')
                                        }
                                        style={{
                                          fontSize: '11.5px',
                                          padding: '0.25rem',
                                          borderRadius: '4px',
                                          border: `1px solid ${condition === 'damaged' ? '#EF4444' : '#10B981'}`,
                                          backgroundColor: condition === 'damaged' ? '#FEF2F2' : '#F0FDF4',
                                          color: condition === 'damaged' ? '#B91C1C' : '#047857',
                                          fontWeight: 600,
                                          width: '100%',
                                        }}
                                      >
                                        <option value="resellable">✓ سليم (صالح للبيع)</option>
                                        <option value="damaged">⚠️ تالف / عيب مصنعي</option>
                                      </select>
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontSize: '11px' }}>—</span>
                                    )}
                                  </td>
                                  <td style={tdStyle}>
                                    {currentQty > 0 ? (
                                      <select
                                        value={reason}
                                        onChange={(e) => handleReasonChange(item.id, e.target.value)}
                                        style={{
                                          fontSize: '11px',
                                          padding: '0.25rem',
                                          borderRadius: '4px',
                                          border: '1px solid #CBD5E1',
                                          width: '100%',
                                        }}
                                      >
                                        <option value="">اختر السبب...</option>
                                        {RETURN_REASONS.map((r) => (
                                          <option key={r} value={r}>
                                            {r}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span style={{ color: '#94A3B8', fontSize: '11px' }}>—</span>
                                    )}
                                  </td>
                                  <td
                                    style={{
                                      ...tdStyle,
                                      fontFamily: 'monospace',
                                      fontWeight: 'bold',
                                      color: lineReturnVal > 0 ? '#B91C1C' : '#64748B',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {lineReturnVal > 0 ? `-${lineReturnVal.toFixed(2)}` : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Left Panel Subtotal Footer */}
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.625rem 0.875rem',
                          backgroundColor: '#FEF2F2',
                          border: '1px solid #FCA5A5',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: '#991B1B',
                        }}
                      >
                        <span>إجمالي قيمة المرتجع المحددة (أ):</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
                          -{totalReturnAmount.toFixed(2)} ج.م
                        </span>
                      </div>
                    </Card>

                    {/* RIGHT PANEL: New Exchange Items (أصناف الاستبدال البديلة) */}
                    <Card
                      dense
                      style={{ borderTop: '3px solid #10B981' }}
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: '#047857', fontWeight: 800 }}>أصناف الاستبدال البديلة (بضاعة جديدة)</span>
                          <span style={{ fontSize: '11px', color: '#64748B' }}>
                            ({replacementItems.length} صنف بديل)
                          </span>
                        </div>
                      }
                      actions={
                        <Badge variant={invoice.sale_type === 'wholesale' ? 'primary' : 'neutral'} size="sm">
                          تطبيق {invoice.sale_type === 'wholesale' ? 'أسعار الجملة' : 'أسعار القطاعي'}
                        </Badge>
                      }
                    >
                      {/* Search / Scan input for replacement products */}
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <Input
                            placeholder="ابحث بالاسم أو الباركود لإضافة صنف استبدال (ثم Enter)..."
                            value={replacementSearch}
                            onChange={(e) => setReplacementSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSearchReplacement();
                              }
                            }}
                          />
                        </div>
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={handleSearchReplacement}
                          isLoading={isSearchingReplacement}
                          icon={<Search size={14} />}
                        >
                          بحث
                        </Button>
                      </div>

                      {/* Dropdown results */}
                      {replacementSearchResults.length > 0 && (
                        <div
                          style={{
                            backgroundColor: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '6px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            padding: '0.375rem',
                            marginBottom: '0.75rem',
                            maxHeight: '180px',
                            overflowY: 'auto',
                          }}
                        >
                          <div style={{ fontSize: '11px', color: '#64748B', padding: '0.25rem 0.5rem', fontWeight: 600 }}>
                            نتائج البحث (اضغط للإضافة):
                          </div>
                          {replacementSearchResults.map((prod) => {
                            const applicablePrice =
                              invoice.sale_type === 'wholesale'
                                ? parseFloat(prod.wholesale_price)
                                : parseFloat(prod.retail_price);

                            return (
                              <button
                                key={prod.id}
                                type="button"
                                onClick={() => handleAddReplacementProduct(prod)}
                                style={{
                                  display: 'flex',
                                  width: '100%',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '0.4rem 0.5rem',
                                  border: 'none',
                                  borderBottom: '1px solid #F1F5F9',
                                  backgroundColor: 'transparent',
                                  cursor: 'pointer',
                                  textAlign: 'right',
                                  fontSize: '12px',
                                  borderRadius: '4px',
                                  transition: 'background-color 0.1s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F0FDF4')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                <span>
                                  <strong style={{ color: '#0F172A' }}>{prod.name}</strong>
                                  <span style={{ fontSize: '10px', color: '#64748B', marginRight: '6px' }}>
                                    (رصيد: {prod.stock_quantity})
                                  </span>
                                </span>
                                <span style={{ fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>
                                  +{applicablePrice.toFixed(2)} ج.م
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Replacement items table or empty guidance */}
                      {replacementItems.length > 0 ? (
                        <div style={{ overflowX: 'auto', maxHeight: '360px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#F0FDF4', borderBottom: '2px solid #86EFAC' }}>
                                <th style={thStyle}>الصنف البديل</th>
                                <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>الكمية</th>
                                <th style={thStyle}>السعر</th>
                                <th style={thStyle}>الإجمالي</th>
                                <th style={{ ...thStyle, width: '45px', textAlign: 'center' }}>حذف</th>
                              </tr>
                            </thead>
                            <tbody>
                              {replacementItems.map((r, idx) => (
                                <tr key={r.product.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  <td style={tdStyle}>
                                    <div style={{ fontWeight: 600 }}>{r.product.name}</div>
                                    <div style={{ fontSize: '11px', color: '#64748B' }}>
                                      رصيد المعرض: {r.product.stock_quantity}
                                    </div>
                                  </td>
                                  <td style={tdStyle}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateReplacementQty(idx, r.quantity - 1)}
                                        style={{
                                          padding: '2px 6px',
                                          border: '1px solid #CBD5E1',
                                          borderRadius: '3px',
                                          background: '#F8FAFC',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        <Minus size={11} />
                                      </button>
                                      <input
                                        type="number"
                                        min={1}
                                        value={r.quantity}
                                        aria-label={`كمية البديل ${r.product.name}`}
                                        onChange={(e) =>
                                          handleUpdateReplacementQty(idx, parseInt(e.target.value, 10) || 1)
                                        }
                                        style={{
                                          width: '45px',
                                          padding: '0.25rem',
                                          borderRadius: '4px',
                                          border: '1px solid #10B981',
                                          textAlign: 'center',
                                          fontWeight: 'bold',
                                          fontFamily: 'monospace',
                                        }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateReplacementQty(idx, r.quantity + 1)}
                                        style={{
                                          padding: '2px 6px',
                                          border: '1px solid #CBD5E1',
                                          borderRadius: '3px',
                                          background: '#F8FAFC',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        <Plus size={11} />
                                      </button>
                                    </div>
                                  </td>
                                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>
                                    {r.unit_sale_price.toFixed(2)}
                                  </td>
                                  <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700, color: '#047857' }}>
                                    +{(r.unit_sale_price * r.quantity).toFixed(2)}
                                  </td>
                                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => handleRemoveReplacement(idx)}
                                      title="حذف البديل"
                                      aria-label="حذف البديل"
                                    >
                                      <Trash2 size={13} />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: '1.5rem',
                            textAlign: 'center',
                            backgroundColor: '#F8FAFC',
                            borderRadius: '6px',
                            border: '1px dashed #CBD5E1',
                            color: '#64748B',
                            fontSize: '12.5px',
                          }}
                        >
                          <div style={{ marginBottom: '4px', fontWeight: 600, color: '#475569' }}>
                            لم يتم اختيار أصناف استبدال حتى الآن
                          </div>
                          <div>
                            إذا كان العميل يرغب في إرجاع نقدي أو رصيد حساب فقط، اترك هذا القسم فارغاً. وإذا رغب في
                            استبدال بضاعة، ابحث عن الصنف وأضفه أعلاه.
                          </div>
                        </div>
                      )}

                      {/* Right Panel Subtotal Footer */}
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.625rem 0.875rem',
                          backgroundColor: '#F0FDF4',
                          border: '1px solid #86EFAC',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: '#166534',
                        }}
                      >
                        <span>إجمالي قيمة الاستبدال الجديدة (ب):</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
                          +{totalReplacementAmount.toFixed(2)} ج.م
                        </span>
                      </div>
                    </Card>
                  </div>

                  {/* FINANCIAL SETTLEMENT ENGINE & RESOLUTION */}
                  <Card dense title="المحرك المالي لتسوية المرتجع / الاستبدال">
                    {/* Live Tri-Metric Settlement Display */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                        gap: '0.75rem',
                        padding: '0.85rem',
                        backgroundColor: '#F8FAFC',
                        borderRadius: '6px',
                        border: '1px solid #E2E8F0',
                        marginBottom: '1rem',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>إجمالي المرتجع المسترد (أ):</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#DC2626', fontFamily: 'monospace' }}>
                          -{totalReturnAmount.toFixed(2)} ج.م
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '12px', color: '#64748B' }}>إجمالي البضاعة البديلة (ب):</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#16A34A', fontFamily: 'monospace' }}>
                          +{totalReplacementAmount.toFixed(2)} ج.م
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '0.4rem 0.75rem',
                          borderRadius: '6px',
                          backgroundColor:
                            netBalance > 0 ? '#FEF3C7' : netBalance < 0 ? '#EFF6FF' : '#DCFCE7',
                          border: `1px solid ${netBalance > 0 ? '#FCD34D' : netBalance < 0 ? '#BFDBFE' : '#86EFAC'}`,
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B' }}>
                          صافي الرصيد والتسوية (ب - أ):
                        </div>
                        <div
                          style={{
                            fontSize: '18px',
                            fontWeight: 800,
                            fontFamily: 'monospace',
                            color: netBalance > 0 ? '#B45309' : netBalance < 0 ? '#1D4ED8' : '#15803D',
                          }}
                        >
                          {netBalance > 0
                            ? `+${netBalance.toFixed(2)} ج.م (مطلوب من العميل)`
                            : netBalance < 0
                            ? `${netBalance.toFixed(2)} ج.م (مستحق للعميل)`
                            : '0.00 ج.م (استبدال متطابق)'}
                        </div>
                      </div>
                    </div>

                    {/* Resolution Radio Controls */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '0.5rem', color: '#334155' }}>
                        طريقة تسوية العملية:
                      </div>
                      <div
                        role="radiogroup"
                        aria-label="طريقة تسوية المرتجع"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                          gap: '0.625rem',
                        }}
                      >
                        {RESOLUTION_OPTIONS.map((opt) => {
                          const isCreditOption = opt.value === 'customer_account_credit';
                          const isDisabled = isCreditOption && !invoice.customer_id;
                          const isSelected = resolution === opt.value;

                          return (
                            <label
                              key={opt.value}
                              style={{
                                display: 'block',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                border: isSelected ? '2px solid #2563EB' : '1px solid #CBD5E1',
                                backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                opacity: isDisabled ? 0.5 : 1,
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <input
                                  type="radio"
                                  name="return-resolution"
                                  value={opt.value}
                                  disabled={isDisabled}
                                  checked={isSelected}
                                  onChange={() => setResolution(opt.value)}
                                />
                                <span style={{ fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '13px' }}>
                                  {opt.icon} {opt.label}
                                </span>
                              </span>
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748B' }}>
                                {isDisabled ? 'غير متاح (الفاتورة غير مرتبطة بعميل مسجل)' : opt.description}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Customer Account Credit Ledger Breakdown */}
                    {resolution === 'customer_account_credit' && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.85rem',
                          backgroundColor: '#EFF6FF',
                          borderRadius: '6px',
                          border: '1px solid #BFDBFE',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.5rem',
                            color: '#1D4ED8',
                            fontWeight: 700,
                            fontSize: '13px',
                          }}
                        >
                          <UserCheck size={16} />
                          <span>الأثر المالي المباشر على كشف حساب العميل:</span>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '0.75rem',
                            fontSize: '13px',
                          }}
                        >
                          <div>
                            <span style={{ color: '#64748B' }}>العميل: </span>
                            <strong>{invoice.customer_name}</strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748B' }}>رصيد الحساب الحالي: </span>
                            <strong style={{ fontFamily: 'monospace' }}>
                              {invoice.customer_balance !== undefined && invoice.customer_balance !== null
                                ? `${parseFloat(invoice.customer_balance).toFixed(2)} ج.م (${parseFloat(invoice.customer_balance) > 0 ? 'مديونية عليه' : parseFloat(invoice.customer_balance) < 0 ? 'دائن له' : 'خالص'})`
                                : selectedCustomer?.balance
                                ? `${parseFloat(selectedCustomer.balance).toFixed(2)} ج.م`
                                : 'مسجل بالنظام'}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748B' }}>قيمة المرتجع المضافة لدائن العميل: </span>
                            <strong style={{ fontFamily: 'monospace', color: '#16A34A' }}>
                              +{totalReturnAmount.toFixed(2)} ج.م
                            </strong>
                          </div>
                          {invoice.customer_balance !== undefined && invoice.customer_balance !== null && (
                            <div>
                              <span style={{ color: '#64748B' }}>الرصيد المحتسب بعد المرتجع: </span>
                              <strong style={{ fontFamily: 'monospace', color: '#1D4ED8' }}>
                                {(parseFloat(invoice.customer_balance) - totalReturnAmount).toFixed(2)} ج.م
                              </strong>
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: '11.5px',
                            color: '#2563EB',
                            marginTop: '0.5rem',
                            borderTop: '1px dashed #BFDBFE',
                            paddingTop: '0.4rem',
                          }}
                        >
                          ✓ سيتم تسجيل قيد المرتجع دائن تلقائياً في كشف حساب العميل لتخفيض دينه أو ترحيل رصيد لصالحه دون صرف نقدي.
                        </div>
                      </div>
                    )}

                    {/* Conditional Payment Method Selectors */}
                    {resolution === 'refund_cash' && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '6px',
                        }}
                      >
                        <Select
                          label="طريقة صرف الاسترداد النقدي (من الخزينة)"
                          value={refundPaymentMethodId ? String(refundPaymentMethodId) : ''}
                          onChange={(e) => setRefundPaymentMethodId(Number(e.target.value))}
                          options={paymentMethods.map((pm) => ({ value: String(pm.id), label: pm.name }))}
                        />
                        {invoice.customer_id && (
                          <div style={{ marginTop: '0.5rem', fontSize: '11.5px', color: '#0369A1' }}>
                            ℹ️ عميل جملة مسجل: سيتم إثبات قيد المرتجع (دائن) وقيد الصرف النقدي (مدين) في كشف حساب العميل لتوثيق حركة الاسترداد كاملة.
                          </div>
                        )}
                      </div>
                    )}

                    {resolution === 'exchange_upgrade' && differenceAmount > 0 && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.75rem',
                          backgroundColor: '#FEF3C7',
                          borderRadius: '6px',
                          border: '1px solid #FCD34D',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#92400E',
                            marginBottom: '0.35rem',
                          }}
                        >
                          فارق ترقية مطلوب تحصيله من العميل: {differenceAmount.toFixed(2)} ج.م
                        </div>
                        <Select
                          label="طريقة سداد فارق الاستبدال الإضافي"
                          value={differencePaymentMethodId ? String(differencePaymentMethodId) : ''}
                          onChange={(e) => setDifferencePaymentMethodId(Number(e.target.value))}
                          options={paymentMethods.map((pm) => ({ value: String(pm.id), label: pm.name }))}
                        />
                        {invoice.customer_id && (
                          <div style={{ marginTop: '0.5rem', fontSize: '11.5px', color: '#92400E' }}>
                            ℹ️ عميل جملة مسجل: سيتم قيد المرتجع (دائن)، وفاتورة الاستبدال (مدين)، وسداد فارق الترقية في كشف حساب العميل.
                          </div>
                        )}
                      </div>
                    )}

                    {resolution === 'exchange_equal' && (
                      <div
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.625rem',
                          backgroundColor: '#F0FDF4',
                          borderRadius: '6px',
                          border: '1px solid #86EFAC',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                          color: '#166534',
                          fontSize: '12.5px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Check size={16} color="#16A34A" />
                          <span>القيمة متطابقة تماماً. لا توجد أي تسوية نقدية مطلوبة بين العميل والمعرض.</span>
                        </div>
                        {invoice.customer_id && (
                          <div style={{ fontSize: '11.5px', color: '#15803D' }}>
                            ℹ️ عميل جملة مسجل: سيتم تسجيل قيد استرجاع البضاعة (دائن) وقيد بضاعة الاستبدال (مدين) بالتساوي في حسابه.
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginTop: '0.75rem' }}>
                      <Input
                        label="ملاحظات المرتجع (اختياري)"
                        placeholder="سبب المرتجع، حالة البضاعة المرتجعة، تفاصيل إضافية..."
                        value={returnNotes}
                        onChange={(e) => setReturnNotes(e.target.value)}
                      />
                    </div>

                    {/* Confirmation Checkbox */}
                    <div style={{ marginTop: '1rem' }}>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          padding: '0.625rem 0.875rem',
                          backgroundColor: isCashConfirmed ? '#F0FDF4' : '#FFFBEB',
                          border: `1px solid ${isCashConfirmed ? '#86EFAC' : '#FCD34D'}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: isCashConfirmed ? '#166534' : '#92400E',
                        }}
                      >
                        <input
                          type="checkbox"
                          id="cashier-confirm-checkbox"
                          checked={isCashConfirmed}
                          onChange={(e) => setIsCashConfirmed(e.target.checked)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span>
                          أؤكد مراجعة الأصناف المرتجعة والبدائل والمبالغ المالية (صرف أو تحصيل نقدي) واستلام/تسليم
                          البضاعة فعلياً
                        </span>
                      </label>
                    </div>

                    {/* Submit Actions */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                      {onClose && (
                        <Button variant="secondary" onClick={onClose}>
                          إلغاء
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        disabled={!isResolutionValid() || !isCashConfirmed || isSubmitting}
                        isLoading={isSubmitting}
                        onClick={handleSubmitReturn}
                      >
                        تأكيد وتنفيذ عملية المرتجع ({totalReturnAmount.toFixed(2)} ج.م)
                      </Button>
                    </div>
                  </Card>
                </>
              )}
            </>
          ) : (
            <EmptyState
              title="ابحث عن الفاتورة الأصلية لبدء المرتجع"
              description="كل مرتجع يُسجَّل على فاتورة بيع أصلية. أدخل رقم الفاتورة أو امسح باركودها ثم اضغط Enter"
            />
          )}
        </>
      )}
    </div>
  );
};

export default ReturnFlow;
