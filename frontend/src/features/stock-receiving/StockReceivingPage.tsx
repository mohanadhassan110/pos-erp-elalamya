import React, { useState, useEffect } from 'react';
import { purchasingApi } from '../../services/api/purchasingApi';
import { suppliersApi } from '../../services/api/suppliersApi';
import { productsApi } from '../../services/api/productsApi';
import type { Supplier, Product, StockReceipt, StockReceiptItem } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../app/providers/useToast';

interface LocalReceiptLine {
  productId: number;
  productName: string;
  barcode: string;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export const StockReceivingPage: React.FC = () => {
  const { showToast } = useToast();

  // Active Tab: 'new' | 'history'
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');

  // Master data for select
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState<string>('');

  // Form Header State
  const [supplierId, setSupplierId] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');

  // Line Items in Cart
  const [lines, setLines] = useState<LocalReceiptLine[]>([]);

  // Item Draft Input State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [draftQty, setDraftQty] = useState<string>('1');
  const [draftCost, setDraftCost] = useState<string>('');

  // Submission State & Idempotency Key
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successReceiptNumber, setSuccessReceiptNumber] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `sr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);

  // Historical Receipts State
  const [pastReceipts, setPastReceipts] = useState<StockReceipt[]>([]);
  const [isLoadingPast, setIsLoadingPast] = useState<boolean>(false);
  const [viewingReceipt, setViewingReceipt] = useState<StockReceipt | null>(null);

  // Load suppliers and products
  useEffect(() => {
    suppliersApi.list({ is_active: true }).then((res) => setSuppliers(res.data)).catch(() => {});
  }, []);

  // Search products when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      productsApi.list({ search: productSearch, is_active: true, per_page: 15 }).then((res) => {
        setProductsList(res.data);
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // When a product is selected in draft, auto-populate its current purchase cost
  const handleProductSelect = (pId: string) => {
    setSelectedProductId(pId);
    const prod = productsList.find((p) => String(p.id) === pId);
    if (prod) {
      setDraftCost(prod.purchase_cost);
    }
  };

  const handleAddLine = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedProductId) {
      setErrorMessage('يرجى اختيار المنتج المراد استلامه');
      return;
    }

    const prod = productsList.find((p) => String(p.id) === selectedProductId);
    if (!prod) {
      setErrorMessage('المنتج المحدد غير متاح');
      return;
    }

    const qty = parseInt(draftQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage('الكمية يجب أن تكون عدداً صحيحاً أكبر من الصفر');
      return;
    }

    const cost = parseFloat(draftCost);
    if (isNaN(cost) || cost < 0) {
      setErrorMessage('سعر الشراء يجب أن يكون رقماً صالحاً غير سالب');
      return;
    }

    // Check duplicate in lines
    if (lines.some((l) => l.productId === prod.id)) {
      setErrorMessage('هذا المنتج موجود بالفعل في سطور الإذن. يمكنك حذفه وإعادة إدخاله بالكمية الإجمالية.');
      return;
    }

    const newLine: LocalReceiptLine = {
      productId: prod.id,
      productName: prod.name,
      barcode: prod.barcode,
      quantity: qty,
      unitCost: cost,
      subtotal: Math.round(qty * cost * 100) / 100,
    };

    setLines([...lines, newLine]);
    setSelectedProductId('');
    setDraftQty('1');
    setDraftCost('');
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const grandTotal = lines.reduce((acc, l) => acc + l.subtotal, 0);
  const totalPieces = lines.reduce((acc, l) => acc + l.quantity, 0);

  const handleSubmitReceipt = async () => {
    setErrorMessage(null);

    if (lines.length === 0) {
      setErrorMessage('يجب إضافة منتج واحد على الأقل في إذن الاستلام قبل الحفظ');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        idempotency_key: idempotencyKey,
        supplier_id: supplierId ? Number(supplierId) : null,
        received_date: receiptDate,
        notes: notes.trim() || null,
        items: lines.map((l) => ({
          product_id: l.productId,
          quantity: l.quantity,
          unit_cost: l.unitCost.toFixed(2),
        })),
      };

      const receipt = await purchasingApi.receiveStock(payload);

      showToast(`تم استلام البضاعة بنجاح وقيد رقم الإذن: ${receipt.receipt_number}`, 'success');
      setSuccessReceiptNumber(receipt.receipt_number);
      // Reset form and generate fresh idempotency key for next draft
      setLines([]);
      setNotes('');
      setSupplierId('');
      setIdempotencyKey((typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `sr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'فشل تسجيل إذن استلام البضاعة';
      setErrorMessage(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadPastReceipts = async () => {
    setIsLoadingPast(true);
    try {
      const res = await purchasingApi.listReceipts();
      setPastReceipts(res.data);
    } catch {
      showToast('تعذر تحميل أذونات الاستلام السابقة', 'error');
    } finally {
      setIsLoadingPast(false);
    }
  };

  const handleTabChange = (tab: 'new' | 'history') => {
    setActiveTab(tab);
    if (tab === 'history') {
      loadPastReceipts();
    }
  };

  const handleViewReceiptDetails = async (r: StockReceipt) => {
    try {
      const full = await purchasingApi.getReceipt(r.id);
      setViewingReceipt(full);
    } catch {
      showToast('تعذر تحميل تفاصيل الإذن', 'error');
    }
  };

  const lineColumns: Column<LocalReceiptLine>[] = [
    {
      key: 'index',
      header: '#',
      width: '4rem',
      render: (_: LocalReceiptLine) => {
        const idx = lines.findIndex((l) => l.productId === _.productId);
        return <span>{idx + 1}</span>;
      },
    },
    {
      key: 'barcode',
      header: 'الباركود',
      width: '8rem',
      render: (l: LocalReceiptLine) => <Badge variant="neutral" size="sm">{l.barcode}</Badge>,
    },
    {
      key: 'productName',
      header: 'اسم المنتج',
      render: (l: LocalReceiptLine) => <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{l.productName}</span>,
    },
    {
      key: 'quantity',
      header: 'الكمية المستلمة',
      width: '8rem',
      render: (l: LocalReceiptLine) => <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{l.quantity} قطعة</span>,
    },
    {
      key: 'unitCost',
      header: 'سعر شراء القطعة',
      width: '10rem',
      render: (l: LocalReceiptLine) => <span>{l.unitCost.toFixed(2)} ج.م</span>,
    },
    {
      key: 'subtotal',
      header: 'إجمالي السطر',
      width: '10rem',
      render: (l: LocalReceiptLine) => <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{l.subtotal.toFixed(2)} ج.م</span>,
    },
    {
      key: 'actions',
      header: 'إلغاء',
      width: '6rem',
      align: 'left',
      render: (_: LocalReceiptLine) => {
        const idx = lines.findIndex((l) => l.productId === _.productId);
        return (
          <Button variant="danger" size="sm" onClick={() => handleRemoveLine(idx)}>
            حذف
          </Button>
        );
      },
    },
  ];

  const pastReceiptColumns: Column<StockReceipt>[] = [
    {
      key: 'receipt_number',
      header: 'رقم إذن الاستلام',
      width: '12rem',
      render: (r: StockReceipt) => <Badge variant="primary" size="md">{r.receipt_number}</Badge>,
    },
    {
      key: 'received_date',
      header: 'تاريخ الاستلام',
      width: '9rem',
    },
    {
      key: 'supplier_name',
      header: 'المورد',
      render: (r: StockReceipt) => (
        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
          {r.supplier_name || <span style={{ color: 'var(--text-muted)' }}>عام (بدون مورد)</span>}
        </span>
      ),
    },
    {
      key: 'items_count',
      header: 'عدد الأصناف',
      width: '8rem',
      render: (r: StockReceipt) => <span>{r.items_count} صنف</span>,
    },
    {
      key: 'total_cost',
      header: 'إجمالي التكلفة',
      width: '11rem',
      render: (r: StockReceipt) => <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{r.total_cost_formatted}</span>,
    },
    {
      key: 'created_by',
      header: 'المسؤول',
      width: '10rem',
      render: (r: StockReceipt) => <span>{r.created_by || '—'}</span>,
    },
    {
      key: 'actions',
      header: 'التفاصيل',
      width: '8rem',
      align: 'left',
      render: (r: StockReceipt) => (
        <Button variant="outline" size="sm" onClick={() => handleViewReceiptDetails(r)}>
          عرض الأصناف
        </Button>
      ),
    },
  ];

  const modalItemColumns: Column<StockReceiptItem>[] = [
    {
      key: 'product_name',
      header: 'المنتج',
      render: (item: StockReceiptItem) => <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{item.product_name}</span>,
    },
    {
      key: 'product_barcode',
      header: 'الباركود',
      width: '7rem',
      render: (item: StockReceiptItem) => <Badge variant="neutral" size="sm">{item.product_barcode}</Badge>,
    },
    {
      key: 'quantity',
      header: 'الكمية',
      width: '6rem',
      render: (item: StockReceiptItem) => <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{item.quantity}</span>,
    },
    {
      key: 'unit_cost',
      header: 'سعر الشراء',
      width: '8rem',
      render: (item: StockReceiptItem) => <span>{item.unit_cost_formatted}</span>,
    },
    {
      key: 'subtotal',
      header: 'الإجمالي',
      width: '8rem',
      render: (item: StockReceiptItem) => <span style={{ fontWeight: 'var(--font-weight-bold)' }}>{item.subtotal_formatted}</span>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
            استلام بضاعة للمخزن
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            توريد قطع أثاث للمخزن، تحديث تكلفة الشراء، قيد المستحق للمورد، وحركات الوارد
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            variant={activeTab === 'new' ? 'primary' : 'outline'}
            onClick={() => handleTabChange('new')}
          >
            + تسجيل إذن استلام جديد
          </Button>
          <Button
            variant={activeTab === 'history' ? 'primary' : 'outline'}
            onClick={() => handleTabChange('history')}
          >
            سجل أذونات الاستلام السابقة
          </Button>
        </div>
      </div>

      {activeTab === 'new' ? (
        <>
          {/* Success Banner */}
          {successReceiptNumber && (
            <Alert
              type="success"
              title="تم حفظ إذن الاستلام بنجاح"
              message={`تم اعتماد إذن استلام البضاعة برقم: ${successReceiptNumber}. تم زيادة أرصدة المنتجات وقيد حركة المخزن.`}
            />
          )}

          {errorMessage && <Alert type="error" message={errorMessage} />}

          {/* Receipt Info Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
              1. بيانات الإذن والمورد
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <Select
                label="المورد / المصنع (اختياري)"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                options={[
                  { value: '', label: '-- استلام عام بدون مورد محدد --' },
                  ...suppliers.map((s) => ({
                    value: String(s.id),
                    label: `${s.name} (المستحق: ${s.payable_formatted})`,
                  })),
                ]}
              />

              <Input
                label="تاريخ الاستلام"
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                required
              />

              <Input
                label="ملاحظات / رقم الفاتورة الورقية"
                placeholder="مثال: توريد دفعة الصالونات، فاتورة دمياط رقم 402"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Product Line Entry Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
              2. إضافة المنتجات المستلمة
            </h2>

            <form onSubmit={handleAddLine} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '0.375rem', color: 'var(--text-secondary)' }}>
                  اختر المنتج (ابحث بالاسم أو الباركود)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Input
                    placeholder="بحث في المنتجات..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{ maxWidth: '12rem' }}
                  />
                  <div style={{ flex: 1 }}>
                    <Select
                      value={selectedProductId}
                      onChange={(e) => handleProductSelect(e.target.value)}
                      options={[
                        { value: '', label: '-- اضغط لاختيار المنتج --' },
                        ...productsList.map((p) => ({
                          value: String(p.id),
                          label: `${p.name} [${p.barcode}] - (رصيده حالياً: ${p.stock_quantity})`,
                        })),
                      ]}
                    />
                  </div>
                </div>
              </div>

              <Input
                label="الكمية المستلمة"
                type="number"
                min="1"
                step="1"
                value={draftQty}
                onChange={(e) => setDraftQty(e.target.value)}
                required
              />

              <Input
                label="سعر شراء القطعة (ج.م)"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={draftCost}
                onChange={(e) => setDraftCost(e.target.value)}
                required
              />

              <Button type="submit" variant="secondary" style={{ height: '2.5rem' }}>
                + إضافة للإذن
              </Button>
            </form>
          </div>

          {/* Line Items Table & Summary */}
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
                3. مراجعة سطور الإذن والإجمالي
              </h2>
            </div>

            {lines.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                لم يتم إضافة أي منتجات للإذن حتى الآن. استخدم النموذج أعلاه لإضافة الأصناف.
              </div>
            ) : (
              <>
                <Table
                  columns={lineColumns}
                  data={lines}
                  keyExtractor={(l) => l.productId}
                />

                {/* Grand Total Bar */}
                <div
                  style={{
                    backgroundColor: 'var(--color-slate-50)',
                    padding: '1.25rem',
                    borderTop: '2px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', gap: '2rem' }}>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>عدد الأصناف:</span>
                      <strong style={{ display: 'block', fontSize: 'var(--font-size-lg)' }}>{lines.length} صنف</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>إجمالي عدد القطع:</span>
                      <strong style={{ display: 'block', fontSize: 'var(--font-size-lg)' }}>{totalPieces} قطعة</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>إجمالي تكلفة الإذن:</span>
                      <strong style={{ display: 'block', fontSize: 'var(--font-size-xl)', color: 'var(--color-primary-700)' }}>
                        {grandTotal.toFixed(2)} ج.م
                      </strong>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSubmitReceipt}
                    isLoading={isSubmitting}
                    disabled={isSubmitting || lines.length === 0}
                  >
                    تأكيد واعتماد إذن الاستلام
                  </Button>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        /* History Tab */
        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
          {isLoadingPast ? (
            <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
              <Spinner size="lg" />
            </div>
          ) : pastReceipts.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              لا توجد أذونات استلام سابقة مسجلة.
            </div>
          ) : (
            <Table
              columns={pastReceiptColumns}
              data={pastReceipts}
              keyExtractor={(r) => r.id}
            />
          )}
        </div>
      )}

      {/* View Past Receipt Details Modal */}
      <Modal
        isOpen={Boolean(viewingReceipt)}
        onClose={() => setViewingReceipt(null)}
        title={`تفاصيل إذن الاستلام: ${viewingReceipt?.receipt_number || ''}`}
      >
        {viewingReceipt && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', backgroundColor: 'var(--color-slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>المورد:</span>
                <strong style={{ display: 'block' }}>{viewingReceipt.supplier_name || 'استلام عام'}</strong>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>التاريخ:</span>
                <strong style={{ display: 'block' }}>{viewingReceipt.received_date}</strong>
              </div>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>إجمالي القيمة:</span>
                <strong style={{ display: 'block', color: 'var(--color-primary-700)' }}>{viewingReceipt.total_cost_formatted}</strong>
              </div>
            </div>

            {viewingReceipt.notes && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                ملاحظات: {viewingReceipt.notes}
              </p>
            )}

            <Table
              columns={modalItemColumns}
              data={viewingReceipt.items || []}
              keyExtractor={(item) => item.id}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};
