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
  const total = subtotal; // Currently no extra header discount
  const paidAmountNumber = parseFloat(paidAmountInput) || 0;
  const remainingDebt = Math.max(0, total - paidAmountNumber);
  const customerCredit = Math.max(0, paidAmountNumber - total);

  // When saleType changes, update existing cart items default prices if not manually overridden
  const handleSaleTypeChange = (newType: 'retail' | 'wholesale') => {
    setSaleType(newType);
    if (newType === 'retail') {
      // Keep customer optional
    }
    // Update lines unit prices according to the new type unless customized
    setCart((prev) =>
      prev.map((line) => {
        if (line.type === 'product') {
          // If product line, recalculate default price
          // We can fetch or keep it stable
          return line;
        }
        return line;
      })
    );
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
        showToast(`تمت زيادة كمية '${product.name}' إلى ${newQty}`, 'success');
        return updated;
      } else {
        if (product.stock_quantity < 1) {
          showToast(`عفواً، لا يوجد رصيد متاح من '${product.name}'`, 'error');
          return prev;
        }
        showToast(`تمت إضافة '${product.name}' إلى السلة`, 'success');
        return [
          ...prev,
          {
            id: `line_${product.id}_${Date.now()}`,
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
      // First try direct barcode lookup
      const product = await productsApi.getByBarcode(query);
      addProductToCart(product);
      setBarcodeQuery('');
    } catch {
      // If direct barcode fails, try searching by name or barcode
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

  // Remove Line
  const handleRemoveLine = (lineId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== lineId));
  };

  // Add External Product
  const handleAddExternalProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setExtError(null);

    const name = extName.trim();
    const qty = parseInt(extQty, 10);
    const cost = parseFloat(extCost);
    const price = parseFloat(extPrice);

    if (!name) {
      setExtError('اسم الصنف الخارجي مطلوب');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setExtError('الكمية يجب أن تكون عدداً صحيحاً أكبر من الصفر');
      return;
    }
    if (isNaN(cost) || cost < 0) {
      setExtError('تكلفة الشراء مطلوبة ولا يمكن أن تكون سالبة');
      return;
    }
    if (isNaN(price) || price < 0) {
      setExtError('سعر البيع مطلوب ولا يمكن أن يكون سالباً');
      return;
    }

    setCart((prev) => [
      ...prev,
      {
        id: `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'external',
        productName: name,
        quantity: qty,
        unitPrice: price,
        originalPrice: price,
        purchaseCost: cost,
      },
    ]);

    showToast(`تمت إضافة الصنف الخارجي '${name}'`, 'success');
    setIsExternalModalOpen(false);
    setExtName('');
    setExtQty('1');
    setExtCost('');
    setExtPrice('');
  };

  // Exact Payment Click
  const handleExactPayment = useCallback(() => {
    setPaidAmountInput(total.toFixed(2));
  }, [total]);

  // Keyboard Shortcuts (F2 search, F4 sale type, F8 payment, F9 submit)
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleExactPayment]);

  // Submit Checkout
  const handleCheckout = async () => {
    setCheckoutError(null);

    if (cart.length === 0) {
      setCheckoutError('السلة فارغة. يرجى إضافة أصناف قبل إتمام البيع.');
      return;
    }

    if (saleType === 'wholesale' && !selectedCustomerId) {
      setCheckoutError('يجب اختيار عميل مسجل لفواتير الجملة.');
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
  };

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
    <div className="flex flex-col h-[calc(100vh-4rem)] p-3 md:p-5 gap-3 bg-slate-900 text-slate-100 font-sans" dir="rtl">
      {/* Top Bar: Mode Selector & Customer & Fast Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/90 border border-slate-700/80 rounded-xl p-3 shadow-md">
        {/* Sale Type Radio Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">نوع البيع:</span>
          <div className="inline-flex rounded-lg border border-slate-700 p-0.5 bg-slate-900/60">
            <button
              type="button"
              onClick={() => handleSaleTypeChange('retail')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                saleType === 'retail'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              بيع قطاعي (F4)
            </button>
            <button
              type="button"
              onClick={() => handleSaleTypeChange('wholesale')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                saleType === 'wholesale'
                  ? 'bg-blue-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              بيع جملة (F4)
            </button>
          </div>
        </div>

        {/* Customer Selector */}
        <div className="flex items-center gap-2 min-w-[280px]">
          <span className="text-xs font-semibold text-slate-400">
            العميل {saleType === 'wholesale' && <span className="text-rose-500">*</span>}:
          </span>
          <div className="flex-1">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-500"
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
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-slate-700 rounded-lg text-xs">
            <span className="text-slate-400">رصيد العميل الحالي:</span>
            <span
              className={`font-bold ${
                currentCustomer.balance_status === 'debt'
                  ? 'text-rose-400'
                  : currentCustomer.balance_status === 'credit'
                  ? 'text-emerald-400'
                  : 'text-slate-300'
              }`}
            >
              {currentCustomer.balance_formatted}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCatalogOpen(true)}
            className="text-xs"
          >
            كتالوج الأصناف
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsExternalModalOpen(true)}
            className="text-xs"
          >
            + صنف خارجي
          </Button>
        </div>
      </div>

      {/* Main Workspace: Left Cart (65%) & Right Payment/Summary (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 overflow-hidden">
        {/* Left Column: Barcode Scan & Cart Items Table */}
        <div className="lg:col-span-8 flex flex-col bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-md">
          {/* Barcode Search Header */}
          <div className="p-3 border-b border-slate-700 bg-slate-800/50">
            <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  placeholder="امسح الباركود بجهاز القراءة أو اكتب اسم الصنف ثم اضغط Enter (F2)..."
                  className="w-full bg-slate-900 border border-slate-600 focus:border-amber-500 rounded-lg pr-9 pl-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  disabled={isSearchingBarcode}
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">
                  {isSearchingBarcode ? <Spinner size="sm" /> : '🔍'}
                </span>
              </div>
              <Button type="submit" variant="primary" disabled={isSearchingBarcode || !barcodeQuery.trim()}>
                إضافة
              </Button>
            </form>
          </div>

          {/* Cart Table Container */}
          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <div className="text-5xl mb-3">🛒</div>
                <div className="text-base font-semibold text-slate-400">السلة فارغة</div>
                <div className="text-xs text-slate-500 mt-1">
                  قم بمسح الباركود، أو اختر أصنافاً من الكتالوج، أو أضف صنفاً خارجياً
                </div>
              </div>
            ) : (
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-slate-900/70 text-slate-400 sticky top-0 border-b border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">الصنف</th>
                    <th className="py-2.5 px-2 font-semibold text-center w-20">المخزون</th>
                    <th className="py-2.5 px-3 font-semibold text-center w-32">الكمية</th>
                    <th className="py-2.5 px-3 font-semibold text-center w-28">السعر (ج.م)</th>
                    <th className="py-2.5 px-3 font-semibold text-center w-28">الإجمالي</th>
                    <th className="py-2.5 px-2 font-semibold text-center w-12">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {cart.map((line) => {
                    const isPriceOverridden = line.unitPrice !== line.originalPrice;
                    const lineSubtotal = line.quantity * line.unitPrice;

                    return (
                      <tr key={line.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-100">{line.productName}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {line.type === 'product' ? (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {line.barcode || 'بدون باركود'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.2 rounded border border-purple-800">
                                صنف خارجي
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2 px-2 text-center">
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
                              {line.availableStock}
                            </Badge>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        <td className="py-2 px-3 text-center">
                          <div className="inline-flex items-center border border-slate-700 rounded-lg bg-slate-900 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(line.id, line.quantity - 1)}
                              className="px-2 py-1 text-slate-300 hover:bg-slate-800 active:bg-slate-700 font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={line.availableStock ?? 9999}
                              value={line.quantity}
                              onChange={(e) => handleQuantityChange(line.id, parseInt(e.target.value, 10) || 1)}
                              className="w-12 text-center bg-transparent text-slate-100 font-bold text-xs focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleQuantityChange(line.id, line.quantity + 1)}
                              className="px-2 py-1 text-slate-300 hover:bg-slate-800 active:bg-slate-700 font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>

                        <td className="py-2 px-3 text-center">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unitPrice}
                              onChange={(e) => handlePriceChange(line.id, parseFloat(e.target.value) || 0)}
                              className={`w-24 text-center bg-slate-900 border rounded px-1.5 py-1 text-xs font-semibold focus:outline-none ${
                                isPriceOverridden
                                  ? 'border-amber-500 text-amber-300'
                                  : 'border-slate-700 text-slate-200'
                              }`}
                            />
                            {isPriceOverridden && (
                              <span className="block text-[9px] text-amber-400 mt-0.5">معدل</span>
                            )}
                          </div>
                        </td>

                        <td className="py-2 px-3 text-center font-bold text-emerald-400">
                          {lineSubtotal.toFixed(2)}
                        </td>

                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(line.id)}
                            className="text-slate-400 hover:text-rose-400 transition-colors p-1"
                            title="حذف السطر"
                          >
                            ✕
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
          <div className="p-3 border-t border-slate-700/80 bg-slate-900/60 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              عدد البنود: <strong className="text-slate-200">{cart.length}</strong>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="text-xs text-rose-400 hover:text-rose-300"
            >
              تفريغ السلة
            </Button>
          </div>
        </div>

        {/* Right Column: Totals, Payment & Final Action */}
        <div className="lg:col-span-4 flex flex-col bg-slate-800/80 border border-slate-700 rounded-xl p-4 shadow-md justify-between">
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-200 border-b border-slate-700 pb-2">
              ملخص الفاتورة والدفع
            </h2>

            {/* Financial Summary */}
            <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-3.5 space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>المجموع الفرعي:</span>
                <span className="font-semibold text-slate-200">{subtotal.toFixed(2)} ج.م</span>
              </div>
              <div className="border-t border-slate-800 pt-2 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-100">إجمالي الفاتورة:</span>
                <span className="text-xl font-extrabold text-amber-400">{total.toFixed(2)} ج.م</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">طريقة الدفع:</label>
                <select
                  value={selectedPaymentMethodId}
                  onChange={(e) => setSelectedPaymentMethodId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:ring-1 focus:ring-amber-500"
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
                  <label className="text-xs font-semibold text-slate-300">المبلغ المدفوع (ج.م):</label>
                  <button
                    type="button"
                    onClick={handleExactPayment}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
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
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded-lg px-3 py-2 text-base font-bold text-emerald-400 focus:outline-none"
                />
              </div>

              {/* Balance & Debt Status Breakdown */}
              <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-2.5 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>المدفوع نقداً/إلكترونياً:</span>
                  <span className="font-semibold text-emerald-400">{paidAmountNumber.toFixed(2)} ج.م</span>
                </div>

                {saleType === 'wholesale' ? (
                  <>
                    <div className="flex justify-between text-slate-400">
                      <span>المتبقي ديناً على العميل:</span>
                      <span className={`font-bold ${remainingDebt > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                        {remainingDebt.toFixed(2)} ج.م
                      </span>
                    </div>
                    {customerCredit > 0 && (
                      <div className="flex justify-between text-cyan-400 font-semibold">
                        <span>رصيد دائن إضافي للعميل:</span>
                        <span>{customerCredit.toFixed(2)} ج.م</span>
                      </div>
                    )}
                  </>
                ) : (
                  remainingDebt > 0 && (
                    <div className="flex justify-between text-amber-400 text-[11px]">
                      <span>متبقي غير مسدد:</span>
                      <span>{remainingDebt.toFixed(2)} ج.م</span>
                    </div>
                  )
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">ملاحظات الفاتورة:</label>
                <input
                  type="text"
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="ملاحظات اختيارية..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
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
              className="w-full py-3 text-base font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg justify-center"
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
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-700/60">
            {catalogProducts.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">لا توجد منتجات مطابقة</div>
            ) : (
              catalogProducts.map((p) => {
                const currentPrice = saleType === 'wholesale' ? p.wholesale_price : p.retail_price;
                return (
                  <div
                    key={p.id}
                    className="p-2.5 flex items-center justify-between hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                    onClick={() => {
                      addProductToCart(p);
                      setIsCatalogOpen(false);
                    }}
                  >
                    <div>
                      <div className="font-semibold text-sm text-slate-100">{p.name}</div>
                      <div className="text-xs text-slate-400 font-mono">{p.barcode} | {p.category_name}</div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-amber-400 text-sm">{currentPrice} ج.م</div>
                      <div className="text-xs text-slate-400">متاح: {p.stock_quantity}</div>
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">اسم الصنف الخارجي:</label>
            <Input
              value={extName}
              onChange={(e) => setExtName(e.target.value)}
              placeholder="مثال: خدادية تطريز خاص، لوح زجاج مقطع..."
              autoFocus
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">الكمية:</label>
              <Input
                type="number"
                min="1"
                value={extQty}
                onChange={(e) => setExtQty(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                تكلفة الشراء (ج.م):
                <span className="text-[10px] text-amber-400 block font-normal">(تسجل كمصروف داخلي)</span>
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                سعر البيع للعميل (ج.م):
                <span className="text-[10px] text-emerald-400 block font-normal">(يظهر في الفاتورة)</span>
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

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
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
          defaultFormat="a4"
        />
      )}
    </div>
  );
};
