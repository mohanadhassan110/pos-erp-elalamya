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
import { formatCurrency, formatQuantity } from '../../utils/formatters';
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
    <div className="flex flex-col h-[calc(100vh-4rem)] p-3 md:p-4 gap-3 bg-gray-50 text-gray-900 font-sans" dir="rtl">
      {/* Top Bar: Mode Selector & Customer & Fast Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
        {/* Sale Type Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">نوع البيع:</span>
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-100">
            <button
              type="button"
              onClick={() => handleSaleTypeChange('retail')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[38px] ${
                saleType === 'retail'
                  ? 'bg-[#0B1220] text-white font-bold shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              بيع قطاعي (F4)
            </button>
            <button
              type="button"
              onClick={() => handleSaleTypeChange('wholesale')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[38px] ${
                saleType === 'wholesale'
                  ? 'bg-[#0B1220] text-white font-bold shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              بيع جملة (F4)
            </button>
          </div>
        </div>

        {/* Customer Selector */}
        <div className="flex items-center gap-2 min-w-[280px]">
          <span className="text-xs font-semibold text-gray-600">
            العميل {saleType === 'wholesale' && <span className="text-rose-600">*</span>}:
          </span>
          <div className="flex-1">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-2.5 py-2 text-xs focus:ring-1 focus:ring-navy-600 focus:border-navy-600 min-h-[44px]"
            >
              <option value="">{saleType === 'wholesale' ? '-- اختر عميل جملة مسجل --' : 'زبون نقدي عام (اختياري)'}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Customer Balance Quick Display */}
        {currentCustomer && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs">
            <span className="text-gray-600">رصيد العميل الحالي:</span>
            <span
              className={`font-bold font-mono ${
                currentCustomer.balance_status === 'debt'
                  ? 'text-rose-600'
                  : currentCustomer.balance_status === 'credit'
                  ? 'text-emerald-600'
                  : 'text-gray-700'
              }`}
            >
              {currentCustomer.balance_formatted}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="md"
            variant="outline"
            onClick={() => setIsCatalogOpen(true)}
            className="text-xs min-h-[44px] flex items-center gap-1.5"
          >
            <Layers size={16} />
            كتالوج الأصناف
          </Button>
          <Button
            size="md"
            variant="secondary"
            onClick={() => setIsExternalModalOpen(true)}
            className="text-xs min-h-[44px] flex items-center gap-1.5"
          >
            <PlusCircle size={16} />
            صنف خارجي
          </Button>
        </div>
      </div>

      {/* Main Workspace: Left Cart (65%) & Right Payment/Summary (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 overflow-hidden">
        {/* Left Column: Barcode Scan & Cart Items Table */}
        <div className="lg:col-span-8 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Barcode Search Header */}
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  placeholder="امسح الباركود بجهاز القراءة أو اكتب اسم الصنف ثم اضغط Enter (F2)..."
                  className="w-full bg-white border border-gray-300 focus:border-[#0B1220] rounded-lg pr-10 pl-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0B1220] min-h-[44px]"
                  disabled={isSearchingBarcode}
                />
                <span className="absolute right-3 top-3 text-gray-400">
                  {isSearchingBarcode ? <Spinner size="sm" /> : <BarcodeIcon size={18} />}
                </span>
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={isSearchingBarcode || !barcodeQuery.trim()}
                className="min-h-[44px] px-5"
              >
                إضافة
              </Button>
            </form>
          </div>

          {/* Cart Table Container */}
          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <div className="text-gray-300 mb-3">
                  <ShoppingCart size={48} strokeWidth={1.5} />
                </div>
                <div className="text-base font-semibold text-gray-600">السلة فارغة</div>
                <div className="text-xs text-gray-400 mt-1">
                  قم بمسح الباركود، أو اختر أصنافاً من الكتالوج، أو أضف صنفاً خارجياً
                </div>
              </div>
            ) : (
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-3 font-semibold">الصنف</th>
                    <th className="py-3 px-2 font-semibold text-center w-20">المخزون</th>
                    <th className="py-3 px-3 font-semibold text-center w-32">الكمية</th>
                    <th className="py-3 px-3 font-semibold text-center w-28">السعر</th>
                    <th className="py-3 px-3 font-semibold text-center w-28">الإجمالي</th>
                    <th className="py-3 px-2 font-semibold text-center w-12">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {cart.map((line) => {
                    const isPriceOverridden = line.unitPrice !== line.originalPrice;
                    const lineSubtotal = line.quantity * line.unitPrice;
                    const isHighlighted = line.id === lastAddedId;

                    return (
                      <tr
                        key={line.id}
                        className={`transition-colors min-h-[48px] ${
                          isHighlighted ? 'bg-amber-50' : 'hover:bg-gray-50'
                        }`}
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

        {/* Right Column: Totals, Payment & Final Action */}
        <div className="lg:col-span-4 flex flex-col bg-white border border-gray-200 rounded-xl p-4 shadow-sm justify-between">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-2">
              ملخص الفاتورة والدفع
            </h2>

            {/* Financial Summary */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between text-xs text-gray-600">
                <span>المجموع الفرعي:</span>
                <span className="font-semibold text-gray-900 font-mono">{formatCurrency(subtotal)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-900">إجمالي الفاتورة:</span>
                <span className="text-2xl font-extrabold text-[#0B1220] font-mono">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">طريقة الدفع:</label>
                <select
                  value={selectedPaymentMethodId}
                  onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:ring-1 focus:ring-navy-600 min-h-[44px]"
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-gray-700">المبلغ المدفوع:</label>
                  <button
                    type="button"
                    onClick={handleExactPayment}
                    className="text-xs text-navy-800 hover:text-navy-900 underline font-semibold"
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
                  className="w-full bg-white border border-gray-300 focus:border-[#0B1220] rounded-lg px-3 py-2 text-lg font-bold text-emerald-700 focus:outline-none min-h-[44px] font-mono"
                />
              </div>

              {/* Balance & Debt Status Breakdown */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>المدفوع المستلم:</span>
                  <span className="font-semibold text-emerald-700 font-mono">{formatCurrency(paidAmountNumber)}</span>
                </div>

                {saleType === 'wholesale' ? (
                  <>
                    <div className="flex justify-between text-gray-600">
                      <span>المتبقي ديناً على العميل:</span>
                      <span className={`font-bold font-mono ${remainingDebt > 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                        {formatCurrency(remainingDebt)}
                      </span>
                    </div>
                    {customerCredit > 0 && (
                      <div className="flex justify-between text-sky-700 font-semibold">
                        <span>رصيد دائن إضافي للعميل:</span>
                        <span className="font-mono">{formatCurrency(customerCredit)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  remainingDebt > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>متبقي غير مسدد:</span>
                      <span className="font-mono font-bold">{formatCurrency(remainingDebt)}</span>
                    </div>
                  )
                )}
              </div>

              {/* Prominent Change Due Display (Retail Cash Overpayment - Display Only) */}
              {changeDue > 0 && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 text-center shadow-sm">
                  <div className="text-xs font-semibold text-emerald-800">باقي النقدية للعميل (فكة):</div>
                  <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
                    {formatCurrency(changeDue)}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">ملاحظات الفاتورة:</label>
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="ملاحظات اختيارية..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 min-h-[40px]"
                />
              </div>
            </div>
          </div>

          {/* Checkout Button & Error Box */}
          <div className="pt-4 space-y-2">
            {checkoutError && <Alert type="error" message={checkoutError} />}

            <Button
              variant="primary"
              size="lg"
              onClick={handleCheckout}
              disabled={isSubmitting || cart.length === 0}
              className="w-full min-h-[56px] text-base font-bold bg-[#0B1220] hover:bg-[#182338] text-white shadow-md justify-center"
            >
              {isSubmitting ? <Spinner size="sm" /> : 'إتمام البيع وحفظ الفاتورة (F9)'}
            </Button>
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
