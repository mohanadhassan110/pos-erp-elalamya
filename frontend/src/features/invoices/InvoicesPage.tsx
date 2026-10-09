import React, { useState, useEffect, useCallback } from 'react';
import { invoicesApi, type InvoiceFilters } from '../../services/api/invoicesApi';
import type { Invoice } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { InvoicePrintModal } from '../../components/invoice/InvoicePrintModal';

export const InvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [saleTypeFilter, setSaleTypeFilter] = useState<'retail' | 'wholesale' | ''>('');
  const [statusFilter, setStatusFilter] = useState<'posted' | 'cancelled' | ''>('');

  // Selected Invoice for Details Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [printInvoiceId, setPrintInvoiceId] = useState<number | null>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: InvoiceFilters = {
        page: currentPage,
        per_page: 15,
        search: search.trim() || undefined,
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
  }, [currentPage, search, saleTypeFilter, statusFilter]);

  useEffect(() => {
    let active = true;
    invoicesApi.list({
      page: currentPage,
      per_page: 15,
      search: search.trim() || undefined,
      sale_type: saleTypeFilter || undefined,
      status: statusFilter || undefined,
    }).then((res) => {
      if (active) {
        setInvoices(res.data);
        setTotalCount(res.meta?.total ?? res.data.length);
        setIsLoading(false);
      }
    }).catch(() => {
      if (active) {
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [currentPage, search, saleTypeFilter, statusFilter]);

  const handleOpenDetails = async (invoiceId: number) => {
    setIsLoadingDetails(true);
    try {
      const fullInvoice = await invoicesApi.getById(invoiceId);
      setSelectedInvoice(fullInvoice);
    } catch {
      // fallback to list item
      const item = invoices.find((i) => i.id === invoiceId);
      if (item) setSelectedInvoice(item);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handlePrint = () => {
    if (selectedInvoice) {
      setPrintInvoiceId(selectedInvoice.id);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto text-slate-100" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">سجل فواتير المبيعات</h1>
          <p className="text-xs text-slate-400 mt-0.5">استعراض وتتبع فواتير القطاعي والجملة المعتمدة</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 flex flex-wrap gap-2.5 items-center">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="بحث برقم الفاتورة أو اسم العميل..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <select
          value={saleTypeFilter}
          onChange={(e) => {
            setSaleTypeFilter(e.target.value as 'retail' | 'wholesale' | '');
            setCurrentPage(1);
          }}
          className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500"
        >
          <option value="">جميع أنواع البيع</option>
          <option value="retail">قطاعي</option>
          <option value="wholesale">جملة</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'posted' | 'cancelled' | '');
            setCurrentPage(1);
          }}
          className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500"
        >
          <option value="">جميع الحالات</option>
          <option value="posted">مرحلة</option>
          <option value="cancelled">ملغاة</option>
        </select>

        <Button variant="outline" size="sm" onClick={fetchInvoices}>
          تحديث
        </Button>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl overflow-hidden shadow">
        {isLoading ? (
          <div className="p-8 flex justify-center items-center">
            <Spinner size="md" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            لا توجد فواتير مبيعات مسجلة تطابق معايير البحث
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-3">رقم الفاتورة</th>
                  <th className="py-3 px-3">التاريخ</th>
                  <th className="py-3 px-3">النوع</th>
                  <th className="py-3 px-3">العميل</th>
                  <th className="py-3 px-3 text-left">الإجمالي</th>
                  <th className="py-3 px-3 text-left">المدفوع</th>
                  <th className="py-3 px-3 text-left">المتبقي</th>
                  <th className="py-3 px-3 text-center">الحالة</th>
                  <th className="py-3 px-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                      {inv.invoice_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {new Date(inv.created_at || '').toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant={inv.sale_type === 'wholesale' ? 'primary' : 'warning'}>
                        {inv.sale_type_label}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">
                      {inv.customer ? inv.customer.name : 'زبون نقدي'}
                    </td>
                    <td className="py-2.5 px-3 text-left font-bold text-slate-100">
                      {inv.total} ج.م
                    </td>
                    <td className="py-2.5 px-3 text-left text-emerald-400 font-semibold">
                      {inv.paid_amount} ج.م
                    </td>
                    <td className="py-2.5 px-3 text-left">
                      {parseFloat(inv.remaining_amount) > 0 ? (
                        <span className="text-rose-400 font-bold">{inv.remaining_amount} ج.م</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={inv.status === 'posted' ? 'success' : 'danger'}>
                        {inv.status_label}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDetails(inv.id)}
                          className="text-[11px] py-1 px-2"
                        >
                          عرض التفاصيل
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPrintInvoiceId(inv.id)}
                          className="text-[11px] py-1 px-2"
                        >
                          🖨️ طباعة
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-3 bg-slate-900/60 border-t border-slate-700/80 flex justify-between items-center text-xs text-slate-400">
          <span>إجمالي الفواتير: {totalCount}</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              السابق
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={invoices.length < 15 || isLoading}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              التالي
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedInvoice(null)}
          title={`تفاصيل فاتورة مبيعات ${selectedInvoice.invoice_number}`}
          maxWidth="48rem"
        >
          {isLoadingDetails ? (
            <div className="p-8 flex justify-center">
              <Spinner size="md" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-900 p-3 rounded-lg text-xs">
                <div>
                  <span className="text-slate-400 block">رقم الفاتورة:</span>
                  <span className="font-mono font-bold text-amber-400">{selectedInvoice.invoice_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">التاريخ:</span>
                  <span className="text-slate-200">{new Date(selectedInvoice.created_at || '').toLocaleString('ar-EG')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">نوع البيع:</span>
                  <span className="text-slate-200 font-semibold">{selectedInvoice.sale_type_label}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">الحالة:</span>
                  <Badge variant={selectedInvoice.status === 'posted' ? 'success' : 'danger'}>
                    {selectedInvoice.status_label}
                  </Badge>
                </div>
              </div>

              {selectedInvoice.customer && (
                <div className="bg-slate-900/60 border border-slate-700 p-2.5 rounded-lg text-xs flex justify-between items-center">
                  <div>
                    <span className="text-slate-400">العميل: </span>
                    <strong className="text-slate-100">{selectedInvoice.customer.name}</strong>
                    {selectedInvoice.customer.phone && <span className="text-slate-400 font-mono"> ({selectedInvoice.customer.phone})</span>}
                  </div>
                  {selectedInvoice.customer.prior_balance && (
                    <div className="text-slate-300">
                      الرصيد السابق: <strong>{selectedInvoice.customer.prior_balance} ج.م</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Items List */}
              <div className="border border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-2 px-3">الصنف</th>
                      <th className="py-2 px-3 text-center">الكمية</th>
                      <th className="py-2 px-3 text-center">سعر البيع</th>
                      <th className="py-2 px-3 text-left">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {selectedInvoice.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-700/20">
                        <td className="py-2 px-3 font-medium text-slate-100">
                          {item.product_name}
                          {item.item_type === 'external' && (
                            <span className="mr-1.5 text-[10px] text-purple-400 bg-purple-950 px-1 rounded border border-purple-800">
                              صنف خارجي
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">{item.quantity}</td>
                        <td className="py-2 px-3 text-center">{item.unit_sale_price} ج.م</td>
                        <td className="py-2 px-3 text-left font-bold text-emerald-400">{item.subtotal} ج.م</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals Breakdown */}
              <div className="bg-slate-900 p-3 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between text-slate-300 font-bold text-sm">
                  <span>إجمالي الفاتورة:</span>
                  <span className="text-amber-400">{selectedInvoice.total} ج.م</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>المدفوع:</span>
                  <span className="text-emerald-400 font-semibold">{selectedInvoice.paid_amount} ج.م</span>
                </div>
                {parseFloat(selectedInvoice.remaining_amount) > 0 && (
                  <div className="flex justify-between text-rose-400 font-semibold">
                    <span>المتبقي ديناً:</span>
                    <span>{selectedInvoice.remaining_amount} ج.م</span>
                  </div>
                )}
                {parseFloat(selectedInvoice.credit_amount) > 0 && (
                  <div className="flex justify-between text-cyan-400 font-semibold">
                    <span>رصيد دائن فائض:</span>
                    <span>{selectedInvoice.credit_amount} ج.م</span>
                  </div>
                )}
                {selectedInvoice.total_profit && (
                  <div className="flex justify-between border-t border-slate-800 pt-1 text-slate-400">
                    <span>إجمالي الربح (خاص بالإدارة):</span>
                    <span className="text-amber-300 font-bold">{selectedInvoice.total_profit} ج.م</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                <Button variant="secondary" onClick={handlePrint}>
                  🖨️ طباعة
                </Button>
                <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
                  إغلاق
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Dedicated Customer-Facing Printable Invoice Modal */}
      <InvoicePrintModal
        invoiceId={printInvoiceId ?? undefined}
        isOpen={printInvoiceId !== null}
        onClose={() => setPrintInvoiceId(null)}
      />
    </div>
  );
};
