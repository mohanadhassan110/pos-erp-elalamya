import React, { useState, useEffect } from 'react';
import { invoicesApi } from '../../services/api/invoicesApi';
import type { PrintableInvoice, Invoice } from '../../types/domain';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';
import { Code128Barcode } from '../barcode/Code128Barcode';

export interface InvoicePrintModalProps {
  invoiceId?: number;
  initialInvoice?: Invoice | PrintableInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  defaultFormat?: 'a4' | 'thermal';
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  invoiceId,
  initialInvoice,
  isOpen,
  onClose,
  defaultFormat = 'a4',
}) => {
  const [format, setFormat] = useState<'a4' | 'thermal'>(defaultFormat);
  const [invoice, setInvoice] = useState<PrintableInvoice | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;
    const loadData = async () => {
      if (invoiceId) {
        setIsLoading(true);
        setError(null);
        try {
          const data = await invoicesApi.getPrintable(invoiceId);
          if (isMounted) setInvoice(data);
        } catch {
          if (isMounted) setError('تعذر تحميل بيانات طباعة الفاتورة، يرجى المحاولة لاحقاً.');
        } finally {
          if (isMounted) setIsLoading(false);
        }
      } else if (initialInvoice) {
        if ('showroom' in initialInvoice && 'issue_date_arabic' in initialInvoice) {
          if (isMounted) setInvoice(initialInvoice as PrintableInvoice);
        } else if (initialInvoice.id) {
          setIsLoading(true);
          setError(null);
          try {
            const data = await invoicesApi.getPrintable(initialInvoice.id);
            if (isMounted) setInvoice(data);
          } catch {
            if (isMounted) setError('تعذر تحميل بيانات طباعة الفاتورة، يرجى المحاولة لاحقاً.');
          } finally {
            if (isMounted) setIsLoading(false);
          }
        }
      }
    };

    const timer = setTimeout(loadData, 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, invoiceId, initialInvoice]);

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    setInvoice(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static"
      dir="rtl"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:border-none print:shadow-none print:w-full print:bg-white">
        {/* Top Control Bar - Hidden during printing */}
        <div className="no-print p-3 sm:p-4 bg-slate-800/90 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200 text-sm">🖨️ معاينة طباعة الفاتورة</span>
            {invoice && (
              <span className="font-mono text-amber-400 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                {invoice.invoice_number}
              </span>
            )}
          </div>

          {/* Format Selector */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setFormat('a4')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                format === 'a4'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📄 مقاس A4 رسمي
            </button>
            <button
              type="button"
              onClick={() => setFormat('thermal')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                format === 'thermal'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🧾 إيصال حراري 80 مم
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handlePrint} disabled={isLoading || !invoice}>
              🖨️ طباعة الآن
            </Button>
            <Button variant="outline" size="sm" onClick={handleClose}>
              إغلاق
            </Button>
          </div>
        </div>

        {/* Content Viewport */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-950/50 print:p-0 print:bg-white print:overflow-visible">
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Spinner size="lg" />
              <span>جاري تجهيز وثيقة الطباعة المعتمدة...</span>
            </div>
          )}

          {error && (
            <div className="p-4">
              <Alert type="error" message={error} />
            </div>
          )}

          {invoice && !isLoading && (
            <div className="flex justify-center">
              {/* Printable Document Container */}
              <div
                id="printable-invoice"
                className={`bg-white text-slate-900 print:shadow-none print:border-none shadow-lg ${
                  format === 'a4'
                    ? 'w-full max-w-[210mm] p-6 sm:p-8 rounded-lg border border-slate-200 min-h-[297mm]'
                    : 'w-[80mm] max-w-[80mm] mx-auto p-3 text-[11px] rounded border border-slate-200 font-sans print:w-[80mm] print:max-w-[80mm] print:m-auto print:p-2'
                }`}
                style={{
                  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Cairo", sans-serif',
                }}
              >
                {/* ================================================= */}
                {/* FORMAT 1: A4 Standard Invoice                     */}
                {/* ================================================= */}
                {format === 'a4' ? (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="border-b-2 border-slate-800 pb-3 flex justify-between items-start">
                      <div>
                        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                          {invoice.showroom.name}
                        </h1>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                          {invoice.showroom.subtitle}
                        </p>
                        <div className="text-[11px] text-slate-500 mt-1 flex gap-3">
                          <span>الهاتف: {invoice.showroom.phone}</span>
                          <span>العنوان: {invoice.showroom.address}</span>
                        </div>
                      </div>

                      <div className="text-left font-mono">
                        <div className="text-xs font-bold text-slate-700">فاتورة مبيعات</div>
                        <div className="text-base font-extrabold text-slate-950 mt-0.5">
                          #{invoice.invoice_number}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {invoice.issue_date_arabic}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded ${
                              invoice.is_wholesale
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            }`}
                          >
                            {invoice.sale_type_label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Customer & Sale Metadata */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">بيانات العميل:</span>
                        <div className="font-bold text-slate-900 text-sm mt-0.5">
                          {invoice.customer ? invoice.customer.name : 'زبون نقدي (قطاعي)'}
                        </div>
                        {invoice.customer && (
                          <div className="text-[11px] text-slate-600 mt-0.5 space-y-0.5">
                            {invoice.customer.phone && <div>الهاتف: {invoice.customer.phone}</div>}
                            {invoice.customer.address && <div>العنوان: {invoice.customer.address}</div>}
                          </div>
                        )}
                      </div>

                      <div className="text-left">
                        <span className="text-slate-500 block text-[11px]">مسؤول البيع / الكاشير:</span>
                        <div className="font-semibold text-slate-800 mt-0.5">{invoice.cashier_name}</div>
                        {invoice.customer && invoice.is_wholesale && (
                          <div className="mt-1.5 pt-1.5 border-t border-slate-200 space-y-0.5 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-600">الرصيد السابق:</span>
                              <span className="font-mono font-bold text-slate-900">
                                {invoice.customer.prior_balance_formatted}
                              </span>
                            </div>
                            <div className="flex justify-between font-bold">
                              <span className="text-slate-800">الرصيد بعد الفاتورة:</span>
                              <span className="font-mono text-slate-950">
                                {invoice.customer.resulting_balance_formatted}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Items Table - Strict Confidentiality Guaranteed */}
                    <div className="border border-slate-300 rounded overflow-hidden">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold">
                            <th className="py-2 px-3 text-center w-10">#</th>
                            <th className="py-2 px-3">بيان الصنف</th>
                            <th className="py-2 px-3 text-center w-24">الباركود</th>
                            <th className="py-2 px-3 text-center w-16">الكمية</th>
                            <th className="py-2 px-3 text-left w-24">سعر الوحدة</th>
                            <th className="py-2 px-3 text-left w-28">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {invoice.items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 font-semibold text-slate-900">{item.product_name}</td>
                              <td className="py-2 px-3 text-center font-mono text-slate-600">
                                {item.barcode || '—'}
                              </td>
                              <td className="py-2 px-3 text-center font-bold font-mono text-slate-900">
                                {item.quantity}
                              </td>
                              <td className="py-2 px-3 text-left font-mono text-slate-800">
                                {item.unit_price} ج.م
                              </td>
                              <td className="py-2 px-3 text-left font-mono font-bold text-slate-950">
                                {item.subtotal} ج.م
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals & Payments Summary */}
                    <div className="grid grid-cols-2 gap-4 items-start pt-2">
                      {/* Payments Method Box */}
                      <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs space-y-1.5">
                        <div className="font-bold text-slate-800 text-[11px] border-b border-slate-200 pb-1">
                          طرق السداد المسجلة:
                        </div>
                        {invoice.payments.length > 0 ? (
                          invoice.payments.map((p) => (
                            <div key={p.id} className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-600">{p.payment_method_name}:</span>
                              <span className="font-mono font-bold text-slate-900">{p.amount} ج.م</span>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-500 text-[11px]">لم تسجل دفعات مسددة (آجل بالكامل)</div>
                        )}

                        {invoice.notes && (
                          <div className="pt-2 border-t border-slate-200 text-[11px]">
                            <span className="text-slate-500 font-semibold">ملاحظات:</span>
                            <p className="text-slate-700 mt-0.5">{invoice.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Financial Totals */}
                      <div className="bg-slate-50 p-3 rounded border border-slate-300 text-xs space-y-1.5">
                        <div className="flex justify-between text-slate-700">
                          <span>إجمالي البضاعة:</span>
                          <span className="font-mono font-semibold">{invoice.subtotal} ج.م</span>
                        </div>

                        {parseFloat(invoice.discount_amount) > 0 && (
                          <div className="flex justify-between text-rose-600">
                            <span>الخصم الممنوح:</span>
                            <span className="font-mono font-bold">-{invoice.discount_amount} ج.م</span>
                          </div>
                        )}

                        <div className="flex justify-between font-extrabold text-sm text-slate-950 border-t border-slate-300 pt-1.5">
                          <span>صافي الفاتورة المستحق:</span>
                          <span className="font-mono text-base">{invoice.total} ج.م</span>
                        </div>

                        <div className="flex justify-between text-emerald-700 font-bold border-t border-dashed border-slate-300 pt-1">
                          <span>المبلغ المسدد:</span>
                          <span className="font-mono">{invoice.paid_amount} ج.م</span>
                        </div>

                        {parseFloat(invoice.remaining_amount) > 0 && (
                          <div className="flex justify-between text-rose-700 font-bold">
                            <span>المتبقي ديناً:</span>
                            <span className="font-mono">{invoice.remaining_amount} ج.م</span>
                          </div>
                        )}

                        {parseFloat(invoice.credit_amount) > 0 && (
                          <div className="flex justify-between text-blue-700 font-bold">
                            <span>رصيد دائن فائض للعميل:</span>
                            <span className="font-mono">{invoice.credit_amount} ج.م</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Policy & Signatures */}
                    <div className="border-t border-slate-300 pt-3 mt-6 text-[10px] text-slate-600 space-y-2">
                      <p className="text-center font-medium leading-relaxed">
                        {invoice.showroom.return_policy}
                      </p>
                      <div className="flex justify-between pt-4 text-xs font-semibold text-slate-800">
                        <div className="text-center">
                          <span className="block mb-6">توقيع المستلم / العميل:</span>
                          <span>............................................</span>
                        </div>
                        <div className="text-center">
                          <span className="block mb-6">ختم وتوقيع المعرض:</span>
                          <span className="font-bold text-slate-900">{invoice.showroom.name}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ================================================= */
                  /* FORMAT 2: 80mm Thermal Receipt                    */
                  /* ================================================= */
                  <div className="space-y-2 text-right">
                    {/* Thermal Header */}
                    <div className="text-center pb-2 border-b border-dashed border-slate-400">
                      <h2 className="text-sm font-extrabold text-slate-950">{invoice.showroom.name}</h2>
                      <p className="text-[10px] text-slate-600">{invoice.showroom.subtitle}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">هاتف: {invoice.showroom.phone}</p>
                    </div>

                    {/* Receipt Meta */}
                    <div className="text-[10px] space-y-0.5 py-1 border-b border-dashed border-slate-300">
                      <div className="flex justify-between font-mono font-bold">
                        <span>رقم الفاتورة:</span>
                        <span>{invoice.invoice_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>التاريخ:</span>
                        <span>{invoice.issue_date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>نوع البيع:</span>
                        <span>{invoice.sale_type_label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>الكاشير:</span>
                        <span>{invoice.cashier_name}</span>
                      </div>
                      {invoice.customer && (
                        <div className="flex justify-between font-semibold text-slate-900 pt-0.5">
                          <span>العميل:</span>
                          <span>{invoice.customer.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Compact Items List */}
                    <table className="w-full text-[10px] my-1 border-collapse">
                      <thead>
                        <tr className="border-b border-slate-400 text-slate-700 font-bold">
                          <th className="py-1 text-right">الصنف</th>
                          <th className="py-1 text-center">الكمية</th>
                          <th className="py-1 text-left">السعر</th>
                          <th className="py-1 text-left">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {invoice.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-1 font-semibold">{item.product_name}</td>
                            <td className="py-1 text-center font-mono">{item.quantity}</td>
                            <td className="py-1 text-left font-mono">{item.unit_price}</td>
                            <td className="py-1 text-left font-mono font-bold">{item.subtotal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Thermal Totals */}
                    <div className="border-t border-dashed border-slate-400 pt-1 text-[10px] space-y-0.5">
                      <div className="flex justify-between font-bold text-xs">
                        <span>الإجمالي:</span>
                        <span className="font-mono">{invoice.total} ج.م</span>
                      </div>
                      <div className="flex justify-between">
                        <span>المسدد:</span>
                        <span className="font-mono">{invoice.paid_amount} ج.م</span>
                      </div>

                      {parseFloat(invoice.remaining_amount) > 0 && (
                        <div className="flex justify-between font-bold text-rose-700">
                          <span>المتبقي (دين):</span>
                          <span className="font-mono">{invoice.remaining_amount} ج.م</span>
                        </div>
                      )}

                      {parseFloat(invoice.credit_amount) > 0 && (
                        <div className="flex justify-between font-bold text-blue-700">
                          <span>فائض دائن:</span>
                          <span className="font-mono">{invoice.credit_amount} ج.م</span>
                        </div>
                      )}

                      {invoice.customer && invoice.is_wholesale && (
                        <div className="border-t border-dashed border-slate-300 pt-1 mt-1 space-y-0.5 text-[9px]">
                          <div className="flex justify-between text-slate-600">
                            <span>الرصيد السابق:</span>
                            <span className="font-mono">{invoice.customer.prior_balance_formatted}</span>
                          </div>
                          <div className="flex justify-between font-bold text-slate-900">
                            <span>الرصيد النهائي:</span>
                            <span className="font-mono">{invoice.customer.resulting_balance_formatted}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Barcode representation for scanner return processing */}
                    <div className="py-2 flex flex-col items-center justify-center border-t border-slate-300 mt-2">
                      <Code128Barcode
                        value={invoice.invoice_number}
                        height={32}
                        moduleWidth={1.2}
                        fontSize={10}
                      />
                    </div>

                    {/* Thermal Footer */}
                    <div className="text-center text-[8px] text-slate-500 pt-1 border-t border-dashed border-slate-300 leading-tight">
                      <p>البضاعة المباعة ترد وتستبدل خلال 14 يوماً بأصل الفاتورة بحالتها الأصلية</p>
                      <p className="mt-0.5 font-bold">{invoice.showroom.footer_note}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
