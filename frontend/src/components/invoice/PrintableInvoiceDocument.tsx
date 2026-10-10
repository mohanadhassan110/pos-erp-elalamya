import React from 'react';
import type { PrintableInvoice } from '../../types/domain';
import { Code128Barcode } from '../barcode/Code128Barcode';
import { formatCurrency, formatQuantity } from '../../utils/formatters';
import logoBlack from '../../assets/brand/logo-black.png';

export interface PrintableInvoiceDocumentProps {
  invoice: PrintableInvoice;
  format: 'thermal' | 'a4';
  isScreenPreview?: boolean;
}

export const PrintableInvoiceDocument: React.FC<PrintableInvoiceDocumentProps> = ({
  invoice,
  format,
  isScreenPreview = false,
}) => {
  const isWholesaleWithCustomer = invoice.is_wholesale && invoice.customer !== null;

  // Render 80mm Thermal Receipt (Primary Format)
  if (format === 'thermal') {
    return (
      <div
        className="thermal-80mm-page"
        style={{
          width: '72mm',
          maxWidth: '72mm',
          margin: isScreenPreview ? '0 auto' : undefined,
          padding: '3mm 2mm',
          fontFamily: 'var(--font-family-base, "Cairo", sans-serif)',
          fontSize: '11px',
          lineHeight: 1.35,
          color: '#000000',
          backgroundColor: '#FFFFFF',
          direction: 'rtl',
          textAlign: 'right',
          boxSizing: 'border-box',
        }}
      >
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '6px' }}>
          <img
            src={logoBlack}
            alt="شعار المعرض"
            style={{
              maxWidth: '44mm',
              height: 'auto',
              margin: '0 auto 4px',
              display: 'block',
              filter: 'grayscale(100%) contrast(150%)',
            }}
          />
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#000000' }}>
            {invoice.showroom?.name || 'معرض العالمية للمفروشات'}
          </div>

          {/* Tagline / Subtitle (Omitted if empty) */}
          {invoice.showroom?.subtitle && (
            <div style={{ fontSize: '10px', color: '#222222', marginTop: '1px' }}>
              {invoice.showroom.subtitle}
            </div>
          )}

          {/* Phones (Omitted if empty) */}
          {invoice.showroom?.phone && (
            <div style={{ fontSize: '10px', direction: 'ltr', marginTop: '2px', fontWeight: 600 }}>
              {invoice.showroom.phone}
            </div>
          )}

          {/* Address (Omitted if empty) */}
          {invoice.showroom?.address && (
            <div style={{ fontSize: '9.5px', color: '#222222', marginTop: '2px', lineHeight: 1.25 }}>
              {invoice.showroom.address}
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ borderBottom: '1px dashed #000000', margin: '4px 0' }} />

        {/* Invoice Metadata */}
        <div style={{ fontSize: '10.5px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>رقم الفاتورة:</span>
            <span style={{ fontWeight: 700, direction: 'ltr' }}>{invoice.invoice_number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>التاريخ والوقت:</span>
            <span style={{ direction: 'ltr' }}>{invoice.issue_date || '-'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>نوع الفاتورة:</span>
            <span style={{ fontWeight: 600 }}>{invoice.sale_type_label || (invoice.is_wholesale ? 'جملة' : 'قطاعي')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>الكاشير:</span>
            <span>{invoice.cashier_name || 'كاشير المعرض'}</span>
          </div>

          {/* Customer (if any) */}
          {invoice.customer && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dotted #ccc', paddingTop: '2px' }}>
              <span>العميل:</span>
              <span style={{ fontWeight: 600 }}>{invoice.customer.name}</span>
            </div>
          )}
        </div>

        {/* Separator */}
        <div style={{ borderBottom: '1px solid #000000', margin: '5px 0 3px' }} />

        {/* Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000000', textAlign: 'right' }}>
              <th style={{ padding: '2px 0', textAlign: 'right' }}>الصنف</th>
              <th style={{ padding: '2px 0', textAlign: 'center', width: '22px' }}>ك</th>
              <th style={{ padding: '2px 0', textAlign: 'left', width: '42px' }}>السعر</th>
              <th style={{ padding: '2px 0', textAlign: 'left', width: '46px' }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px dotted #e0e0e0' }}>
                <td style={{ padding: '3px 0', verticalAlign: 'top', wordBreak: 'break-word', maxWidth: '30mm' }}>
                  <div style={{ lineHeight: 1.2 }}>{item.product_name}</div>
                </td>
                <td style={{ padding: '3px 0', textAlign: 'center', verticalAlign: 'top', fontWeight: 600 }}>
                  {formatQuantity(item.quantity)}
                </td>
                <td style={{ padding: '3px 0', textAlign: 'left', verticalAlign: 'top', direction: 'ltr' }}>
                  {item.unit_price}
                </td>
                <td style={{ padding: '3px 0', textAlign: 'left', verticalAlign: 'top', fontWeight: 700, direction: 'ltr' }}>
                  {item.subtotal}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Separator */}
        <div style={{ borderBottom: '1px solid #000000', margin: '4px 0' }} />

        {/* Totals Section */}
        <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>إجمالي الأصناف ({invoice.total_units} قطعة):</span>
            <span style={{ direction: 'ltr' }}>{invoice.subtotal}</span>
          </div>

          {parseFloat(invoice.discount_amount || '0') > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c00' }}>
              <span>قيمة الخصم:</span>
              <span style={{ direction: 'ltr' }}>-{invoice.discount_amount}</span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '13px',
              fontWeight: 800,
              borderTop: '1px solid #000000',
              borderBottom: '1px solid #000000',
              padding: '3px 0',
              margin: '2px 0',
            }}
          >
            <span>صافي الفاتورة:</span>
            <span style={{ direction: 'ltr' }}>{formatCurrency(invoice.total)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>المدفوع نقداً:</span>
            <span style={{ fontWeight: 700, direction: 'ltr' }}>{formatCurrency(invoice.paid_amount)}</span>
          </div>

          {parseFloat(invoice.remaining_amount || '0') > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>المتبقي (آجل):</span>
              <span style={{ direction: 'ltr' }}>{formatCurrency(invoice.remaining_amount)}</span>
            </div>
          )}
        </div>

        {/* Wholesale Customer Ledger Balances Section (ONLY wholesale + registered customer) */}
        {isWholesaleWithCustomer && invoice.customer && (
          <div
            style={{
              marginTop: '5px',
              padding: '3px 4px',
              border: '1px dashed #000000',
              borderRadius: '2px',
              fontSize: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <div style={{ fontWeight: 700, textAlign: 'center', marginBottom: '1px' }}>
              كشف حساب العميل
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>الرصيد السابق:</span>
              <span style={{ direction: 'ltr' }}>{formatCurrency(invoice.customer.prior_balance)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>حركة هذه الفاتورة:</span>
              <span style={{ direction: 'ltr' }}>+{formatCurrency(parseFloat(invoice.total) - parseFloat(invoice.paid_amount))}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 700,
                borderTop: '1px solid #000',
                paddingTop: '2px',
              }}
            >
              <span>الرصيد النهائي:</span>
              <span style={{ direction: 'ltr' }}>{formatCurrency(invoice.customer.resulting_balance)}</span>
            </div>
            {invoice.customer.balance_status && (
              <div style={{ textAlign: 'center', fontSize: '9.5px', color: '#333' }}>
                ({invoice.customer.balance_status})
              </div>
            )}
          </div>
        )}

        {/* Code128 Barcode of Invoice Number */}
        <div style={{ marginTop: '8px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}>
          <Code128Barcode value={invoice.invoice_number} height={30} moduleWidth={1.05} fontSize={9} />
        </div>

        {/* Return Policy (Omitted if empty) */}
        {invoice.showroom?.return_policy && (
          <div
            style={{
              fontSize: '8.5px',
              textAlign: 'center',
              color: '#333333',
              marginTop: '6px',
              lineHeight: 1.25,
              borderTop: '1px dotted #ccc',
              paddingTop: '3px',
            }}
          >
            {invoice.showroom.return_policy}
          </div>
        )}

        {/* Thank You Note (Omitted if empty) */}
        {invoice.showroom?.footer_note && (
          <div style={{ fontSize: '9.5px', textAlign: 'center', fontWeight: 700, marginTop: '4px' }}>
            {invoice.showroom.footer_note}
          </div>
        )}

        {/* Physical Paper Cutter Feed Space (~15mm) */}
        <div style={{ height: '14mm' }} />
      </div>
    );
  }

  // Render A4 Formal Invoice Format (Secondary Format)
  return (
    <div
      className="a4-invoice-page"
      style={{
        width: isScreenPreview ? '210mm' : '100%',
        maxWidth: '210mm',
        minHeight: isScreenPreview ? '297mm' : undefined,
        margin: isScreenPreview ? '0 auto' : undefined,
        padding: '12mm 15mm',
        fontFamily: 'var(--font-family-base, "Cairo", sans-serif)',
        fontSize: '13px',
        color: '#000000',
        backgroundColor: '#FFFFFF',
        direction: 'rtl',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #000000', paddingBottom: '10px', marginBottom: '12px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#000000' }}>
            {invoice.showroom?.name || 'معرض العالمية للمفروشات'}
          </h1>
          {invoice.showroom?.subtitle && (
            <div style={{ fontSize: '13px', color: '#444', marginTop: '2px' }}>
              {invoice.showroom.subtitle}
            </div>
          )}
          {invoice.showroom?.address && (
            <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
              {invoice.showroom.address}
            </div>
          )}
          {invoice.showroom?.phone && (
            <div style={{ fontSize: '12px', direction: 'ltr', textAlign: 'right', marginTop: '2px', fontWeight: 600 }}>
              {invoice.showroom.phone}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <img
            src={logoBlack}
            alt="شعار المعرض"
            style={{ width: '60mm', height: 'auto', marginBottom: '4px' }}
          />
          <div style={{ fontSize: '16px', fontWeight: 800 }}>
            فاتورة مبيعات {invoice.is_wholesale ? 'جملة' : 'قطاعي'}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, direction: 'ltr' }}>
            #{invoice.invoice_number}
          </div>
        </div>
      </div>

      {/* Metadata Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: '#F8FAFC', padding: '10px 12px', borderRadius: '4px', border: '1px solid #E2E8F0', marginBottom: '14px', fontSize: '12px' }}>
        <div>
          <div><strong>تاريخ الإصدار:</strong> {invoice.issue_date || '-'}</div>
          <div><strong>الكاشير:</strong> {invoice.cashier_name || 'كاشير المعرض'}</div>
          <div><strong>الحالة:</strong> {invoice.status_label || 'معتمدة'}</div>
        </div>
        <div>
          {invoice.customer ? (
            <>
              <div><strong>العميل:</strong> {invoice.customer.name}</div>
              {invoice.customer.phone && <div><strong>هاتف العميل:</strong> {invoice.customer.phone}</div>}
              {invoice.customer.address && <div><strong>العنوان:</strong> {invoice.customer.address}</div>}
            </>
          ) : (
            <div><strong>نوع العميل:</strong> عميل قطاعي نقدي</div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '14px', fontSize: '12px' }}>
        <thead>
          <tr style={{ backgroundColor: '#0B1220', color: '#FFFFFF', textAlign: 'right' }}>
            <th style={{ padding: '6px 8px', width: '35px', textAlign: 'center' }}>م</th>
            <th style={{ padding: '6px 8px' }}>الصنف</th>
            <th style={{ padding: '6px 8px', width: '80px', textAlign: 'center' }}>الكمية</th>
            <th style={{ padding: '6px 8px', width: '100px', textAlign: 'left' }}>سعر الوحدة</th>
            <th style={{ padding: '6px 8px', width: '110px', textAlign: 'left' }}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
              <td style={{ padding: '6px 8px', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ padding: '6px 8px' }}>
                <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                {item.barcode && <div style={{ fontSize: '10px', color: '#666', direction: 'ltr', textAlign: 'right' }}>{item.barcode}</div>}
              </td>
              <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 600 }}>{formatQuantity(item.quantity)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'left', direction: 'ltr' }}>{formatCurrency(item.unit_price, false)}</td>
              <td style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, direction: 'ltr' }}>{formatCurrency(item.subtotal, false)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: '16px' }}>
        {/* Left: Wholesale Balance or Barcode */}
        <div style={{ flex: 1 }}>
          {isWholesaleWithCustomer && invoice.customer ? (
            <div style={{ border: '1px solid #CBD5E1', borderRadius: '4px', padding: '10px', backgroundColor: '#F8FAFC' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '6px', borderBottom: '1px solid #CBD5E1', paddingBottom: '4px' }}>
                كشف وتصفية حساب العميل
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>رصيد سابق:</span>
                <span style={{ fontWeight: 600, direction: 'ltr' }}>{formatCurrency(invoice.customer.prior_balance)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>صافي قيمة هذه الفاتورة:</span>
                <span style={{ fontWeight: 600, direction: 'ltr' }}>{formatCurrency(invoice.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>المسدد من الفاتورة:</span>
                <span style={{ fontWeight: 600, direction: 'ltr' }}>{formatCurrency(invoice.paid_amount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid #CBD5E1', paddingTop: '4px', fontSize: '13px' }}>
                <span>الرصيد المتبقي النهائي:</span>
                <span style={{ direction: 'ltr' }}>{formatCurrency(invoice.customer.resulting_balance)}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '10px' }}>
              <Code128Barcode value={invoice.invoice_number} height={36} moduleWidth={1.3} fontSize={11} />
            </div>
          )}
        </div>

        {/* Right: Invoice Financial Totals */}
        <div style={{ width: '220px', border: '1px solid #000000', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #E2E8F0' }}>
            <span>الإجمالي:</span>
            <span style={{ direction: 'ltr' }}>{formatCurrency(invoice.subtotal)}</span>
          </div>
          {parseFloat(invoice.discount_amount || '0') > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #E2E8F0', color: '#c00' }}>
              <span>الخصم:</span>
              <span style={{ direction: 'ltr' }}>-{formatCurrency(invoice.discount_amount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', backgroundColor: '#0B1220', color: '#FFFFFF', fontWeight: 800, fontSize: '14px' }}>
            <span>الصافي المطلوب:</span>
            <span style={{ direction: 'ltr' }}>{formatCurrency(invoice.total)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', borderBottom: '1px solid #E2E8F0' }}>
            <span>المدفوع:</span>
            <span style={{ fontWeight: 700, direction: 'ltr' }}>{formatCurrency(invoice.paid_amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontWeight: 700 }}>
            <span>المتبقي:</span>
            <span style={{ direction: 'ltr' }}>{formatCurrency(invoice.remaining_amount)}</span>
          </div>
        </div>
      </div>

      {/* Footer Notes & Policy */}
      <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '8px', fontSize: '11px', color: '#444' }}>
        {invoice.showroom?.return_policy && (
          <div style={{ marginBottom: '4px' }}>
            <strong>سياسة الاسترجاع:</strong> {invoice.showroom.return_policy}
          </div>
        )}
        {invoice.showroom?.footer_note && (
          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '12px', marginTop: '6px', color: '#000' }}>
            {invoice.showroom.footer_note}
          </div>
        )}
      </div>
    </div>
  );
};
