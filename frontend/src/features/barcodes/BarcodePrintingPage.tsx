import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productsApi } from '../../services/api/productsApi';
import type { Product, BarcodeLabel } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Code128Barcode } from '../../components/barcode/Code128Barcode';

interface QueueItem {
  product: Product;
  quantity: number;
}

export const BarcodePrintingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('productId');

  // Search & Catalog
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Print Queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPreparingLabels, setIsPreparingLabels] = useState<boolean>(false);
  const [preparedLabels, setPreparedLabels] = useState<BarcodeLabel[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Layout & Customization Options
  const [layoutMode, setLayoutMode] = useState<'thermal' | 'a4-grid-3' | 'a4-grid-4'>('thermal');
  const [showShowroomName, setShowShowroomName] = useState<boolean>(true);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showCategory, setShowCategory] = useState<boolean>(true);

  // If productId passed in query param, load and add to queue
  useEffect(() => {
    if (initialProductId) {
      const pid = parseInt(initialProductId, 10);
      if (!isNaN(pid)) {
        productsApi.getById(pid)
          .then((p) => {
            if (p && p.is_active) {
              setQueue((prev) => {
                if (prev.some((q) => q.product.id === p.id)) return prev;
                return [...prev, { product: p, quantity: 1 }];
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [initialProductId]);

  // Product Search Debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      return;
    }

    let isMounted = true;
    const timer = setTimeout(() => {
      setIsSearching(true);
      productsApi.list({ search: q, is_active: true, per_page: 8 })
        .then((res) => {
          if (isMounted) setSearchResults(res.data);
        })
        .catch(() => {
          if (isMounted) setSearchResults([]);
        })
        .finally(() => {
          if (isMounted) setIsSearching(false);
        });
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // Add Product to Queue
  const addToQueue = (product: Product, defaultQty = 1) => {
    setQueue((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += defaultQty;
        return updated;
      }
      return [...prev, { product, quantity: defaultQty }];
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQuantity = (productId: number, qty: number) => {
    const safeQty = Math.max(1, Math.min(500, qty));
    setQueue((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity: safeQty } : item))
    );
  };

  const removeFromQueue = (productId: number) => {
    setQueue((prev) => {
      const next = prev.filter((item) => item.product.id !== productId);
      if (next.length === 0) {
        setPreparedLabels([]);
      }
      return next;
    });
  };

  const clearQueue = () => {
    setQueue([]);
    setPreparedLabels([]);
  };

  // Synchronize with Backend Barcode Preview Endpoint
  useEffect(() => {
    let isMounted = true;
    if (queue.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      setIsPreparingLabels(true);
      setError(null);
      const itemsPayload = queue.map((q) => ({
        product_id: q.product.id,
        quantity: q.quantity,
      }));

      productsApi.previewBarcodes(itemsPayload)
        .then((res) => {
          if (isMounted) {
            setPreparedLabels(res.data.labels);
          }
        })
        .catch(() => {
          if (isMounted) {
            setError('تعذر تجهيز ملصقات الباركود من الخادم. يرجى التحقق من الاتصال.');
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsPreparingLabels(false);
          }
        });
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [queue]);

  const totalLabelsCount = useMemo(() => {
    return queue.reduce((sum, item) => sum + item.quantity, 0);
  }, [queue]);

  // Flattened array of individual labels to render in printable area
  const flattenedLabels = useMemo(() => {
    const list: BarcodeLabel[] = [];
    for (const label of preparedLabels) {
      const count = label.print_quantity || 1;
      for (let i = 0; i < count; i++) {
        list.push(label);
      }
    }
    return list;
  }, [preparedLabels]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto text-slate-100" dir="rtl">
      {/* Page Header (Hidden when printing) */}
      <div className="no-print flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">طباعة ملصقات الباركود</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            توليد وطباعة باركود الأصناف للأرفف والتغليف وفق معيار Code 128
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handlePrint}
            disabled={flattenedLabels.length === 0 || isPreparingLabels || totalLabelsCount > 1000}
          >
            🖨️ طباعة الملصقات ({flattenedLabels.length})
          </Button>
          {queue.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearQueue}>
              مسح القائمة
            </Button>
          )}
        </div>
      </div>

      {totalLabelsCount > 1000 && (
        <div className="no-print">
          <Alert
            type="error"
            message={`الحد الأقصى لإجمالي عدد الملصقات في أمر الطباعة الواحد هو 1000 ملصق. قمت بتحديد (${totalLabelsCount}) ملصقاً. يرجى تقليل الكميات للمتابعة.`}
          />
        </div>
      )}

      {error && (
        <div className="no-print">
          <Alert type="error" message={error} />
        </div>
      )}

      {/* Configuration & Selection Panel (Hidden when printing) */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Col: Product Search & Queue */}
        <div className="lg:col-span-7 bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 border-b border-slate-700 pb-2">
            1. اختيار المنتجات وتحديد كمية الملصقات
          </h2>

          {/* Search Box */}
          <div className="relative">
            <Input
              placeholder="ابحث باسم المنتج أو الباركود (مثل: لحاف، B0001)..."
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (!val.trim()) {
                  setSearchResults([]);
                }
              }}
              autoFocus
            />
            {isSearching && (
              <div className="absolute left-3 top-2.5">
                <Spinner size="sm" />
              </div>
            )}

            {/* Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-800 text-xs">
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToQueue(product)}
                    className="w-full text-right p-2.5 hover:bg-slate-800 flex justify-between items-center transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">{product.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {product.barcode} | {product.category_name}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-amber-400">{product.retail_price} ج.م</div>
                      <div className="text-[10px] text-slate-400">متاح: {product.stock_quantity}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Products Queue */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400 font-medium">
              <span>المنتجات المحددة في قائمة الطباعة ({queue.length}):</span>
              <span>إجمالي الملصقات: <strong className="text-amber-400 font-mono text-sm">{totalLabelsCount}</strong></span>
            </div>

            {queue.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-700 rounded-lg text-slate-400 text-xs">
                لم يتم اختيار أي منتجات بعد. استخدم حقل البحث أعلاه لإضافة المنتجات لقائمة الطباعة.
              </div>
            ) : (
              <div className="divide-y divide-slate-700/60 border border-slate-700 rounded-lg overflow-hidden max-h-80 overflow-y-auto bg-slate-900/40">
                {queue.map(({ product, quantity }) => (
                  <div key={product.id} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-100 truncate">{product.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {product.barcode} • {product.retail_price_formatted}
                      </div>
                    </div>

                    {/* Quantity Modifier */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[11px]">العدد:</span>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={quantity}
                        onChange={(e) => updateQuantity(product.id, parseInt(e.target.value, 10) || 1)}
                        className="w-16 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-center font-mono font-bold text-amber-300 text-xs focus:ring-1 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeFromQueue(product.id)}
                        className="text-rose-400 hover:text-rose-300 p-1 text-sm mr-1"
                        title="حذف من القائمة"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Layout & Print Preferences */}
        <div className="lg:col-span-5 bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-4">
          <h2 className="text-sm font-bold text-slate-200 border-b border-slate-700 pb-2">
            2. إعدادات المقاس وتنسيق الملصق
          </h2>

          {/* Layout Mode */}
          <div className="space-y-1.5 text-xs">
            <label className="block text-slate-300 font-semibold">نوع الورق / الطابعة:</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer hover:border-slate-600">
                <input
                  type="radio"
                  name="layoutMode"
                  value="thermal"
                  checked={layoutMode === 'thermal'}
                  onChange={() => setLayoutMode('thermal')}
                  className="text-amber-500"
                />
                <div>
                  <div className="font-bold text-slate-200">ملصق حراري مفرد (طابعة باركود حرارية)</div>
                  <div className="text-[11px] text-slate-400">ملصقات رول مستمرة (50×25 مم أو 38×25 مم)</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer hover:border-slate-600">
                <input
                  type="radio"
                  name="layoutMode"
                  value="a4-grid-3"
                  checked={layoutMode === 'a4-grid-3'}
                  onChange={() => setLayoutMode('a4-grid-3')}
                  className="text-amber-500"
                />
                <div>
                  <div className="font-bold text-slate-200">صفحة A4 ملصقات (3 أعمدة)</div>
                  <div className="text-[11px] text-slate-400">ورق A4 لاصق مقسم 3 أعمدة (21 ملصق / صفحة)</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer hover:border-slate-600">
                <input
                  type="radio"
                  name="layoutMode"
                  value="a4-grid-4"
                  checked={layoutMode === 'a4-grid-4'}
                  onChange={() => setLayoutMode('a4-grid-4')}
                  className="text-amber-500"
                />
                <div>
                  <div className="font-bold text-slate-200">صفحة A4 ملصقات (4 أعمدة)</div>
                  <div className="text-[11px] text-slate-400">ورق A4 لاصق مكثف 4 أعمدة (32 ملصق / صفحة)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Visibility Options */}
          <div className="space-y-2 pt-2 border-t border-slate-700 text-xs">
            <span className="block text-slate-300 font-semibold">حقول الملصق:</span>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showShowroomName}
                  onChange={(e) => setShowShowroomName(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span className="text-slate-300">اسم المعرض (العالمية للأثاث والمفروشات)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span className="text-slate-300">سعر البيع للمستهلك</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCategory}
                  onChange={(e) => setShowCategory(e.target.checked)}
                  className="rounded text-amber-500"
                />
                <span className="text-slate-300">فئة الصنف</span>
              </label>
            </div>
          </div>

          <div className="p-3 bg-slate-900 rounded-lg border border-slate-700 text-[11px] text-slate-400 leading-relaxed">
            💡 <strong>معلومة:</strong> يتم تشفير الباركود تلقائياً بمعيار Code 128 المتوافق مع كافة قارئات الباركود الليزرية والضوئية، دون إظهار أي تكاليف شراء داخلية.
          </div>
        </div>
      </div>

      {/* Live Printable Preview Area */}
      <div className="space-y-3">
        <div className="no-print flex justify-between items-center text-xs font-bold text-slate-300">
          <span>معاينة الطباعة المباشرة ({flattenedLabels.length} ملصق):</span>
          <span className="text-slate-400 font-normal text-[11px]">
            المظهر المطابق تماماً لما سيظهر على الطابعة
          </span>
        </div>

        {/* Printable Area Container */}
        <div
          id="printable-labels"
          className="bg-white text-slate-900 p-4 rounded-xl border border-slate-200 shadow print:shadow-none print:border-none print:p-0 print:m-0"
        >
          {isPreparingLabels ? (
            <div className="p-12 text-center text-slate-500 text-xs flex justify-center items-center gap-2">
              <Spinner size="md" />
              <span>جاري تجهيز بيانات الملصقات...</span>
            </div>
          ) : flattenedLabels.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              لا توجد ملصقات في المعاينة. قم باختيار منتج من القائمة أعلاه.
            </div>
          ) : (
            <div
              className={
                layoutMode === 'thermal'
                  ? 'flex flex-col items-center gap-4 print:gap-0'
                  : layoutMode === 'a4-grid-3'
                  ? 'grid grid-cols-3 gap-2 p-2 print:gap-1.5 print:p-0'
                  : 'grid grid-cols-4 gap-1.5 p-2 print:gap-1 print:p-0'
              }
            >
              {flattenedLabels.map((lbl, idx) => (
                <div
                  key={`${lbl.product_id}-${idx}`}
                  className="bg-white border border-slate-300 rounded p-2 text-center flex flex-col items-center justify-between shadow-xs print:shadow-none print:border print:border-slate-400 print:rounded-none page-break-avoid"
                  style={{
                    width: layoutMode === 'thermal' ? '50mm' : 'auto',
                    minHeight: layoutMode === 'thermal' ? '30mm' : '28mm',
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                  }}
                  dir="rtl"
                >
                  {/* Top: Showroom & Category */}
                  <div className="w-full flex justify-between items-center text-[9px] text-slate-600 border-b border-slate-200 pb-0.5 mb-1 px-0.5">
                    {showShowroomName ? (
                      <span className="font-bold text-slate-900 truncate">
                        {lbl.showroom_name || 'العالمية للأثاث'}
                      </span>
                    ) : (
                      <span />
                    )}
                    {showCategory && (
                      <span className="text-slate-500 font-mono text-[8px]">
                        [{lbl.category_code || lbl.category_name}]
                      </span>
                    )}
                  </div>

                  {/* Product Name */}
                  <div className="w-full text-center px-1 mb-1">
                    <span
                      className="font-bold text-slate-950 block text-[11px] leading-tight line-clamp-2"
                      title={lbl.product_name}
                    >
                      {lbl.product_name}
                    </span>
                  </div>

                  {/* Code 128 Barcode with human readable text */}
                  <div className="my-0.5 flex justify-center w-full">
                    <Code128Barcode
                      value={lbl.barcode}
                      height={28}
                      moduleWidth={1.15}
                      fontSize={10}
                      showText={true}
                    />
                  </div>

                  {/* Bottom: Retail Price */}
                  {showPrice && (
                    <div className="w-full pt-0.5 border-t border-slate-200 flex justify-between items-center text-[10px] px-1 font-bold text-slate-900 mt-0.5">
                      <span className="text-[8px] text-slate-500 font-normal">السعر:</span>
                      <span className="font-mono text-[11px] text-slate-950">
                        {lbl.retail_price_formatted}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
