import React, { useState, useEffect } from 'react';
import { returnsApi } from '../../services/api/returnsApi';
import { useToast } from '../../app/providers/useToast';
import type { SalesReturn } from '../../types/domain';
import { Button, Input, Badge, Modal, Spinner } from '../../components/ui';
import { formatCurrency } from '../../utils/formatters';
import { Search, Eye, FileText, Printer } from 'lucide-react';
import { ReturnPrintModal } from './ReturnPrintModal';

export interface ReturnHistoryProps {
  /** Bumped by the parent after a new return so the list reloads. */
  refreshKey?: number;
  onOpenInvoice?: (invoiceId: number) => void;
}

const RESOLUTION_FILTERS = [
  { value: '', label: 'جميع أنواع التسوية' },
  { value: 'refund_cash', label: 'استرداد نقدي' },
  { value: 'exchange_equal', label: 'استبدال متطابق' },
  { value: 'exchange_upgrade', label: 'استبدال ترقية' },
  { value: 'customer_account_credit', label: 'رصيد دائن للعميل' },
];

const resolutionVariant = (r: SalesReturn['resolution']) =>
  r === 'refund_cash' ? 'warning' : r === 'customer_account_credit' ? 'primary' : 'success';

const selectStyle: React.CSSProperties = {
  width: '100%',
  height: 'var(--control-height, 44px)',
  padding: '0 0.75rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-medium)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  fontFamily: 'inherit',
};

const th: React.CSSProperties = { padding: '0.625rem 0.75rem', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '0.625rem 0.75rem', whiteSpace: 'nowrap' };

export const ReturnHistory: React.FC<ReturnHistoryProps> = ({ refreshKey = 0, onOpenInvoice }) => {
  const { showToast } = useToast();

  const [list, setList] = useState<SalesReturn[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [total, setTotal] = useState<number>(0);
  const [lastPage, setLastPage] = useState<number>(1);
  const [page, setPage] = useState<number>(1);

  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [resolution, setResolution] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const [selected, setSelected] = useState<SalesReturn | null>(null);
  const [printReturn, setPrintReturn] = useState<SalesReturn | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    returnsApi.list({
      search: debouncedSearch.trim() || undefined,
      resolution: resolution || undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
      page,
      per_page: 25,
    })
      .then((res) => {
        if (!active) return;
        setList(res.data);
        setTotal(res.meta?.total ?? res.data.length);
        setLastPage(res.meta?.last_page ?? 1);
      })
      .catch(() => {
        if (active) showToast('تعذر تحميل سجل المرتجعات', 'error');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [debouncedSearch, resolution, fromDate, toDate, page, refreshKey, showToast]);

  const openInvoice = (invoiceId: number) => {
    setSelected(null);
    onOpenInvoice?.(invoiceId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Filters */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '0.75rem',
          flexWrap: 'wrap',
          backgroundColor: 'var(--bg-surface)',
          padding: '1rem 1.25rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم المرتجع، رقم الفاتورة، أو اسم العميل..."
            rightIcon={<Search size={18} />}
            aria-label="بحث في المرتجعات"
          />
        </div>
        <div style={{ width: '190px' }}>
          <select
            value={resolution}
            onChange={(e) => {
              setResolution(e.target.value);
              setPage(1);
            }}
            style={selectStyle}
            aria-label="نوع التسوية"
          >
            {RESOLUTION_FILTERS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ width: '160px' }}>
          <Input
            type="date"
            label="من تاريخ"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div style={{ width: '160px' }}>
          <Input
            type="date"
            label="إلى تاريخ"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '3.5rem', display: 'flex', justifyContent: 'center' }}>
            <Spinner size="lg" />
          </div>
        ) : list.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px' }}>
            لا توجد فواتير مرتجع مسجلة تطابق معايير البحث
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-surface-subtle)',
                    borderBottom: '2px solid var(--border-medium)',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    height: '46px',
                  }}
                >
                  <th style={th}>رقم المرتجع</th>
                  <th style={th}>الفاتورة الأصلية</th>
                  <th style={th}>التاريخ</th>
                  <th style={th}>العميل</th>
                  <th style={th}>نوع التسوية</th>
                  <th style={{ ...th, textAlign: 'left' }}>قيمة المرتجع</th>
                  <th style={{ ...th, textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, idx) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      backgroundColor: idx % 2 === 0 ? 'var(--bg-surface)' : '#FFFBF5',
                      borderRight: '3px solid var(--color-warning-500)',
                      height: '46px',
                    }}
                  >
                    <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace', direction: 'ltr', textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', direction: 'rtl' }}>
                        <Badge variant="warning" size="sm">مرتجع</Badge>
                        <span>{r.return_number}</span>
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>
                      {onOpenInvoice ? (
                        <button type="button" onClick={() => openInvoice(r.invoice_id)} style={linkButtonStyle}>
                          {r.invoice_number}
                        </button>
                      ) : (
                        r.invoice_number
                      )}
                    </td>
                    <td style={{ ...td, fontSize: '12px', color: 'var(--text-secondary)', direction: 'ltr', textAlign: 'right' }}>
                      {r.created_at_formatted}
                    </td>
                    <td style={{ ...td, fontSize: '13px' }}>{r.customer_name || 'نقدي'}</td>
                    <td style={td}>
                      <Badge variant={resolutionVariant(r.resolution)} size="sm">{r.resolution_label}</Badge>
                      {r.replacement_invoice_id && (
                        <div style={{ fontSize: '12px', marginTop: '2px', color: 'var(--text-muted)' }}>
                          الفاتورة البديلة:{' '}
                          {onOpenInvoice ? (
                            <button type="button" onClick={() => openInvoice(r.replacement_invoice_id as number)} style={linkButtonStyle}>
                              {r.replacement_invoice_number || `#${r.replacement_invoice_id}`}
                            </button>
                          ) : (
                            <span style={{ fontFamily: 'monospace' }}>{r.replacement_invoice_number || `#${r.replacement_invoice_id}`}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700, direction: 'ltr', fontSize: '13px' }}>
                      {formatCurrency(r.total_return_amount)}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Button size="sm" variant="secondary" icon={<Eye size={13} />} onClick={() => setSelected(r)}>
                          عرض
                        </Button>
                        <Button size="sm" variant="secondary" icon={<Printer size={13} />} onClick={() => setPrintReturn(r)}>
                          طباعة
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lastPage > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
          <span>إجمالي المرتجعات: <strong style={{ color: 'var(--text-primary)' }}>{total}</strong></span>
          <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
            <span>صفحة {page} من {lastPage}</span>
            <Button size="sm" variant="secondary" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>التالي</Button>
          </span>
        </div>
      )}

      {selected && (
        <ReturnDetailsModal
          salesReturn={selected}
          onClose={() => setSelected(null)}
          onOpenInvoice={onOpenInvoice ? openInvoice : undefined}
          onPrint={() => setPrintReturn(selected)}
        />
      )}

      <ReturnPrintModal
        salesReturn={printReturn}
        isOpen={!!printReturn}
        onClose={() => setPrintReturn(null)}
      />
    </div>
  );
};

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--color-navy-700)',
  textDecoration: 'underline',
  cursor: 'pointer',
  fontFamily: 'monospace',
  fontSize: 'inherit',
};

const detailTh: React.CSSProperties = { padding: '0.4rem', textAlign: 'right' };
const detailTd: React.CSSProperties = { padding: '0.4rem' };

export const ReturnDetailsModal: React.FC<{
  salesReturn: SalesReturn;
  onClose: () => void;
  onOpenInvoice?: (invoiceId: number) => void;
  onPrint?: () => void;
}> = ({ salesReturn: r, onClose, onOpenInvoice, onPrint }) => (
  <Modal isOpen={true} onClose={onClose} title={`تفاصيل المرتجع: ${r.return_number}`} maxWidth="44rem">
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          backgroundColor: 'var(--bg-surface-subtle)',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
        }}
      >
        <div>الفاتورة الأصلية: <strong>{r.invoice_number}</strong></div>
        <div>التسوية: <strong>{r.resolution_label}</strong></div>
        <div>العميل: <strong>{r.customer_name || 'نقدي'}</strong></div>
        <div>المسؤول: <strong>{r.creator_name || '—'}</strong></div>
        <div>التاريخ: <strong>{r.created_at_formatted}</strong></div>
        <div>إجمالي المرتجع: <strong>{parseFloat(r.total_return_amount).toFixed(2)} ج.م</strong></div>
      </div>

      <h4 style={{ margin: '0.5rem 0 0', fontSize: '0.95rem', fontWeight: 'bold' }}>الأصناف المرتجعة</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
            <th style={detailTh}>الصنف</th>
            <th style={detailTh}>الكمية</th>
            <th style={detailTh}>السعر</th>
            <th style={detailTh}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {(r.items || []).map((it) => (
            <tr key={it.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <td style={detailTd}>{it.product_name}</td>
              <td style={{ ...detailTd, fontFamily: 'monospace' }}>{it.quantity}</td>
              <td style={{ ...detailTd, fontFamily: 'monospace' }}>{parseFloat(it.unit_sale_price).toFixed(2)} ج.م</td>
              <td style={{ ...detailTd, fontFamily: 'monospace', fontWeight: 'bold' }}>{parseFloat(it.subtotal).toFixed(2)} ج.م</td>
            </tr>
          ))}
        </tbody>
      </table>

      {r.replacement_invoice_id && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div
            style={{
              padding: '0.65rem 0.85rem',
              backgroundColor: 'var(--color-navy-50)',
              border: '1px solid var(--color-navy-100)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--color-navy-700)', marginBottom: '0.35rem' }}>
              تفاصيل الاستبدال والفاتورة البديلة ({r.replacement_invoice_number || `#${r.replacement_invoice_id}`})
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              <div>قيمة المرتجع: <strong>{parseFloat(r.total_return_amount).toFixed(2)} ج.م</strong></div>
              {r.replacement_value && (
                <div>قيمة البدائل: <strong>{parseFloat(r.replacement_value).toFixed(2)} ج.م</strong></div>
              )}
              <div>
                الفرق المسدد:{' '}
                <strong style={{ color: 'var(--color-success)' }}>
                  {parseFloat(r.difference_paid_amount || r.difference_amount || '0').toFixed(2)} ج.م
                </strong>
              </div>
            </div>
          </div>

          {r.replacement_items && r.replacement_items.length > 0 && (
            <div>
              <h4 style={{ margin: '0.5rem 0 0', fontSize: '0.95rem', fontWeight: 'bold' }}>الأصناف البديلة المسلمة</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-surface-subtle)' }}>
                    <th style={detailTh}>الصنف</th>
                    <th style={detailTh}>الكمية</th>
                    <th style={detailTh}>السعر</th>
                    <th style={detailTh}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {r.replacement_items.map((rit) => (
                    <tr key={rit.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={detailTd}>{rit.product_name}</td>
                      <td style={{ ...detailTd, fontFamily: 'monospace' }}>{rit.quantity}</td>
                      <td style={{ ...detailTd, fontFamily: 'monospace' }}>{parseFloat(rit.unit_sale_price).toFixed(2)} ج.م</td>
                      <td style={{ ...detailTd, fontFamily: 'monospace', fontWeight: 'bold' }}>{parseFloat(rit.subtotal).toFixed(2)} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {r.notes && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          <strong>ملاحظات:</strong> {r.notes}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        {onPrint && (
          <Button variant="primary" icon={<Printer size={15} />} onClick={onPrint}>
            طباعة إيصال المرتجع
          </Button>
        )}
        {onOpenInvoice && (
          <Button variant="secondary" icon={<FileText size={15} />} onClick={() => onOpenInvoice(r.invoice_id)}>
            فتح الفاتورة الأصلية
          </Button>
        )}
        {onOpenInvoice && r.replacement_invoice_id && (
          <Button variant="secondary" icon={<FileText size={15} />} onClick={() => onOpenInvoice(r.replacement_invoice_id as number)}>
            فتح الفاتورة البديلة
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>إغلاق</Button>
      </div>
    </div>
  </Modal>
);

export default ReturnHistory;
