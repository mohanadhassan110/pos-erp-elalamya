import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { productsApi } from '../../services/api/productsApi';
import type { Product, BarcodeLabel } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { Code128Barcode } from '../../components/barcode/Code128Barcode';
import { Printer, Trash2, Info, Barcode } from 'lucide-react';

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
    setQueue((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearQueue = () => {
    setQueue([]);
    setPreparedLabels([]);
  };

  // Whenever queue changes, generate preview via previewBarcodes API endpoint
  useEffect(() => {
    if (queue.length === 0) {
      setPreparedLabels([]);
      return;
    }

    const itemsPayload = queue.map((q) => ({
      product_id: q.product.id,
      quantity: q.quantity,
    }));

    let isMounted = true;
    const timer = setTimeout(() => {
      setIsPreparingLabels(true);
      setError(null);

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

  const printableRoot = typeof document !== 'undefined' ? document.getElementById('printable-root') : null;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto text-gray-900 font-sans" dir="rtl">
      {/* Page Header (Hidden when printing) */}
      <div className="no-print flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Barcode size={22} className="text-[#0B1220]" />
            طباعة ملصقات الباركود
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            توليد وطباعة باركود الأصناف للأرفف والتغليف وفق معيار Code 128
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handlePrint}
            disabled={flattenedLabels.length === 0 || isPreparingLabels || totalLabelsCount > 1000}
            className="flex items-center gap-1.5 min-h-[44px]"
          >
            <Printer size={16} />
            طباعة الملصقات ({flattenedLabels.length})
          </Button>
          {queue.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearQueue} className="min-h-[44px]">
              مسح القائمة
            </Button>
          )}
        </div>
      </div>

      {totalLabelsCount > 1000 && (
        <div className="no-print">
          <Alert
            type="error"
            message={`الحد الأقصى للطباعة في الدفعة الواحدة هو 1000 ملصق منعاً لتجميد الطابعة. العدد المحدد حالياً: ${totalLabelsCount}`}
          />
        </div>
      )}

      {error && (
        <div className="no-print">
          <Alert type="error" message={error} />
        </div>
      )}

      {/* Main Grid: Queue & Config (Hidden when printing) */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Product Search and Selected Queue */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-2">
            1. إضافة الأصناف لقائمة الطباعة
          </h2>

          {/* Search Box */}
          <div className="relative">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الصنف أو الباركود لإضافته..."
              autoFocus
            />
            {isSearching && (
              <span className="absolute left-3 top-2.5">
                <Spinner size="sm" />
              </span>
            )}

            {/* Dropdown Results */}
            {searchResults.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden divide-y divide-gray-100">
                {searchResults.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToQueue(product, 1)}
                    className="p-3 hover:bg-gray-50 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-xs text-gray-900">{product.name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {product.barcode} | {product.category_name}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-[#0B1220] text-xs font-mono">{product.retail_price_formatted}</div>
                      <div className="text-[10px] text-emerald-600">رصيد: {product.stock_quantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Queue Table */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>الأصناف المختارة ({queue.length}):</span>
              <span>إجمالي الملصقات: <strong className="text-gray-900 font-mono">{totalLabelsCount}</strong></span>
            </div>

            {queue.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center text-xs text-gray-400">
                القائمة فارغة. ابحث عن أصناف أعلاه لإضافتها وتحديد عدد الملصقات لكل صنف.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
                {queue.map(({ product, quantity }) => (
                  <div key={product.id} className="p-3 flex items-center justify-between gap-3 bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-gray-900 truncate">{product.name}</div>
                      <div className="text-[11px] text-gray-500 font-mono">
                        {product.barcode} | {product.retail_price_formatted}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-gray-500">العدد:</label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={quantity}
                        onChange={(e) => updateQuantity(product.id, parseInt(e.target.value, 10) || 1)}
                        className="w-16 bg-gray-50 border border-gray-300 rounded px-2 py-1 text-center text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-1 focus:ring-navy-600"
                      />
                      <button
                        type="button"
                        onClick={() => removeFromQueue(product.id)}
                        className="text-gray-400 hover:text-rose-600 p-1.5 transition-colors"
                        title="حذف من القائمة"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Layout & Print Preferences */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl p-4 space-y-4 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 border-b border-gray-200 pb-2">
            2. إعدادات المقاس وتنسيق الملصق
          </h2>

          {/* Layout Mode */}
          <div className="space-y-1.5 text-xs">
            <label className="block text-gray-700 font-semibold">نوع الورق / الطابعة:</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer hover:border-gray-300">
                <input
                  type="radio"
                  name="layoutMode"
                  value="thermal"
                  checked={layoutMode === 'thermal'}
                  onChange={() => setLayoutMode('thermal')}
                  className="text-navy-800"
                />
                <div>
                  <div className="font-bold text-gray-900">ملصق حراري مفرد (طابعة باركود حرارية)</div>
                  <div className="text-[11px] text-gray-500">ملصقات رول مستمرة (50×25 مم أو 38×25 مم)</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer hover:border-gray-300">
                <input
                  type="radio"
                  name="layoutMode"
                  value="a4-grid-3"
                  checked={layoutMode === 'a4-grid-3'}
                  onChange={() => setLayoutMode('a4-grid-3')}
                  className="text-navy-800"
                />
                <div>
                  <div className="font-bold text-gray-900">صفحة A4 ملصقات (3 أعمدة)</div>
                  <div className="text-[11px] text-gray-500">ورق A4 لاصق مقسم 3 أعمدة (21 ملصق / صفحة)</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200 cursor-pointer hover:border-gray-300">
                <input
                  type="radio"
                  name="layoutMode"
                  value="a4-grid-4"
                  checked={layoutMode === 'a4-grid-4'}
                  onChange={() => setLayoutMode('a4-grid-4')}
                  className="text-navy-800"
                />
                <div>
                  <div className="font-bold text-gray-900">صفحة A4 ملصقات (4 أعمدة)</div>
                  <div className="text-[11px] text-gray-500">ورق A4 لاصق مكثف 4 أعمدة (32 ملصق / صفحة)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Visibility Options */}
          <div className="space-y-2 pt-2 border-t border-gray-200 text-xs">
            <span className="block text-gray-700 font-semibold">حقول الملصق:</span>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showShowroomName}
                  onChange={(e) => setShowShowroomName(e.target.checked)}
                  className="rounded text-navy-800"
                />
                <span className="text-gray-700">اسم المعرض (معرض العالمية للمفروشات)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="rounded text-navy-800"
                />
                <span className="text-gray-700">سعر البيع للمستهلك</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCategory}
                  onChange={(e) => setShowCategory(e.target.checked)}
                  className="rounded text-navy-800"
                />
                <span className="text-gray-700">فئة الصنف</span>
              </label>
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-900 leading-relaxed flex items-start gap-2">
            <Info size={16} className="text-blue-700 shrink-0 mt-0.5" />
            <div>
              <strong>معلومة:</strong> يتم تشفير الباركود تلقائياً بمعيار Code 128 المتوافق مع كافة قارئات الباركود الليزرية والضوئية، دون إظهار أي تكاليف شراء داخلية.
            </div>
          </div>
        </div>
      </div>

      {/* Live On-Screen Preview Area */}
      <div className="no-print space-y-3">
        <div className="flex justify-between items-center text-xs font-bold text-gray-800">
          <span>معاينة الطباعة المباشرة ({flattenedLabels.length} ملصق):</span>
          <span className="text-gray-500 font-normal text-[11px]">
            المظهر المطابق تماماً لما سيظهر على الطابعة
          </span>
        </div>

        <div className="p-4 bg-gray-100 rounded-xl border border-gray-300 min-h-[160px] overflow-x-auto">
          {flattenedLabels.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-10">
              أضف أصنافاً لقائمة الطباعة لمعاينة الملصقات هنا
            </div>
          ) : (
            <div
              className={
                layoutMode === 'thermal'
                  ? 'flex flex-wrap gap-3'
                  : layoutMode === 'a4-grid-3'
                  ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'
                  : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2'
              }
            >
              {flattenedLabels.map((lbl, idx) => (
                <div
                  key={`${lbl.product_id}_${idx}`}
                  className="bg-white border border-gray-300 rounded p-2 text-center shadow-sm w-48 flex flex-col justify-between"
                  style={{ minHeight: '110px' }}
                >
                  <div className="w-full flex justify-between items-center text-[9px] text-gray-600 border-b border-gray-100 pb-0.5 mb-1 px-0.5">
                    {showShowroomName ? (
                      <span className="font-bold text-gray-900 truncate">
                        {lbl.showroom_name || 'معرض العالمية للمفروشات'}
                      </span>
                    ) : (
                      <span />
                    )}
                    {showCategory && (
                      <span className="text-gray-500 font-mono text-[8px]">
                        [{lbl.category_code || lbl.category_name}]
                      </span>
                    )}
                  </div>

                  <div className="w-full text-center px-1 mb-1">
                    <span
                      className="font-bold text-gray-900 block text-[11px] leading-tight line-clamp-2"
                      title={lbl.product_name}
                    >
                      {lbl.product_name}
                    </span>
                  </div>

                  <div className="my-0.5 flex justify-center w-full">
                    <Code128Barcode
                      value={lbl.barcode}
                      height={28}
                      moduleWidth={1.15}
                      fontSize={10}
                      showText={true}
                    />
                  </div>

                  {showPrice && (
                    <div className="w-full pt-0.5 border-t border-gray-100 flex justify-between items-center text-[10px] px-1 font-bold text-gray-900 mt-0.5">
                      <span className="text-[8px] text-gray-500 font-normal">السعر:</span>
                      <span className="font-mono text-[11px] text-gray-900">
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

      {/* Dedicated Printable Portal into #printable-root */}
      {printableRoot &&
        flattenedLabels.length > 0 &&
        createPortal(
          <div
            className={`barcode-print-portal ${
              layoutMode === 'thermal'
                ? 'print-thermal-labels'
                : layoutMode === 'a4-grid-3'
                ? 'print-a4-labels-3'
                : 'print-a4-labels-4'
            }`}
          >
            {flattenedLabels.map((lbl, idx) => (
              <div
                key={`print_${lbl.product_id}_${idx}`}
                className="single-barcode-label"
                style={{
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  textAlign: 'center',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: layoutMode === 'thermal' ? 'none' : '1px dashed #ccc',
                  width: layoutMode === 'thermal' ? '50mm' : 'auto',
                  height: layoutMode === 'thermal' ? '25mm' : 'auto',
                }}
              >
                {showShowroomName && (
                  <div style={{ fontSize: '8px', fontWeight: 'bold' }}>
                    {lbl.showroom_name || 'معرض العالمية للمفروشات'}
                  </div>
                )}
                <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{lbl.product_name}</div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Code128Barcode
                    value={lbl.barcode}
                    height={24}
                    moduleWidth={1}
                    fontSize={9}
                    showText={true}
                  />
                </div>
                {showPrice && (
                  <div style={{ fontSize: '9px', fontWeight: 'bold' }}>{lbl.retail_price_formatted}</div>
                )}
              </div>
            ))}
          </div>,
          printableRoot
        )}
    </div>
  );
};
