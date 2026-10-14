import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { productsApi } from '../../services/api/productsApi';
import type { Product, BarcodeLabel } from '../../types/domain';
import { Button, Input, Spinner, Alert, Card, Badge } from '../../components/ui';
import { Code128Barcode } from '../../components/barcode/Code128Barcode';
import { Printer, Trash2, Info, Barcode } from 'lucide-react';
import {
  LABEL_FORMATS,
  LABEL_FORMAT_ORDER,
  A4_WIDTH_MM,
  MAX_LABELS_PER_BATCH,
  chunkIntoSheets,
  pageRuleFor,
  type LabelFormat,
  type LabelFormatId,
} from './labelFormats';

interface QueueItem {
  product: Product;
  quantity: number;
}

interface LabelFields {
  showShowroomName: boolean;
  showPrice: boolean;
  showCategory: boolean;
}

const DEFAULT_SHOWROOM_NAME = 'معرض العالمية للمفروشات';
const MM_TO_PX = 96 / 25.4;
const PREVIEW_THERMAL_LIMIT = 60;
const PREVIEW_SHEET_LIMIT = 2;

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-bold)',
  color: 'var(--text-secondary)',
  marginBottom: '0.5rem',
};

const ellipsis: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

/** One label's content, sized to fill its mm box. Shared by the preview and the print output. */
const LabelContent: React.FC<{ label: BarcodeLabel; format: LabelFormat; fields: LabelFields }> = ({ label, format, fields }) => {
  const t = format.typography;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: format.kind === 'thermal' ? '1mm 1.5mm' : '2mm 3mm',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        textAlign: 'center',
        color: '#000000',
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
        direction: 'rtl',
        fontFamily: 'var(--font-family-base)',
      }}
    >
      {(fields.showShowroomName || fields.showCategory) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2px', fontSize: `${t.headerFontPx}px`, lineHeight: 1.2 }}>
          <span style={{ fontWeight: 700, ...ellipsis }}>{fields.showShowroomName ? label.showroom_name || DEFAULT_SHOWROOM_NAME : ''}</span>
          {fields.showCategory && (
            <span style={{ fontFamily: 'monospace', flexShrink: 0 }}>[{label.category_code || label.category_name}]</span>
          )}
        </div>
      )}
      <div style={{ fontSize: `${t.nameFontPx}px`, fontWeight: 700, lineHeight: 1.2, ...ellipsis }} title={label.product_name}>
        {label.product_name}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', minHeight: 0 }}>
        <Code128Barcode
          value={label.barcode}
          height={t.barHeightPx}
          moduleWidth={t.moduleWidthPx}
          fontSize={t.barTextFontPx}
          showText={true}
        />
      </div>
      {fields.showPrice && (
        <div style={{ fontSize: `${t.priceFontPx}px`, fontWeight: 700, lineHeight: 1.2 }}>
          {label.retail_price_formatted}
        </div>
      )}
    </div>
  );
};

/** An A4 sheet laid out in a fixed mm grid. */
const A4Sheet: React.FC<{ labels: BarcodeLabel[]; format: LabelFormat; fields: LabelFields; outlined: boolean }> = ({
  labels,
  format,
  fields,
  outlined,
}) => (
  <div
    style={{
      width: `${A4_WIDTH_MM}mm`,
      height: `${format.rows * format.heightMm}mm`,
      display: 'grid',
      gridTemplateColumns: `repeat(${format.columns}, ${format.widthMm}mm)`,
      gridTemplateRows: `repeat(${format.rows}, ${format.heightMm}mm)`,
      backgroundColor: '#FFFFFF',
      direction: 'rtl',
    }}
  >
    {labels.map((lbl, idx) => (
      <div
        key={`${lbl.product_id}_${idx}`}
        style={{ outline: outlined ? '1px dashed var(--border-strong)' : 'none', outlineOffset: '-1px', overflow: 'hidden' }}
      >
        <LabelContent label={lbl} format={format} fields={fields} />
      </div>
    ))}
  </div>
);

/** Scales a real-size A4 sheet down to the preview column width. */
const ScaledSheetPreview: React.FC<{ children: React.ReactNode; rows: number; format: LabelFormat }> = ({ children, rows, format }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const sheetWidthPx = A4_WIDTH_MM * MM_TO_PX;
  const sheetHeightPx = rows * format.heightMm * MM_TO_PX;
  const scale = containerWidth > 0 ? Math.min(1, containerWidth / sheetWidthPx) : 1;

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {/* LTR wrapper so the unscaled sheet overflows to the right and scales from the top-left corner */}
      <div style={{ height: `${sheetHeightPx * scale}px`, width: `${sheetWidthPx * scale}px`, margin: '0 auto', overflow: 'hidden', direction: 'ltr' }}>
        <div
          style={{
            width: `${sheetWidthPx}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            boxShadow: 'var(--shadow-sm)',
            direction: 'ltr',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export const BarcodePrintingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialProductId = searchParams.get('productId');

  // Search & catalog
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // Print queue
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPreparingLabels, setIsPreparingLabels] = useState<boolean>(false);
  const [preparedLabels, setPreparedLabels] = useState<BarcodeLabel[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Format & fields
  const [formatId, setFormatId] = useState<LabelFormatId>('thermal-50x25');
  const [fields, setFields] = useState<LabelFields>({ showShowroomName: true, showPrice: true, showCategory: true });
  const format = LABEL_FORMATS[formatId];

  // If productId passed in query param, load and add to queue
  useEffect(() => {
    if (!initialProductId) return;
    const pid = parseInt(initialProductId, 10);
    if (isNaN(pid)) return;
    productsApi.getById(pid)
      .then((p) => {
        if (p && p.is_active) {
          setQueue((prev) => (prev.some((q) => q.product.id === p.id) ? prev : [...prev, { product: p, quantity: 1 }]));
        }
      })
      .catch(() => {});
  }, [initialProductId]);

  // Product search debounce
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) return;

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

  const addToQueue = (product: Product, defaultQty = 1) => {
    setQueue((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx >= 0) {
        return prev.map((item, i) => (i === existingIdx ? { ...item, quantity: item.quantity + defaultQty } : item));
      }
      return [...prev, { product, quantity: defaultQty }];
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQuantity = (productId: number, qty: number) => {
    const safeQty = Math.max(1, Math.min(500, qty));
    setQueue((prev) => prev.map((item) => (item.product.id === productId ? { ...item, quantity: safeQty } : item)));
  };

  const removeFromQueue = (productId: number) => {
    setQueue((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearQueue = () => {
    setQueue([]);
    setPreparedLabels([]);
  };

  // Whenever the queue changes, prepare labels via the preview endpoint
  useEffect(() => {
    let isMounted = true;
    if (queue.length === 0) {
      const resetTimer = setTimeout(() => {
        if (isMounted) setPreparedLabels([]);
      }, 0);
      return () => {
        isMounted = false;
        clearTimeout(resetTimer);
      };
    }

    const itemsPayload = queue.map((q) => ({ product_id: q.product.id, quantity: q.quantity }));

    const timer = setTimeout(() => {
      setIsPreparingLabels(true);
      setError(null);
      productsApi.previewBarcodes(itemsPayload)
        .then((res) => {
          if (isMounted) setPreparedLabels(res.data.labels);
        })
        .catch(() => {
          if (isMounted) setError('تعذر تجهيز ملصقات الباركود من الخادم. يرجى التحقق من الاتصال.');
        })
        .finally(() => {
          if (isMounted) setIsPreparingLabels(false);
        });
    }, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [queue]);

  const totalLabelsCount = useMemo(() => queue.reduce((sum, item) => sum + item.quantity, 0), [queue]);

  // One entry per physical label
  const flattenedLabels = useMemo(() => {
    const list: BarcodeLabel[] = [];
    for (const label of preparedLabels) {
      const count = label.print_quantity || 1;
      for (let i = 0; i < count; i++) list.push(label);
    }
    return list;
  }, [preparedLabels]);

  const sheets = useMemo(() => chunkIntoSheets(flattenedLabels, format), [flattenedLabels, format]);
  const overLimit = totalLabelsCount > MAX_LABELS_PER_BATCH;
  const canPrint = flattenedLabels.length > 0 && !isPreparingLabels && !overLimit;

  const handlePrint = () => {
    window.print();
  };

  const toggleField = (key: keyof LabelFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((prev) => ({ ...prev, [key]: e.target.checked }));

  const printableRoot = typeof document !== 'undefined' ? document.getElementById('printable-root') : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '100rem', margin: '0 auto', width: '100%' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1
            style={{
              fontSize: 'var(--font-size-xl, 20px)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Barcode size={22} />
            طباعة ملصقات الباركود
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            توليد وطباعة باركود الأصناف للأرفف والتغليف وفق معيار Code 128
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {queue.length > 0 && (
            <Button variant="secondary" onClick={clearQueue}>
              مسح القائمة
            </Button>
          )}
          <Button variant="primary" onClick={handlePrint} disabled={!canPrint} icon={<Printer size={16} />}>
            طباعة الملصقات ({flattenedLabels.length})
          </Button>
        </div>
      </div>

      {overLimit && (
        <Alert
          type="error"
          message={`الحد الأقصى للطباعة في الدفعة الواحدة هو ${MAX_LABELS_PER_BATCH} ملصق منعاً لتجميد الطابعة. العدد المحدد حالياً: ${totalLabelsCount}`}
        />
      )}
      {error && <Alert type="error" message={error} />}

      <div className="barcode-workspace-grid">
        {/* Controls column: products + settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          <Card dense title="1. الأصناف المطلوب طباعتها" subtitle={`${queue.length} صنف — ${totalLabelsCount} ملصق`}>
            <div style={{ position: 'relative' }}>
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value.trim()) setSearchResults([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    e.preventDefault();
                    addToQueue(searchResults[0], 1);
                  } else if (e.key === 'Escape') {
                    setSearchResults([]);
                  }
                }}
                placeholder="ابحث باسم الصنف أو امسح الباركود ثم Enter..."
                aria-label="بحث عن صنف لإضافته"
                rightIcon={isSearching ? <Spinner size="sm" /> : undefined}
                autoFocus
              />

              {searchResults.length > 0 && (
                <div
                  role="listbox"
                  style={{
                    position: 'absolute',
                    zIndex: 20,
                    top: 'calc(100% + 4px)',
                    insetInline: 0,
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                  }}
                >
                  {searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => addToQueue(product, 1)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.6rem 0.85rem',
                        border: 'none',
                        borderBottom: '1px solid var(--border-subtle)',
                        background: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'right',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: 600, fontSize: '13px', ...ellipsis }}>{product.name}</span>
                        <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {product.barcode} | {product.category_name}
                        </span>
                      </span>
                      <span style={{ textAlign: 'left', flexShrink: 0 }}>
                        <span style={{ display: 'block', fontWeight: 700, fontSize: '13px', direction: 'ltr' }}>
                          {product.retail_price_formatted}
                        </span>
                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-success-700)' }}>
                          رصيد: {product.stock_quantity}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '0.85rem' }}>
              {queue.length === 0 ? (
                <div
                  style={{
                    border: '1px dashed var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1.5rem',
                    textAlign: 'center',
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                  }}
                >
                  القائمة فارغة. ابحث عن أصناف أعلاه لإضافتها وتحديد عدد الملصقات لكل صنف.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', maxHeight: '22rem', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '0.5rem 0.75rem' }}>الصنف</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '90px' }}>العدد</th>
                        <th style={{ padding: '0.5rem 0.75rem', width: '48px' }} aria-label="حذف" />
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map(({ product, quantity }) => (
                        <tr key={product.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '0.5rem 0.75rem', maxWidth: 0 }}>
                            <div style={{ fontWeight: 600, ...ellipsis }}>{product.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {product.barcode} | {product.retail_price_formatted}
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              value={quantity}
                              aria-label={`عدد ملصقات ${product.name}`}
                              onChange={(e) => updateQuantity(product.id, parseInt(e.target.value, 10) || 1)}
                              style={{
                                width: '100%',
                                height: '36px',
                                padding: '0 0.4rem',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-sm)',
                                textAlign: 'center',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                color: 'var(--text-primary)',
                              }}
                            />
                          </td>
                          <td style={{ padding: '0.5rem 0.5rem' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromQueue(product.id)}
                              title="حذف من القائمة"
                              aria-label={`حذف ${product.name} من القائمة`}
                              style={{ color: 'var(--color-danger)', padding: '0 0.5rem' }}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          <Card dense title="2. مقاس الملصق والحقول">
            <div style={sectionTitleStyle}>نوع الورق / الطابعة</div>
            <div role="radiogroup" aria-label="مقاس الملصق" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
              {LABEL_FORMAT_ORDER.map((id) => {
                const f = LABEL_FORMATS[id];
                const isSelected = id === formatId;
                return (
                  <label
                    key={id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? '2px solid var(--color-navy-950)' : '1px solid var(--border-default)',
                      backgroundColor: isSelected ? 'var(--color-navy-50)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="label-format"
                      value={id}
                      checked={isSelected}
                      onChange={() => setFormatId(id)}
                      style={{ marginTop: '3px' }}
                    />
                    <span>
                      <span style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>{f.title}</span>
                      <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)' }}>{f.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div style={{ ...sectionTitleStyle, marginTop: '1rem' }}>حقول الملصق</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={fields.showShowroomName} onChange={toggleField('showShowroomName')} />
                اسم المعرض
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={fields.showPrice} onChange={toggleField('showPrice')} />
                سعر البيع للمستهلك
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={fields.showCategory} onChange={toggleField('showCategory')} />
                رمز الفئة
              </label>
            </div>

            <div
              style={{
                marginTop: '1rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-start',
                padding: '0.6rem 0.75rem',
                backgroundColor: 'var(--color-navy-50)',
                border: '1px solid var(--color-navy-100)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                يُشفَّر الباركود بمعيار Code 128 المتوافق مع قارئات الباركود، ولا يظهر على الملصق أي سعر شراء أو تكلفة داخلية.
                عند الطباعة اختر الطابعة المناسبة واضبط الهوامش على «بلا».
              </span>
            </div>
          </Card>
        </div>

        {/* Live preview column */}
        <Card
          dense
          title="معاينة الطباعة المباشرة"
          subtitle={`${format.title} — المقاس الفعلي للملصق ${format.widthMm}×${format.heightMm} مم`}
          actions={
            <span style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
              {isPreparingLabels && <Spinner size="sm" />}
              <Badge variant="neutral" size="sm">{flattenedLabels.length} ملصق</Badge>
              {format.kind === 'a4' && sheets.length > 0 && <Badge variant="neutral" size="sm">{sheets.length} صفحة</Badge>}
            </span>
          }
          style={{ minWidth: 0 }}
        >
          <div
            style={{
              minHeight: '16rem',
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
            }}
          >
            {flattenedLabels.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', padding: '4rem 1rem' }}>
                أضف أصنافاً لقائمة الطباعة لمعاينة الملصقات هنا
              </div>
            ) : format.kind === 'thermal' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'flex-start' }}>
                {flattenedLabels.slice(0, PREVIEW_THERMAL_LIMIT).map((lbl, idx) => (
                  <div
                    key={`${lbl.product_id}_${idx}`}
                    style={{
                      width: `${format.widthMm}mm`,
                      height: `${format.heightMm}mm`,
                      backgroundColor: '#FFFFFF',
                      border: '1px solid var(--border-default)',
                      borderRadius: '2px',
                      boxShadow: 'var(--shadow-sm)',
                      overflow: 'hidden',
                    }}
                  >
                    <LabelContent label={lbl} format={format} fields={fields} />
                  </div>
                ))}
                {flattenedLabels.length > PREVIEW_THERMAL_LIMIT && (
                  <div style={{ alignSelf: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                    + {flattenedLabels.length - PREVIEW_THERMAL_LIMIT} ملصق آخر (يُطبع كاملاً)
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sheets.slice(0, PREVIEW_SHEET_LIMIT).map((sheet, sIdx) => (
                  <div key={sIdx}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      صفحة {sIdx + 1} من {sheets.length} — {sheet.length} من {format.perSheet} ملصق
                    </div>
                    <ScaledSheetPreview rows={format.rows} format={format}>
                      <A4Sheet labels={sheet} format={format} fields={fields} outlined />
                    </ScaledSheetPreview>
                  </div>
                ))}
                {sheets.length > PREVIEW_SHEET_LIMIT && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    + {sheets.length - PREVIEW_SHEET_LIMIT} صفحة أخرى (تُطبع كاملة)
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Dedicated print output into #printable-root (screen-hidden, see globals.css) */}
      {printableRoot &&
        flattenedLabels.length > 0 &&
        createPortal(
          <div className="barcode-print-portal" data-format={format.id}>
            <style>{`@media print { ${pageRuleFor(format)} }`}</style>
            {format.kind === 'thermal'
              ? flattenedLabels.map((lbl, idx) => (
                  <div
                    key={`print_${lbl.product_id}_${idx}`}
                    className="barcode-print-sheet"
                    style={{ width: `${format.widthMm}mm`, height: `${format.heightMm}mm`, overflow: 'hidden' }}
                  >
                    <LabelContent label={lbl} format={format} fields={fields} />
                  </div>
                ))
              : sheets.map((sheet, sIdx) => (
                  <div key={`print_sheet_${sIdx}`} className="barcode-print-sheet">
                    <A4Sheet labels={sheet} format={format} fields={fields} outlined={false} />
                  </div>
                ))}
          </div>,
          printableRoot
        )}
    </div>
  );
};
