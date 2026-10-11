import React, { useState, useEffect, useCallback } from 'react';
import { invoicesApi, type InvoiceFilters } from '../../services/api/invoicesApi';
import type { Invoice } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Search, Printer, Eye, RotateCw } from 'lucide-react';

export const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [saleTypeFilter, setSaleTypeFilter] = useState<'retail' | 'wholesale' | ''>('');
  const [statusFilter, setStatusFilter] = useState<'posted' | 'cancelled' | ''>('');

  // Selected Invoice for Details Modal & Print
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [printInvoiceId, setPrintInvoiceId] = useState<number | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: InvoiceFilters = {
        page: currentPage,
        per_page: 20,
        search: debouncedSearch.trim() || undefined,
        sale_type: saleTypeFilter || undefined,
        status: statusFilter || undefined,
      };

      const res = await invoicesApi.list(filters);
      setInvoices(res.data);
      setTotalCount(res.meta?.total ?? res.data.length);
    } catch {
      // Handled cleanly
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, saleTypeFilter, statusFilter]);

  useEffect(() => {
    let isMounted = true;

    const filters: InvoiceFilters = {
      page: currentPage,
      per_page: 20,
      search: debouncedSearch.trim() || undefined,
      sale_type: saleTypeFilter || undefined,
      status: statusFilter || undefined,
    };

    invoicesApi.list(filters)
      .then((res) => {
        if (isMounted) {
          setInvoices(res.data);
          setTotalCount(res.meta?.total ?? res.data.length);
        }
      })
      .catch(() => {
        // Handled cleanly
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentPage, debouncedSearch, saleTypeFilter, statusFilter]);

  const handleOpenDetails = async (invoiceId: number) => {
    setIsLoadingDetails(true);
    try {
      const fullInvoice = await invoicesApi.getById(invoiceId);
      setSelectedInvoice(fullInvoice);
    } catch {
      const item = invoices.find((i) => i.id === invoiceId);
      if (item) setSelectedInvoice(item);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleOpenPrint = (invoiceId: number) => {
    setPrintInvoiceId(invoiceId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '85rem', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-xl, 20px)', fontWeight: 700, color: 'var(--text-primary)' }}>
            سجل فواتير المبيعات
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
            استعراض وتتبع فواتير القطاعي والجملة وإعادة طباعتها
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            إجمالي الفواتير: <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong>
          </span>
          <Button variant="secondary" size="md" onClick={fetchInvoices} icon={<RotateCw size={16} />}>
            تحديث
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          backgroundColor: '#FFFFFF',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Search Input */}
        <div style={{ flex: 1, minWidth: '240px' }}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث برقم الفاتورة أو اسم العميل أو الهاتف..."
            rightIcon={<Search size={18} />}
            autoFocus
          />
        </div>

        {/* Sale Type Filter */}
        <div style={{ width: '160px' }}>
          <select
            value={saleTypeFilter}
            onChange={(e) => {
              setSaleTypeFilter(e.target.value as 'retail' | 'wholesale' | '');
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              height: 'var(--control-height, 44px)',
              padding: '0 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-medium)',
              backgroundColor: '#FFFFFF',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">جميع أنواع البيع</option>
            <option value="retail">قطاعي</option>
            <option value="wholesale">جملة</option>
          </select>
        </div>

        {/* Status Filter */}
        <div style={{ width: '150px' }}>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'posted' | 'cancelled' | '');
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              height: 'var(--control-height, 44px)',
              padding: '0 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-medium)',
              backgroundColor: '#FFFFFF',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">جميع الحالات</option>
            <option value="posted">مرحلة</option>
            <option value="cancelled">ملغاة</option>
          </select>
        </div>
      </div>

      {/* Invoices Dense Table */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '8px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: '3.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Spinner size="lg" />
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '15px' }}>
            لا توجد فواتير مبيعات مسجلة تطابق معايير البحث
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-surface-subtle, #F1F5F9)',
                    borderBottom: '2px solid var(--border-medium, #CBD5E1)',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    height: '46px',
                  }}
                >
                  <th style={{ padding: '0.625rem 0.75rem', width: '165px', minWidth: '165px', whiteSpace: 'nowrap' }}>رقم الفاتورة</th>
                  <th style={{ padding: '0.625rem 0.75rem', width: '110px', minWidth: '110px', whiteSpace: 'nowrap' }}>التاريخ</th>
                  <th style={{ padding: '0.625rem 0.75rem', width: '110px', minWidth: '110px', whiteSpace: 'nowrap' }}>النوع والوثيقة</th>
                  <th style={{ padding: '0.625rem 0.75rem', width: '130px', minWidth: '110px', maxWidth: '140px', whiteSpace: 'nowrap' }}>العميل</th>
                  <th style={{ padding: '0.625rem 0.75rem', width: '90px', minWidth: '85px', textAlign: 'left', whiteSpace: 'nowrap' }}>الإجمالي</th>
                  <th style={{ padding: '0.625rem 0.75rem', width: '90px', minWidth: '85px', textAlign: 'left', whiteSpace: 'nowrap' }}>المدفوع</th>
                  <th style={{ padding: '0.625rem 0.75rem', width: '85px', minWidth: '80px', textAlign: 'left', whiteSpace: 'nowrap' }}>المتبقي</th>
                  <th style={{ padding: '0.625rem 0.75rem', width: '80px', minWidth: '75px', textAlign: 'center', whiteSpace: 'nowrap' }}>الحالة</th>
                  <th style={{ padding: '0.625rem 0.75rem', width: '140px', minWidth: '135px', textAlign: 'center', whiteSpace: 'nowrap' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => {
                  const remainingNum = parseFloat(inv.remaining_amount || '0');
                  return (
                    <tr
                      key={inv.id}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                        height: '46px',
                        transition: 'background-color 100ms ease',
                      }}
                    >
                      {/* Invoice Number */}
                      <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, direction: 'ltr', textAlign: 'right', whiteSpace: 'nowrap', width: '165px', minWidth: '165px', fontFamily: 'monospace' }}>
                        <span style={{ color: 'var(--color-navy-950)' }}>{inv.invoice_number}</span>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-secondary)', fontSize: '12px', direction: 'ltr', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatDateTime(inv.created_at)}
                      </td>

                      {/* Document Type & Sale Type */}
                      <td style={{ padding: '0.625rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          {inv.is_replacement ? (
                            <Badge variant="primary" size="sm">بديلة (استبدال)</Badge>
                          ) : (
                            <Badge variant={inv.sale_type === 'wholesale' ? 'primary' : 'neutral'} size="sm">
                              {inv.sale_type_label || (inv.sale_type === 'wholesale' ? 'جملة' : 'قطاعي')}
                            </Badge>
                          )}
                          {inv.has_returns && (
                            <Badge variant="warning" size="sm">مرتجع</Badge>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td
                        style={{
                          padding: '0.625rem 0.75rem',
                          color: 'var(--text-primary)',
                          fontWeight: 500,
                          maxWidth: '140px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: '13px',
                        }}
                        title={inv.customer?.name || 'زبون نقدي'}
                      >
                        {inv.customer?.name || 'زبون نقدي'}
                      </td>

                      {/* Total */}
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'left', fontWeight: 700, direction: 'ltr', fontSize: '13px' }}>
                        {formatCurrency(inv.total)}
                      </td>

                      {/* Paid */}
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'left', color: 'var(--color-success)', fontWeight: 600, direction: 'ltr', fontSize: '13px' }}>
                        {formatCurrency(inv.paid_amount)}
                      </td>

                      {/* Remaining */}
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'left', direction: 'ltr', fontSize: '13px' }}>
                        {remainingNum > 0 ? (
                          <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>
                            {formatCurrency(inv.remaining_amount)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                        <Badge variant={inv.status === 'posted' ? 'success' : 'danger'} size="sm">
                          {inv.status_label || (inv.status === 'posted' ? 'مرحلة' : 'ملغاة')}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenDetails(inv.id)}
                            icon={<Eye size={13} />}
                          >
                            التفاصيل
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleOpenPrint(inv.id)}
                            icon={<Printer size={13} />}
                          >
                            طباعة
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInvoice(null)}
          title={`تفاصيل الفاتورة #${selectedInvoice.invoice_number}`}
          maxWidth="54rem"
        >
          {isLoadingDetails ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <Spinner size="md" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Replacement Banner if Exchange Invoice */}
              {selectedInvoice.is_replacement && selectedInvoice.replacement_details && (
                <div
                  style={{
                    backgroundColor: '#F0F9FF',
                    border: '1px solid #BAE6FD',
                    padding: '0.85rem 1rem',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0369A1', marginBottom: '0.35rem' }}>
                    فاتورة بديلة عن استبدال (الفاتورة الأصلية: {selectedInvoice.replacement_details.original_invoice_number || `INV-${selectedInvoice.replacement_details.original_invoice_id}`} — مرتجع: {selectedInvoice.replacement_details.return_number})
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: '#0F172A' }}>
                    <div>قيمة المرتجع: <strong>{formatCurrency(selectedInvoice.replacement_details.returned_value)}</strong></div>
                    <div>قيمة الأصناف البديلة: <strong>{formatCurrency(selectedInvoice.replacement_details.replacement_value)}</strong></div>
                    <div>المدفوع الفعلي للفرق: <strong style={{ color: 'var(--color-success)' }}>{formatCurrency(selectedInvoice.replacement_details.difference_paid_amount || selectedInvoice.replacement_details.difference_amount)}</strong></div>
                  </div>
                </div>
              )}

              {/* Partial Return Banner on Original Invoice */}
              {selectedInvoice.has_returns && (
                <div
                  style={{
                    backgroundColor: '#FFFBEB',
                    border: '1px solid #FDE68A',
                    padding: '0.85rem 1rem',
                    borderRadius: '6px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#B45309', marginBottom: '0.35rem' }}>
                    تنبيه: تم عمل مرتجع جزئي على هذه الفاتورة
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: '#0F172A' }}>
                    <div>قيمة المرتجع: <strong>{formatCurrency(selectedInvoice.returned_value)}</strong></div>
                    <div>الصافي بعد المرتجع: <strong style={{ color: 'var(--color-primary-700)' }}>{formatCurrency(selectedInvoice.net_after_returns)}</strong></div>
                  </div>
                </div>
              )}

              {/* Top Summary */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  padding: '1rem',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <div><strong>النوع:</strong> {selectedInvoice.sale_type_label}</div>
                <div><strong>التاريخ:</strong> {formatDateTime(selectedInvoice.created_at)}</div>
                <div><strong>العميل:</strong> {selectedInvoice.customer?.name || 'زبون نقدي'}</div>
                <div><strong>الحالة:</strong> {selectedInvoice.status_label}</div>
              </div>

              {/* Items List */}
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '0.5rem' }}>بنود الفاتورة</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-surface-subtle)', borderBottom: '1px solid var(--border-medium)' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'right' }}>الصنف</th>
                      <th style={{ padding: '6px 8px', textAlign: 'center', width: '60px' }}>الكمية</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', width: '100px' }}>السعر</th>
                      <th style={{ padding: '6px 8px', textAlign: 'left', width: '110px' }}>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items?.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '6px 8px' }}>{item.product_name}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'left', direction: 'ltr' }}>{formatCurrency(item.unit_sale_price)}</td>
                        <td style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, direction: 'ltr' }}>{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '15px',
                }}
              >
                <span>صافي الفاتورة: {formatCurrency(selectedInvoice.total)}</span>
                {selectedInvoice.is_replacement && selectedInvoice.replacement_details ? (
                  <span style={{ color: 'var(--color-success)' }}>
                    المدفوع الفعلي للفرق: {formatCurrency(selectedInvoice.replacement_details.difference_paid_amount || selectedInvoice.replacement_details.difference_amount)}
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-success)' }}>المدفوع: {formatCurrency(selectedInvoice.paid_amount)}</span>
                )}
                {parseFloat(selectedInvoice.remaining_amount) > 0 && (
                  <span style={{ color: 'var(--color-danger)' }}>المتبقي: {formatCurrency(selectedInvoice.remaining_amount)}</span>
                )}
              </div>


              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '0.75rem', marginTop: '0.5rem' }}>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    handleOpenPrint(selectedInvoice.id);
                  }}
                  icon={<Printer size={16} />}
                >
                  طباعة الفاتورة
                </Button>
                <Button variant="secondary" size="md" onClick={() => setSelectedInvoice(null)}>
                  إغلاق
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Invoice Print Modal (Renders to #printable-root) */}
      {printInvoiceId && (
        <InvoicePrintModal
          invoiceId={printInvoiceId}
          isOpen={true}
          onClose={() => setPrintInvoiceId(null)}
        />
      )}
    </div>
  );
};
