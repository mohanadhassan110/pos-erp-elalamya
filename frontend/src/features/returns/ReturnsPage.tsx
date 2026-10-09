import React, { useState, useEffect, useCallback } from 'react';
import { returnsApi } from '../../services/api/returnsApi';
import { productsApi } from '../../services/api/productsApi';
import { paymentMethodsApi } from '../../services/api/paymentMethodsApi';
import { useToast } from '../../app/providers/useToast';
import type {
  ReturnableInvoice,
  SalesReturn,
  SalesReturnResolution,
  PaymentMethod,
  Product,
} from '../../types/domain';
import {
  Card,
  Button,
  Input,
  Select,
  Badge,
  Modal,
  Table,
  EmptyState,
} from '../../components/ui';

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

export const ReturnsPage: React.FC = () => {
  const { showToast } = useToast();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');

  // Search Invoice State
  const [searchInvoiceNumber, setSearchInvoiceNumber] = useState<string>('');
  const [isSearchingInvoice, setIsSearchingInvoice] = useState<boolean>(false);
  const [invoice, setInvoice] = useState<ReturnableInvoice | null>(null);

  // Return Quantities: map invoice_item_id -> quantity
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});
  const [resolution, setResolution] = useState<SalesReturnResolution>('refund_cash');
  const [returnNotes, setReturnNotes] = useState<string>('');

  // Payment Methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [refundPaymentMethodId, setRefundPaymentMethodId] = useState<number | ''>('');
  const [differencePaymentMethodId, setDifferencePaymentMethodId] = useState<number | ''>('');

  // Replacement Items (for Exchanges)
  const [replacementSearch, setReplacementSearch] = useState<string>('');
  const [isSearchingReplacement, setIsSearchingReplacement] = useState<boolean>(false);
  const [replacementSearchResults, setReplacementSearchResults] = useState<Product[]>([]);
  const [replacementItems, setReplacementItems] = useState<ReplacementItemRow[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // History Tab State
  const [historyList, setHistoryList] = useState<SalesReturn[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyResolution, setHistoryResolution] = useState<string>('');
  const [selectedReturnDetails, setSelectedReturnDetails] = useState<SalesReturn | null>(null);

  // Load active payment methods
  useEffect(() => {
    let active = true;
    paymentMethodsApi.list()
      .then((methods) => {
        if (active) {
          setPaymentMethods(methods);
          const cash = methods.find((m) => m.is_cash);
          if (cash) {
            setRefundPaymentMethodId(cash.id);
            setDifferencePaymentMethodId(cash.id);
          } else if (methods.length > 0) {
            setRefundPaymentMethodId(methods[0].id);
            setDifferencePaymentMethodId(methods[0].id);
          }
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // Fetch Returns History
  const fetchHistory = useCallback(() => {
    setIsLoadingHistory(true);
    returnsApi.list({
      search: historySearch.trim() || undefined,
      resolution: historyResolution || undefined,
      per_page: 25,
    })
      .then((res) => {
        setHistoryList(res.data);
      })
      .catch(() => {
        showToast('تعذر تحميل سجل المرتجعات', 'error');
      })
      .finally(() => {
        setIsLoadingHistory(false);
      });
  }, [historySearch, historyResolution, showToast]);

  useEffect(() => {
    if (activeTab === 'history') {
      let active = true;
      returnsApi.list({
        search: historySearch.trim() || undefined,
        resolution: historyResolution || undefined,
        per_page: 25,
      })
        .then((res) => {
          if (active) {
            setHistoryList(res.data);
            setIsLoadingHistory(false);
          }
        })
        .catch(() => {
          if (active) {
            setIsLoadingHistory(false);
          }
        });

      return () => {
        active = false;
      };
    }
  }, [activeTab, historySearch, historyResolution]);

  // Handle Search Invoice
  const handleSearchInvoice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchInvoiceNumber.trim();
    if (!query) {
      showToast('يرجى إدخال رقم الفاتورة للبحث', 'warning');
      return;
    }

    setIsSearchingInvoice(true);
    try {
      const inv = await returnsApi.searchInvoice(query);
      setInvoice(inv);
      // Reset return form state
      setReturnQuantities({});
      setReplacementItems([]);
      setReturnNotes('');
      // Default resolution based on sale type and customer
      if (inv.customer_id) {
        setResolution('customer_account_credit');
      } else {
        setResolution('refund_cash');
      }
      showToast(`تم العثور على الفاتورة ${inv.invoice_number}`, 'success');
    } catch {
      setInvoice(null);
      showToast('لم يتم العثور على فاتورة مبيعات بهذا الرقم', 'error');
    } finally {
      setIsSearchingInvoice(false);
    }
  };

  // Quantity change handler for invoice items
  const handleQuantityChange = (itemId: number, maxQty: number, valueStr: string) => {
    const val = parseInt(valueStr, 10);
    if (isNaN(val) || val <= 0) {
      const next = { ...returnQuantities };
      delete next[itemId];
      setReturnQuantities(next);
      return;
    }
    const clamped = Math.min(Math.max(1, val), maxQty);
    setReturnQuantities((prev) => ({
      ...prev,
      [itemId]: clamped,
    }));
  };

  // Calculate Selected Return Items & Totals
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

  // Search Replacement Products
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

  const handleAddReplacementProduct = (product: Product) => {
    const defaultPrice = invoice?.sale_type === 'wholesale'
      ? parseFloat(product.wholesale_price)
      : parseFloat(product.retail_price);

    const existingIdx = replacementItems.findIndex((r) => r.product.id === product.id);
    if (existingIdx >= 0) {
      const updated = [...replacementItems];
      updated[existingIdx].quantity += 1;
      setReplacementItems(updated);
    } else {
      setReplacementItems((prev) => [
        ...prev,
        {
          product,
          quantity: 1,
          unit_sale_price: defaultPrice,
        },
      ]);
    }
    setReplacementSearch('');
    setReplacementSearchResults([]);
    showToast(`تمت إضافة '${product.name}' كبديل`, 'info');
  };

  const handleUpdateReplacementQty = (index: number, qty: number) => {
    if (qty <= 0) {
      setReplacementItems((prev) => prev.filter((_, i) => i !== index));
      return;
    }
    const updated = [...replacementItems];
    updated[index].quantity = qty;
    setReplacementItems(updated);
  };

  const handleRemoveReplacement = (index: number) => {
    setReplacementItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalReplacementAmount = replacementItems.reduce(
    (sum, r) => sum + r.unit_sale_price * r.quantity,
    0
  );

  const differenceAmount = Math.max(0, totalReplacementAmount - totalReturnAmount);

  // Validation Check before Submit
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

  // Submit Sales Return
  const handleSubmitReturn = async () => {
    if (!invoice || !isResolutionValid()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        idempotency_key: crypto.randomUUID(),
        invoice_id: invoice.id,
        resolution,
        notes: returnNotes.trim() || undefined,
        items: selectedReturnItems.map((item) => ({
          invoice_item_id: item.invoice_item_id,
          quantity: item.quantity,
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
      showToast(`تم تسجيل المرتجع بنجاح برقم: ${result.return_number}`, 'success');

      // Refresh invoice to show updated remaining returnable quantities
      const refreshed = await returnsApi.getReturnableInvoice(invoice.id);
      setInvoice(refreshed);
      setReturnQuantities({});
      setReplacementItems([]);
      setReturnNotes('');
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'حدث خطأ أثناء تنفيذ عملية المرتجع';
      showToast(errorMsg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Header & Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          backgroundColor: 'var(--bg-surface)',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
            مرتجع واستبدال المبيعات
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            معالجة مرتجعات الفواتير، الاسترداد النقدي، الاستبدال المتطابق والترقية، وإيداع أرصدة العملاء
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            variant={activeTab === 'create' ? 'primary' : 'secondary'}
            onClick={() => setActiveTab('create')}
            size="sm"
          >
            🔄 عملية مرتجع جديدة
          </Button>
          <Button
            variant={activeTab === 'history' ? 'primary' : 'secondary'}
            onClick={() => {
              setActiveTab('history');
              fetchHistory();
            }}
            size="sm"
          >
            📋 سجل المرتجعات السابقة
          </Button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Invoice Search Box */}
          <Card>
            <form onSubmit={handleSearchInvoice} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Input
                  label="رقم فاتورة المبيعات"
                  placeholder="مثال: INV-20261008-0001 أو امسح الباركود"
                  value={searchInvoiceNumber}
                  onChange={(e) => setSearchInvoiceNumber(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" variant="primary" isLoading={isSearchingInvoice}>
                🔍 بحث عن الفاتورة
              </Button>
            </form>
          </Card>

          {invoice ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Invoice Information Header */}
              <Card>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--color-primary-700)' }}>
                      {invoice.invoice_number}
                    </span>
                    <Badge variant={invoice.sale_type === 'wholesale' ? 'primary' : 'neutral'} size="sm">
                      {invoice.sale_type_label}
                    </Badge>
                    <Badge variant={invoice.status === 'posted' ? 'success' : 'danger'} size="sm">
                      {invoice.status_label}
                    </Badge>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    تاريخ الفاتورة: {invoice.created_at_formatted}
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    fontSize: '0.9rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>العميل: </span>
                    <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {invoice.customer_name || 'عميل قطاعي نقدي'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>إجمالي الفاتورة: </span>
                    <span style={{ fontWeight: '600', fontFamily: 'monospace' }}>
                      {parseFloat(invoice.total).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>المدفوع: </span>
                    <span style={{ fontWeight: '600', fontFamily: 'monospace', color: 'var(--color-success-700)' }}>
                      {parseFloat(invoice.paid_amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>المتبقي (آجل): </span>
                    <span style={{ fontWeight: '600', fontFamily: 'monospace', color: 'var(--color-danger-700)' }}>
                      {parseFloat(invoice.remaining_amount).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م
                    </span>
                  </div>
                </div>
              </Card>

              {/* Returnable Items Table */}
              <Card title="الأصناف المتاحة للإرجاع">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '2px solid var(--border-default)' }}>
                        <th style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}>الصنف</th>
                        <th style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}>النوع</th>
                        <th style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}>المباع</th>
                        <th style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}>المرتجع سابقاً</th>
                        <th style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}>المتاح للإرجاع</th>
                        <th style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}>سعر الوحدة</th>
                        <th style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem', width: '130px' }}>الكمية المرتجعة</th>
                        <th style={{ padding: '0.6rem 0.75rem', fontSize: '0.85rem' }}>قيمة المرتجع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item) => {
                        const currentQty = returnQuantities[item.id] || 0;
                        const lineReturnVal = currentQty * parseFloat(item.unit_sale_price);

                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              <div style={{ fontWeight: '600' }}>{item.product_name}</div>
                              {item.barcode && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                  {item.barcode}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              <Badge variant={item.item_type === 'product' ? 'neutral' : 'warning'} size="sm">
                                {item.item_type === 'product' ? 'صالة العرض' : 'صنف خارجي'}
                              </Badge>
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace' }}>
                              {item.originally_sold_quantity}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                              {item.previously_returned_quantity}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {item.remaining_returnable_quantity}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace' }}>
                              {parseFloat(item.unit_sale_price).toFixed(2)} ج.م
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem' }}>
                              {item.remaining_returnable_quantity > 0 ? (
                                <input
                                  type="number"
                                  min={0}
                                  max={item.remaining_returnable_quantity}
                                  value={currentQty || ''}
                                  placeholder="0"
                                  onChange={(e) =>
                                    handleQuantityChange(item.id, item.remaining_returnable_quantity, e.target.value)
                                  }
                                  style={{
                                    width: '100%',
                                    padding: '0.35rem 0.5rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: currentQty > 0 ? '2px solid var(--color-primary-600)' : '1px solid var(--border-default)',
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    fontFamily: 'monospace',
                                  }}
                                />
                              ) : (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>تم إرجاعه بالكامل</span>
                              )}
                            </td>
                            <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontWeight: 'bold', color: lineReturnVal > 0 ? 'var(--color-success-700)' : 'inherit' }}>
                              {lineReturnVal > 0 ? `${lineReturnVal.toFixed(2)} ج.م` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: '1rem',
                    paddingTop: '0.75rem',
                    borderTop: '2px solid var(--border-default)',
                    fontSize: '1.05rem',
                    fontWeight: 'bold',
                  }}
                >
                  <span>إجمالي قيمة المرتجع المحددة:&nbsp;</span>
                  <span style={{ color: 'var(--color-primary-700)', fontFamily: 'monospace' }}>
                    {totalReturnAmount.toFixed(2)} ج.م
                  </span>
                </div>
              </Card>

              {/* Resolution Options */}
              <Card title="تحديد طريقة تسوية المرتجع">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {/* Option 1: Cash Refund */}
                  <div
                    onClick={() => setResolution('refund_cash')}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: resolution === 'refund_cash' ? '2px solid var(--color-primary-600)' : '1px solid var(--border-default)',
                      backgroundColor: resolution === 'refund_cash' ? 'var(--color-primary-50)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <input
                        type="radio"
                        checked={resolution === 'refund_cash'}
                        onChange={() => setResolution('refund_cash')}
                      />
                      <span style={{ fontWeight: 'bold' }}>💵 استرداد نقدي</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      صرف قيمة المرتجع نقداً للعميل مباشرة من الخزينة
                    </p>
                  </div>

                  {/* Option 2: Equal Exchange */}
                  <div
                    onClick={() => setResolution('exchange_equal')}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: resolution === 'exchange_equal' ? '2px solid var(--color-primary-600)' : '1px solid var(--border-default)',
                      backgroundColor: resolution === 'exchange_equal' ? 'var(--color-primary-50)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <input
                        type="radio"
                        checked={resolution === 'exchange_equal'}
                        onChange={() => setResolution('exchange_equal')}
                      />
                      <span style={{ fontWeight: 'bold' }}>⚖️ استبدال متطابق القيمة</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      استبدال ببضاعة بديلة بنفس قيمة المرتجع دون فارق نقدي
                    </p>
                  </div>

                  {/* Option 3: Upgrade Exchange */}
                  <div
                    onClick={() => setResolution('exchange_upgrade')}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: resolution === 'exchange_upgrade' ? '2px solid var(--color-primary-600)' : '1px solid var(--border-default)',
                      backgroundColor: resolution === 'exchange_upgrade' ? 'var(--color-primary-50)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <input
                        type="radio"
                        checked={resolution === 'exchange_upgrade'}
                        onChange={() => setResolution('exchange_upgrade')}
                      />
                      <span style={{ fontWeight: 'bold' }}>⬆️ استبدال بقيمة أعلى (ترقية)</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      استبدال ببضاعة أعلى قيمة وتحصيل الفارق الإضافي من العميل
                    </p>
                  </div>

                  {/* Option 4: Customer Account Credit */}
                  <div
                    onClick={() => {
                      if (invoice.customer_id) {
                        setResolution('customer_account_credit');
                      }
                    }}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      border: resolution === 'customer_account_credit' ? '2px solid var(--color-primary-600)' : '1px solid var(--border-default)',
                      backgroundColor: resolution === 'customer_account_credit' ? 'var(--color-primary-50)' : 'var(--bg-surface)',
                      cursor: invoice.customer_id ? 'pointer' : 'not-allowed',
                      opacity: invoice.customer_id ? 1 : 0.6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <input
                        type="radio"
                        disabled={!invoice.customer_id}
                        checked={resolution === 'customer_account_credit'}
                        onChange={() => setResolution('customer_account_credit')}
                      />
                      <span style={{ fontWeight: 'bold' }}>👤 رصيد دائن لحساب العميل</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      {invoice.customer_id
                        ? 'إضافة المبلغ كرصيد دائن على كشف حساب العميل لتخفيض دينه أو شراء مستقبلي'
                        : 'غير متاح (الفاتورة غير مرتبطة بعميل مسجل)'}
                    </p>
                  </div>
                </div>

                {/* Additional Settings for Selected Resolution */}
                {resolution === 'refund_cash' && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <Select
                      label="طريقة صرف الاسترداد النقدي"
                      value={refundPaymentMethodId ? String(refundPaymentMethodId) : ''}
                      onChange={(e) => setRefundPaymentMethodId(Number(e.target.value))}
                      options={paymentMethods.map((pm) => ({
                        value: String(pm.id),
                        label: pm.name,
                      }))}
                    />
                  </div>
                )}

                {(resolution === 'exchange_equal' || resolution === 'exchange_upgrade') && (
                  <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
                      الأصناف البديلة للاستبدال
                    </h3>

                    {/* Replacement Product Search */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <Input
                          placeholder="ابحث عن الصنف البديل بالاسم أو الباركود..."
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
                      <Button variant="secondary" onClick={handleSearchReplacement} isLoading={isSearchingReplacement}>
                        بحث
                      </Button>
                    </div>

                    {/* Replacement Search Results Dropdown/List */}
                    {replacementSearchResults.length > 0 && (
                      <div
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.5rem',
                          marginBottom: '1rem',
                        }}
                      >
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                          نتائج البحث (اضغط للإضافة):
                        </div>
                        {replacementSearchResults.map((prod) => (
                          <div
                            key={prod.id}
                            onClick={() => handleAddReplacementProduct(prod)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.5rem',
                              borderBottom: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: '600' }}>{prod.name}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
                                (متاح: {prod.stock_quantity})
                              </span>
                            </div>
                            <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                              {invoice?.sale_type === 'wholesale' ? prod.wholesale_price : prod.retail_price} ج.م
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected Replacement Items Table */}
                    {replacementItems.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', marginBottom: '1rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                            <th style={{ padding: '0.5rem' }}>الصنف البديل</th>
                            <th style={{ padding: '0.5rem', width: '100px' }}>الكمية</th>
                            <th style={{ padding: '0.5rem' }}>السعر</th>
                            <th style={{ padding: '0.5rem' }}>الإجمالي</th>
                            <th style={{ padding: '0.5rem', width: '60px' }}>إجراء</th>
                          </tr>
                        </thead>
                        <tbody>
                          {replacementItems.map((r, idx) => (
                            <tr key={r.product.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '0.5rem' }}>{r.product.name}</td>
                              <td style={{ padding: '0.5rem' }}>
                                <input
                                  type="number"
                                  min={1}
                                  value={r.quantity}
                                  onChange={(e) => handleUpdateReplacementQty(idx, parseInt(e.target.value, 10) || 1)}
                                  style={{
                                    width: '100%',
                                    padding: '0.25rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-default)',
                                    textAlign: 'center',
                                  }}
                                />
                              </td>
                              <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>
                                {r.unit_sale_price.toFixed(2)} ج.م
                              </td>
                              <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                {(r.unit_sale_price * r.quantity).toFixed(2)} ج.م
                              </td>
                              <td style={{ padding: '0.5rem' }}>
                                <Button size="sm" variant="danger" onClick={() => handleRemoveReplacement(idx)}>
                                  ✕
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        لم يتم اختيار أي أصناف بديلة بعد. يرجى البحث وإضافة الأصناف البديلة أعلاه.
                      </p>
                    )}

                    {/* Comparison Indicator */}
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--bg-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        fontWeight: 'bold',
                      }}
                    >
                      <div>
                        قيمة المرتجع:&nbsp;
                        <span style={{ color: 'var(--color-primary-700)', fontFamily: 'monospace' }}>
                          {totalReturnAmount.toFixed(2)} ج.م
                        </span>
                      </div>
                      <div>
                        قيمة البديل:&nbsp;
                        <span style={{ color: 'var(--color-primary-700)', fontFamily: 'monospace' }}>
                          {totalReplacementAmount.toFixed(2)} ج.م
                        </span>
                      </div>
                      <div>
                        {resolution === 'exchange_equal' ? (
                          Math.abs(totalReplacementAmount - totalReturnAmount) < 0.01 ? (
                            <Badge variant="success">القيمة متطابقة تماماً ✓</Badge>
                          ) : (
                            <Badge variant="danger">
                              غير متطابق بفارق: {(totalReplacementAmount - totalReturnAmount).toFixed(2)} ج.م
                            </Badge>
                          )
                        ) : (
                          <span>
                            الفارق المطلوب تحصيله:&nbsp;
                            <span style={{ color: 'var(--color-success-700)', fontFamily: 'monospace' }}>
                              {differenceAmount.toFixed(2)} ج.م
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Payment Method for Upgrade Difference */}
                    {resolution === 'exchange_upgrade' && differenceAmount > 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        <Select
                          label="طريقة سداد فارق الترقية الإضافي"
                          value={differencePaymentMethodId ? String(differencePaymentMethodId) : ''}
                          onChange={(e) => setDifferencePaymentMethodId(Number(e.target.value))}
                          options={paymentMethods.map((pm) => ({
                            value: String(pm.id),
                            label: pm.name,
                          }))}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Notes Input */}
                <div style={{ marginTop: '1rem' }}>
                  <Input
                    label="ملاحظات المرتجع (اختياري)"
                    placeholder="سبب المرتجع، حالة البضاعة المرتجعة، إلخ..."
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                  />
                </div>
              </Card>

              {/* Action Confirmation Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={!isResolutionValid() || isSubmitting}
                  isLoading={isSubmitting}
                  onClick={handleSubmitReturn}
                >
                  تأكيد وتنفيذ عملية المرتجع ({totalReturnAmount.toFixed(2)} ج.م)
                </Button>
              </div>
            </div>
          ) : (
            <Card>
              <EmptyState
                title="ابحث عن فاتورة لبدء المرتجع"
                description="أدخل رقم الفاتورة في خانة البحث أعلاه لتحميل الأصناف وحساب الكميات المتاحة للإرجاع"
              />
            </Card>
          )}
        </div>
      ) : (
        /* History Log Tab */
        <Card title="سجل المرتجعات السابقة">
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <Input
                placeholder="بحث برقم المرتجع، رقم الفاتورة، أو اسم العميل..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <div style={{ width: '220px' }}>
              <Select
                value={historyResolution}
                onChange={(e) => setHistoryResolution(e.target.value)}
                options={[
                  { value: '', label: 'جميع أنواع التسوية' },
                  { value: 'refund_cash', label: 'استرداد نقدي' },
                  { value: 'exchange_equal', label: 'استبدال متطابق' },
                  { value: 'exchange_upgrade', label: 'استبدال ترقية' },
                  { value: 'customer_account_credit', label: 'رصيد دائن للعميل' },
                ]}
              />
            </div>
          </div>

          {isLoadingHistory ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              جاري تحميل سجل المرتجعات...
            </div>
          ) : historyList.length > 0 ? (
            <Table
              data={historyList}
              keyExtractor={(r) => String(r.id)}
              columns={[
                {
                  key: 'return_number',
                  header: 'رقم المرتجع',
                  render: (r: SalesReturn) => (
                    <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--color-primary-700)' }}>
                      {r.return_number}
                    </span>
                  ),
                },
                {
                  key: 'invoice_number',
                  header: 'الفاتورة الأصلية',
                  render: (r: SalesReturn) => (
                    <span style={{ fontFamily: 'monospace' }}>{r.invoice_number}</span>
                  ),
                },
                {
                  key: 'created_at',
                  header: 'التاريخ',
                  render: (r: SalesReturn) => r.created_at_formatted,
                },
                {
                  key: 'customer',
                  header: 'العميل',
                  render: (r: SalesReturn) => r.customer_name || 'نقدي',
                },
                {
                  key: 'resolution',
                  header: 'نوع التسوية',
                  render: (r: SalesReturn) => (
                    <Badge
                      variant={
                        r.resolution === 'refund_cash'
                          ? 'warning'
                          : r.resolution === 'customer_account_credit'
                          ? 'primary'
                          : 'success'
                      }
                      size="sm"
                    >
                      {r.resolution_label}
                    </Badge>
                  ),
                },
                {
                  key: 'total_return_amount',
                  header: 'قيمة المرتجع',
                  render: (r: SalesReturn) => (
                    <span style={{ fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {parseFloat(r.total_return_amount).toFixed(2)} ج.م
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  header: 'التفاصيل',
                  render: (r: SalesReturn) => (
                    <Button size="sm" variant="secondary" onClick={() => setSelectedReturnDetails(r)}>
                      عرض
                    </Button>
                  ),
                },
              ]}
            />
          ) : (
            <EmptyState title="لا توجد مرتجعات مسجلة" description="لم يتم العثور على أي عمليات مرتجع مطابقة للبحث" />
          )}
        </Card>
      )}

      {/* Details Modal */}
      {selectedReturnDetails && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedReturnDetails(null)}
          title={`تفاصيل المرتجع: ${selectedReturnDetails.return_number}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-subtle)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
              }}
            >
              <div>الفاتورة الأصلية: <strong>{selectedReturnDetails.invoice_number}</strong></div>
              <div>التسوية: <strong>{selectedReturnDetails.resolution_label}</strong></div>
              <div>العميل: <strong>{selectedReturnDetails.customer_name || 'نقدي'}</strong></div>
              <div>المسؤول: <strong>{selectedReturnDetails.creator_name || '—'}</strong></div>
              <div>التاريخ: <strong>{selectedReturnDetails.created_at_formatted}</strong></div>
              <div>إجمالي المرتجع: <strong>{parseFloat(selectedReturnDetails.total_return_amount).toFixed(2)} ج.م</strong></div>
            </div>

            <h4 style={{ margin: '0.5rem 0 0', fontSize: '0.95rem', fontWeight: 'bold' }}>الأصناف المرتجعة</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  <th style={{ padding: '0.4rem' }}>الصنف</th>
                  <th style={{ padding: '0.4rem' }}>الكمية</th>
                  <th style={{ padding: '0.4rem' }}>السعر</th>
                  <th style={{ padding: '0.4rem' }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {selectedReturnDetails.items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.4rem' }}>{it.product_name}</td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{it.quantity}</td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace' }}>{parseFloat(it.unit_sale_price).toFixed(2)} ج.م</td>
                    <td style={{ padding: '0.4rem', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {parseFloat(it.subtotal).toFixed(2)} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selectedReturnDetails.notes && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <strong>ملاحظات:</strong> {selectedReturnDetails.notes}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button variant="secondary" onClick={() => setSelectedReturnDetails(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ReturnsPage;
