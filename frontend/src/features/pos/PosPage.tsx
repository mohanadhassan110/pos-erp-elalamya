import React, { useState, useEffect, useRef, useCallback } from 'react';
import { productsApi } from '../../services/api/productsApi';
import { customersApi } from '../../services/api/customersApi';
import { paymentMethodsApi } from '../../services/api/paymentMethodsApi';
import { invoicesApi } from '../../services/api/invoicesApi';
import type { Product, Customer, PaymentMethod, Invoice } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../app/providers/useToast';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';
import { formatCurrency, formatQuantity, formatNumber } from '../../utils/formatters';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Layers,
  PlusCircle,
  Barcode as BarcodeIcon,
} from 'lucide-react';

export interface CartLine {
  id: string; // temporary line uuid
  type: 'product' | 'external';
  productId?: number;
  productName: string;
  barcode?: string;
  availableStock?: number;
  quantity: number;
  unitPrice: number; // Sale price
  originalPrice: number; // Default retail or wholesale price for comparison
  purchaseCost?: number; // Only entered for external product
}

export const PosPage: React.FC = () => {
  const { showToast } = useToast();

  // Mode: Retail vs Wholesale
  const [saleType, setSaleType] = useState<'retail' | 'wholesale'>('retail');

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');

  // Cart Lines
  const [cart, setCart] = useState<CartLine[]>([]);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);

  // Barcode / Quick search input
  const [barcodeQuery, setBarcodeQuery] = useState<string>('');
  const [isSearchingBarcode, setIsSearchingBarcode] = useState<boolean>(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Product Catalog Quick Picker Modal / Dropdown
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // External Product Modal
  const [isExternalModalOpen, setIsExternalModalOpen] = useState<boolean>(false);
  const [extName, setExtName] = useState<string>('');
  const [extQty, setExtQty] = useState<string>('1');
  const [extCost, setExtCost] = useState<string>('');
  const [extPrice, setExtPrice] = useState<string>('');
  const [extError, setExtError] = useState<string | null>(null);

  // Payment & Checkout State
  const [paidAmountInput, setPaidAmountInput] = useState<string>('');
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Successful invoice modal / Print
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);

  // Idempotency key per invoice attempt
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `pos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  );

  // Load master data on mount
  useEffect(() => {
    customersApi.list({ is_active: true, per_page: 100 })
      .then((res) => setCustomers(res.data))
      .catch(() => {});

    paymentMethodsApi.list()
      .then((methods) => {
        setPaymentMethods(methods);
        const cashMethod = methods.find((m) => m.is_cash);
        if (cashMethod) {
          setSelectedPaymentMethodId(String(cashMethod.id));
        } else if (methods.length > 0) {
          setSelectedPaymentMethodId(String(methods[0].id));
        }
      })
      .catch(() => {});
  }, []);

  // Filter catalog products for fast picker
  useEffect(() => {
    if (isCatalogOpen) {
      const timer = setTimeout(() => {
        productsApi.list({ search: catalogSearch, is_active: true, per_page: 20 })
          .then((res) => setCatalogProducts(res.data))
          .catch(() => {});
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isCatalogOpen, catalogSearch]);

  // Focus barcode input on mount and after actions
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, [isCatalogOpen, isExternalModalOpen, completedInvoice]);

  // Helper to get selected customer object
  const currentCustomer = customers.find((c) => String(c.id) === selectedCustomerId);

  // Subtotal & Total Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const total = subtotal;
  const paidAmountNumber = parseFloat(paidAmountInput) || 0;
  const remainingDebt = Math.max(0, total - paidAmountNumber);
  const customerCredit = Math.max(0, paidAmountNumber - total);
  const changeDue = saleType === 'retail' && paidAmountNumber > total ? paidAmountNumber - total : 0;

  // When saleType changes
  const handleSaleTypeChange = (newType: 'retail' | 'wholesale') => {
    setSaleType(newType);
  };

  // Add Product to Cart
  const addProductToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.type === 'product' && item.productId === product.id);
      const defaultPrice = saleType === 'wholesale' ? parseFloat(product.wholesale_price) : parseFloat(product.retail_price);

      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        const newQty = existing.quantity + 1;
        if (newQty > product.stock_quantity) {
          showToast(`الكمية المتاحة من '${product.name}' هي ${product.stock_quantity} فقط`, 'error');
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = {
          ...existing,
          quantity: newQty,
        };
        setLastAddedId(existing.id);
        setTimeout(() => setLastAddedId(null), 1200);
        showToast(`تمت زيادة كمية '${product.name}' إلى ${newQty}`, 'success');
        return updated;
      } else {
        if (product.stock_quantity < 1) {
          showToast(`عفواً، لا يوجد رصيد متاح من '${product.name}'`, 'error');
          return prev;
        }
        const newLineId = `line_${product.id}_${Date.now()}`;
        setLastAddedId(newLineId);
        setTimeout(() => setLastAddedId(null), 1200);
        showToast(`تمت إضافة '${product.name}' إلى السلة`, 'success');
        return [
          ...prev,
          {
            id: newLineId,
            type: 'product',
            productId: product.id,
            productName: product.name,
            barcode: product.barcode,
            availableStock: product.stock_quantity,
            quantity: 1,
            unitPrice: defaultPrice,
            originalPrice: defaultPrice,
          },
        ];
      }
    });
  }, [saleType, showToast]);

  // Handle Barcode Scan / Enter
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = barcodeQuery.trim();
    if (!query) return;

    setIsSearchingBarcode(true);
    setCheckoutError(null);

    try {
      const product = await productsApi.getByBarcode(query);
      addProductToCart(product);
      setBarcodeQuery('');
    } catch {
      try {
        const searchRes = await productsApi.list({ search: query, is_active: true, per_page: 5 });
        if (searchRes.data.length === 1) {
          addProductToCart(searchRes.data[0]);
          setBarcodeQuery('');
        } else if (searchRes.data.length > 1) {
          setCatalogProducts(searchRes.data);
          setCatalogSearch(query);
          setIsCatalogOpen(true);
        } else {
          showToast(`لم يتم العثور على أي منتج يطابق '${query}'`, 'error');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'تعذر البحث عن الصنف';
        showToast(msg, 'error');
      }
    } finally {
      setIsSearchingBarcode(false);
      barcodeInputRef.current?.focus();
    }
  };

  // Modify Quantity
  const handleQuantityChange = (lineId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveLine(lineId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === lineId) {
          if (item.availableStock !== undefined && newQty > item.availableStock) {
            showToast(`الرصيد المتاح بالمخزن هو ${item.availableStock} فقط`, 'error');
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  // Modify Price (Cashier Override)
  const handlePriceChange = (lineId: string, newPrice: number) => {
    if (newPrice < 0) return;
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === lineId) {
          return { ...item, unitPrice: newPrice };
        }
        return item;
      })
    );
  };

  // Remove Line from Cart
  const handleRemoveLine = (lineId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== lineId));
    barcodeInputRef.current?.focus();
  };

  // Add External Product
  const handleAddExternalProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setExtError(null);

    if (!extName.trim()) {
      setExtError('يرجى إدخال اسم الصنف الخارجي.');
      return;
    }
    const q = parseInt(extQty, 10);
    if (isNaN(q) || q <= 0) {
      setExtError('الكمية يجب أن تكون عدداً صحيحاً أكبر من الصفر.');
      return;
    }
    const c = parseFloat(extCost);
    if (isNaN(c) || c < 0) {
      setExtError('يرجى تحديد تكلفة الشراء بصورة صحيحة.');
      return;
    }
    const p = parseFloat(extPrice);
    if (isNaN(p) || p < 0) {
      setExtError('يرجى تحديد سعر البيع للعميل بصورة صحيحة.');
      return;
    }

    const newLineId = `ext_${Date.now()}`;
    setCart((prev) => [
      ...prev,
      {
        id: newLineId,
        type: 'external',
        productName: extName.trim(),
        quantity: q,
        unitPrice: p,
        originalPrice: p,
        purchaseCost: c,
      },
    ]);

    setExtName('');
    setExtQty('1');
    setExtCost('');
    setExtPrice('');
    setIsExternalModalOpen(false);
    showToast(`تمت إضافة الصنف الخارجي '${extName}' إلى السلة`, 'success');
    barcodeInputRef.current?.focus();
  };

  // Exact Payment Action (F8 shortcut)
  const handleExactPayment = useCallback(() => {
    setPaidAmountInput(total.toFixed(2));
    barcodeInputRef.current?.focus();
  }, [total]);

  // Execute Checkout (F9 shortcut)
  const handleCheckout = useCallback(async () => {
    setCheckoutError(null);

    if (cart.length === 0) {
      setCheckoutError('لا يمكن إتمام البيع: سلة المشتريات فارغة.');
      return;
    }

    if (saleType === 'wholesale' && !selectedCustomerId) {
      setCheckoutError('بيع الجملة يتطلب اختيار عميل مسجل.');
      return;
    }

    if (!selectedPaymentMethodId && paidAmountNumber > 0) {
      setCheckoutError('يرجى تحديد طريقة الدفع.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        sale_type: saleType,
        customer_id: selectedCustomerId ? parseInt(selectedCustomerId, 10) : null,
        idempotency_key: idempotencyKey,
        notes: invoiceNotes.trim() || undefined,
        items: cart.map((item) => {
          if (item.type === 'product') {
            return {
              type: 'product' as const,
              product_id: item.productId!,
              quantity: item.quantity,
              unit_sale_price: item.unitPrice.toFixed(2),
            };
          } else {
            return {
              type: 'external' as const,
              product_name: item.productName,
              quantity: item.quantity,
              purchase_cost: (item.purchaseCost ?? 0).toFixed(2),
              unit_sale_price: item.unitPrice.toFixed(2),
            };
          }
        }),
        payments:
          paidAmountNumber > 0
            ? [
                {
                  payment_method_id: parseInt(selectedPaymentMethodId, 10),
                  amount: paidAmountNumber.toFixed(2),
                },
              ]
            : [],
      };

      const createdInvoice = await invoicesApi.create(payload);
      showToast(`تم إصدار الفاتورة رقم ${createdInvoice.invoice_number} بنجاح`, 'success');
      setCompletedInvoice(createdInvoice);
    } catch (err: unknown) {
      const errorData = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
      const apiMsg = errorData.response?.data?.message;
      const validationErrors = errorData.response?.data?.errors;

      if (validationErrors) {
        const firstKey = Object.keys(validationErrors)[0];
        setCheckoutError(validationErrors[firstKey][0]);
      } else if (apiMsg) {
        setCheckoutError(apiMsg);
      } else {
        setCheckoutError(errorData.message || 'حدث خطأ أثناء إتمام عملية البيع');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    cart,
    saleType,
    selectedCustomerId,
    selectedPaymentMethodId,
    paidAmountNumber,
    idempotencyKey,
    invoiceNotes,
    showToast,
  ]);

  // Keyboard Shortcuts (F2 search, F4 sale type, F8 payment, F9 submit, ESC close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setSaleType((prev) => (prev === 'retail' ? 'wholesale' : 'retail'));
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleExactPayment();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (!isSubmitting) {
          handleCheckout();
        }
      } else if (e.key === 'Escape') {
        if (isCatalogOpen) setIsCatalogOpen(false);
        if (isExternalModalOpen) setIsExternalModalOpen(false);
        if (completedInvoice) setCompletedInvoice(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExactPayment, isSubmitting, isCatalogOpen, isExternalModalOpen, completedInvoice, handleCheckout]);

  // Reset POS for New Sale
  const handleStartNewSale = () => {
    setCart([]);
    setPaidAmountInput('');
    setInvoiceNotes('');
    setCheckoutError(null);
    setCompletedInvoice(null);
    setSelectedCustomerId('');
    setIdempotencyKey(
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `pos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    );
    barcodeInputRef.current?.focus();
  };

  return (
    <div className="pos-container" dir="rtl">
      {/* Main Workspace: 2-Column Responsive Layout */}
      <div className="pos-workspace-grid">
        {/* RIGHT COLUMN (65%): Work Area, Barcode Scan & Cart */}
        <div className="pos-cart-column">
          {/* Top Bar of Work Area: Segmented Sale Type, Customer Picker & Action Buttons */}
          <div
            style={{
              padding: '0.875rem 1.25rem',
              borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
              backgroundColor: '#FFFFFF',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            {/* Sale Type Segmented Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>نوع البيع:</span>
              <div className="segmented-control">
                <button
                  type="button"
                  onClick={() => handleSaleTypeChange('retail')}
                  className={`segmented-btn ${saleType === 'retail' ? 'active' : ''}`}
                >
                  بيع قطاعي (F4)
                </button>
                <button
                  type="button"
                  onClick={() => handleSaleTypeChange('wholesale')}
                  className={`segmented-btn ${saleType === 'wholesale' ? 'active' : ''}`}
                >
                  بيع جملة (F4)
                </button>
              </div>
            </div>

            {/* Customer Picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '260px', maxWidth: '380px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                العميل {saleType === 'wholesale' && <span style={{ color: '#DC2626' }}>*</span>}:
              </span>
              <div style={{ position: 'relative', flex: 1 }}>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    minHeight: '44px',
                    padding: '0 0.875rem 0 2rem',
                    backgroundColor: saleType === 'wholesale' && !selectedCustomerId ? '#FEF2F2' : '#FFFFFF',
                    border: `1px solid ${saleType === 'wholesale' && !selectedCustomerId ? '#F87171' : '#CBD5E1'}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#0F172A',
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                  className="al-select"
                >
                  <option value="">{saleType === 'wholesale' ? '-- اختر عميل جملة مسجل (مطلوب) --' : 'زبون نقدي (افتراضي)'}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
                <div
                  style={{
                    position: 'absolute',
                    left: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: '#64748B',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </div>
              {currentCustomer && (
                <div style={{ fontSize: '12px', padding: '0.35rem 0.5rem', backgroundColor: '#F1F5F9', borderRadius: '4px', whiteSpace: 'nowrap', border: '1px solid #CBD5E1' }}>
                  <span style={{ color: '#64748B' }}>الرصيد: </span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: currentCustomer.balance_status === 'debt' ? '#DC2626' : currentCustomer.balance_status === 'credit' ? '#059669' : '#334155' }}>
                    {currentCustomer.balance_formatted}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Catalog & External Item Buttons (Min 12px gap) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Button
                size="md"
                variant="secondary"
                onClick={() => setIsCatalogOpen(true)}
                icon={<Layers size={16} />}
                style={{ fontSize: '13px' }}
              >
                كتالوج الأصناف (F2)
              </Button>
              <Button
                size="md"
                variant="secondary"
                onClick={() => setIsExternalModalOpen(true)}
                icon={<PlusCircle size={16} />}
                style={{ fontSize: '13px' }}
              >
                صنف خارجي
              </Button>
            </div>
          </div>

          {/* Barcode Search Header (Min 52px Input, Auto-Focused, Always Visible) */}
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
            <form onSubmit={handleBarcodeSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  placeholder="امسح الباركود بجهاز القراءة أو اكتب اسم الصنف ثم اضغط Enter (F2)..."
                  style={{
                    width: '100%',
                    height: '52px',
                    minHeight: '52px',
                    padding: '0 2.75rem 0 1rem',
                    backgroundColor: '#FFFFFF',
                    border: '2px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  className="al-input"
                  disabled={isSearchingBarcode}
                />
                <span style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}>
                  {isSearchingBarcode ? <Spinner size="sm" /> : <BarcodeIcon size={20} />}
                </span>
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={isSearchingBarcode || !barcodeQuery.trim()}
                style={{ height: '52px', minHeight: '52px', padding: '0 1.5rem', fontSize: '14px', fontWeight: 700 }}
              >
                إضافة
              </Button>
            </form>
          </div>

          {/* Cart Table Container */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0.5rem' }}>
            {cart.length === 0 ? (
              <div style={{ height: '100%', minHeight: '320px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', padding: '2rem', textAlign: 'center' }}>
                <div style={{ color: '#CBD5E1', marginBottom: '0.75rem' }}>
                  <ShoppingCart size={48} strokeWidth={1.5} />
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#475569' }}>السلة فارغة</div>
                <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '0.25rem' }}>
                  قم بمسح الباركود، أو اختر أصنافاً من الكتالوج (F2)، أو أضف صنفاً خارجياً
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', textAlign: 'right', fontSize: '13px', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#F1F5F9', color: '#334155', position: 'sticky', top: 0, zIndex: 2, borderBottom: '2px solid #E2E8F0' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 0.875rem', fontWeight: 700 }}>الصنف</th>
                    <th style={{ padding: '0.75rem 0.5rem', fontWeight: 700, textAlign: 'center', width: '80px' }}>المخزون</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 700, textAlign: 'center', width: '130px' }}>الكمية</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 700, textAlign: 'center', width: '110px' }}>السعر</th>
                    <th style={{ padding: '0.75rem 0.75rem', fontWeight: 700, textAlign: 'center', width: '110px' }}>الإجمالي</th>
                    <th style={{ padding: '0.75rem 0.5rem', fontWeight: 700, textAlign: 'center', width: '50px' }}>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((line) => {
                    const isPriceOverridden = line.unitPrice !== line.originalPrice;
                    const lineSubtotal = line.quantity * line.unitPrice;
                    const isHighlighted = line.id === lastAddedId;

                    return (
                      <tr
                        key={line.id}
                        style={{
                          height: '48px',
                          minHeight: '48px',
                          borderBottom: '1px solid #E2E8F0',
                          backgroundColor: isHighlighted ? '#FFFBEB' : '#FFFFFF',
                          transition: 'background-color 0.15s ease',
                        }}
                      >
                        <td className="py-3 px-3">
                          <div className="font-semibold text-gray-900 text-sm">{line.productName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {line.type === 'product' ? (
                              <span className="text-[11px] text-gray-500 font-mono">
                                {line.barcode || 'بدون باركود'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                صنف خارجي
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-2 text-center">
                          {line.type === 'product' ? (
                            <Badge
                              variant={
                                (line.availableStock ?? 0) <= 2
                                  ? 'danger'
                                  : (line.availableStock ?? 0) <= 5
                                  ? 'warning'
                                  : 'success'
                              }
                            >
                              {formatQuantity(line.availableStock ?? 0)}
                            </Badge>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden shadow-sm">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(line.id, line.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                              title="تقليل الكمية"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={line.availableStock ?? 9999}
                              value={line.quantity}
                              onChange={(e) => handleQuantityChange(line.id, parseInt(e.target.value, 10) || 1)}
                              className="w-12 text-center bg-transparent text-gray-900 font-bold text-xs focus:outline-none font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(line.id, line.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200"
                              title="زيادة الكمية"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="relative inline-block">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unitPrice}
                              onChange={(e) => handlePriceChange(line.id, parseFloat(e.target.value) || 0)}
                              className={`w-24 text-center bg-white border rounded px-1.5 py-1.5 text-xs font-semibold focus:outline-none font-mono ${
                                isPriceOverridden
                                  ? 'border-amber-500 text-amber-700 bg-amber-50'
                                  : 'border-gray-300 text-gray-900'
                              }`}
                            />
                            {isPriceOverridden && (
                              <span className="block text-[10px] text-amber-600 mt-0.5">معدل</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center font-bold text-gray-900 font-mono text-sm">
                          {formatCurrency(lineSubtotal)}
                        </td>

                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="text-gray-400 hover:text-rose-600 transition-colors p-1.5 rounded"
                            title="حذف السطر"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Cart Footer Bar */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs">
            <span className="text-gray-600">
              عدد البنود: <strong className="text-gray-900 font-mono">{cart.length}</strong>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="text-xs text-rose-600 hover:text-rose-700 border-rose-200"
            >
              تفريغ السلة
            </Button>
          </div>
        </div>

        {/* LEFT COLUMN (35% in RTL): Sticky Payment Panel Card */}
        <div className="pos-payment-column">
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              ملخص الفاتورة والدفع
            </h2>

            {/* Financial Summary Card with Prominent Grand Total (>= 36px bold) */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748B', marginBottom: '0.5rem' }}>
                <span>المجموع الفرعي:</span>
                <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '14px', direction: 'ltr' }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(subtotal)}</span> ج.م
                </span>
              </div>
              <div style={{ borderTop: '2px solid #E2E8F0', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>إجمالي الفاتورة:</span>
                <span style={{ fontSize: '38px', fontWeight: 900, color: '#0B1220', lineHeight: 1, direction: 'ltr' }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(total)}</span> <span style={{ fontSize: '20px', fontWeight: 700 }}>ج.م</span>
                </span>
              </div>
            </div>

            {/* Payment Details */}
            <div style={{ marginBottom: '0.875rem' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '0.375rem' }}>طريقة الدفع:</label>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedPaymentMethodId}
                  onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                  style={{
                    width: '100%',
                    height: '44px',
                    minHeight: '44px',
                    padding: '0 0.875rem 0 2rem',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#0F172A',
                    outline: 'none',
                    cursor: 'pointer',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                  className="al-select"
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
                <div style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748B' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>المبلغ المدفوع:</label>
                <button
                  type="button"
                  onClick={handleExactPayment}
                  style={{ fontSize: '12px', color: '#0B1220', fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  سداد كامل المبلغ (F8)
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={paidAmountInput}
                onChange={(e) => setPaidAmountInput(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  height: '48px',
                  minHeight: '48px',
                  padding: '0 1rem',
                  backgroundColor: '#FFFFFF',
                  border: '2px solid #CBD5E1',
                  borderRadius: '6px',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#059669',
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                className="al-input"
              />
            </div>

            {/* Balance & Debt Status Breakdown */}
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '0.75rem', fontSize: '13px', marginBottom: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                <span>المدفوع المستلم:</span>
                <span style={{ fontWeight: 700, color: '#059669', direction: 'ltr' }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(paidAmountNumber)}</span> ج.م
                </span>
              </div>

              {saleType === 'wholesale' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                    <span>المتبقي ديناً على العميل:</span>
                    <span style={{ fontWeight: 700, color: remainingDebt > 0 ? '#DC2626' : '#334155', direction: 'ltr' }}>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(remainingDebt)}</span> ج.م
                    </span>
                  </div>
                  {customerCredit > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0284C7', fontWeight: 600 }}>
                      <span>رصيد دائن إضافي للعميل:</span>
                      <span style={{ direction: 'ltr' }}><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(customerCredit)}</span> ج.م</span>
                    </div>
                  )}
                </>
              ) : (
                remainingDebt > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#D97706', fontWeight: 600 }}>
                    <span>متبقي غير مسدد:</span>
                    <span style={{ fontWeight: 700, direction: 'ltr' }}><span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(remainingDebt)}</span> ج.م</span>
                  </div>
                )
              )}
            </div>

            {/* Prominent Change Due Display (Retail Cash Overpayment - Display Only) */}
            {changeDue > 0 && (
              <div style={{ backgroundColor: '#ECFDF5', border: '2px solid #6EE7B7', borderRadius: '8px', padding: '0.875rem', textAlign: 'center', marginBottom: '0.875rem' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#065F46' }}>باقي النقدية للعميل (فكة):</div>
                <div style={{ fontSize: '28px', fontWeight: 900, color: '#047857', marginTop: '0.25rem', direction: 'ltr' }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(changeDue)}</span> <span style={{ fontSize: '18px', fontWeight: 700 }}>ج.م</span>
                </div>
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '0.25rem' }}>ملاحظات الفاتورة:</label>
              <input
                type="text"
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                placeholder="ملاحظات اختيارية..."
                style={{ width: '100%', height: '40px', minHeight: '40px', padding: '0 0.75rem', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '13px', color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
                className="al-input"
              />
            </div>

            {/* Checkout Button & Error Box */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {checkoutError && <Alert type="error" message={checkoutError} />}

              <Button
                variant="primary"
                size="lg"
                onClick={handleCheckout}
                disabled={isSubmitting || cart.length === 0}
                style={{
                  width: '100%',
                  height: '56px',
                  minHeight: '56px',
                  fontSize: '16px',
                  fontWeight: 800,
                  backgroundColor: '#0B1220',
                  color: '#FFFFFF',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              >
                {isSubmitting ? <Spinner size="sm" /> : 'إتمام البيع وحفظ الفاتورة (F9)'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Catalog Quick Picker Modal */}
      <Modal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        title="كتالوج الأصناف السريع"
        maxWidth="48rem"
      >
        <div className="space-y-3">
          <Input
            placeholder="ابحث بالاسم أو الباركود..."
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {catalogProducts.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-xs">لا توجد منتجات مطابقة</div>
            ) : (
              catalogProducts.map((p) => {
                const currentPrice = saleType === 'wholesale' ? parseFloat(p.wholesale_price) : parseFloat(p.retail_price);
                return (
                  <div
                    key={p.id}
                    className="p-3 flex items-center justify-between hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      addProductToCart(p);
                      setIsCatalogOpen(false);
                    }}
                  >
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-500 font-mono">{p.barcode} | {p.category_name}</div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-[#0B1220] text-sm font-mono">{formatCurrency(currentPrice)}</div>
                      <div className="text-xs text-gray-500">متاح: {formatQuantity(p.stock_quantity)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* External Product Modal */}
      <Modal
        isOpen={isExternalModalOpen}
        onClose={() => setIsExternalModalOpen(false)}
        title="إضافة صنف خارجي (عمولة / تفصيل)"
        maxWidth="36rem"
      >
        <form onSubmit={handleAddExternalProduct} className="space-y-3 text-right">
          {extError && <Alert type="error" message={extError} />}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">اسم الصنف الخارجي:</label>
            <Input
              value={extName}
              onChange={(e) => setExtName(e.target.value)}
              placeholder="مثال: خدادية تطريز خاص، لوح زجاج مقطع..."
              autoFocus
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">الكمية:</label>
              <Input
                type="number"
                min="1"
                value={extQty}
                onChange={(e) => setExtQty(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                تكلفة الشراء (ج.م):
                <span className="text-[10px] text-amber-600 block font-normal">(تسجل كمصروف داخلي)</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={extCost}
                onChange={(e) => setExtCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                سعر البيع للعميل (ج.م):
                <span className="text-[10px] text-emerald-700 block font-normal">(يظهر في الفاتورة)</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={extPrice}
                onChange={(e) => setExtPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={() => setIsExternalModalOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary">
              إضافة للسلة
            </Button>
          </div>
        </form>
      </Modal>

      {/* Successful Checkout & Printable Invoice Modal */}
      {completedInvoice && (
        <InvoicePrintModal
          initialInvoice={completedInvoice}
          invoiceId={completedInvoice.id}
          isOpen={true}
          onClose={handleStartNewSale}
          defaultFormat="thermal"
        />
      )}
    </div>
  );
};
