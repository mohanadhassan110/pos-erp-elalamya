import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { SalesReturn } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Code128Barcode } from '../../components/barcode/Code128Barcode';
import { formatCurrency, formatQuantity } from '../../utils/formatters';
import { Printer, X, Receipt, FileText } from 'lucide-react';

export interface ReturnPrintModalProps {
  salesReturn: SalesReturn | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ReturnPrintModal: React.FC<ReturnPrintModalProps> = ({
  salesReturn,
  isOpen,
  onClose,
}) => {
  const [format, setFormat] = useState<'thermal' | 'a4'>(() => {
    const saved = localStorage.getItem('alalamya_print_format');
    return saved === 'a4' ? 'a4' : 'thermal';
  });

  if (!isOpen || !salesReturn) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleFormatChange = (newFormat: 'thermal' | 'a4') => {
    setFormat(newFormat);
    localStorage.setItem('alalamya_print_format', newFormat);
  };

  const totalReturnNum = parseFloat(salesReturn.total_return_amount || '0');

  const content = (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-return-root,
          #printable-return-root * {
            visibility: visible !important;
          }
          #printable-return-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: ${format === 'thermal' ? '80mm auto' : 'A4 portrait'};
            margin: ${format === 'thermal' ? '2mm' : '10mm'};
          }
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="no-print"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(2px)',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        {/* Modal Window */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: format === 'thermal' ? '460px' : '780px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            direction: 'rtl',
          }}
        >
          {/* Header Toolbar */}
          <div
            style={{
              padding: '0.85rem 1.25rem',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Receipt size={20} color="#B45309" />
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                طباعة إيصال مرتجع ({salesReturn.return_number})
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {/* Format Toggle */}
              <div
                style={{
                  display: 'flex',
                  backgroundColor: '#E2E8F0',
                  borderRadius: '6px',
                  padding: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleFormatChange('thermal')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: format === 'thermal' ? 700 : 500,
                    backgroundColor: format === 'thermal' ? '#FFFFFF' : 'transparent',
                    color: format === 'thermal' ? '#0F172A' : '#64748B',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Receipt size={13} />
                  حراري (80 مم)
                </button>
                <button
                  type="button"
                  onClick={() => handleFormatChange('a4')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: format === 'a4' ? 700 : 500,
                    backgroundColor: format === 'a4' ? '#FFFFFF' : 'transparent',
                    color: format === 'a4' ? '#0F172A' : '#64748B',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <FileText size={13} />
                  A4
                </button>
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={handlePrint}
                icon={<Printer size={15} />}
                autoFocus
              >
                طباعة
              </Button>

              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Preview Viewport */}
          <div
            style={{
              padding: '1.25rem',
              overflowY: 'auto',
              backgroundColor: '#F1F5F9',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              id="printable-return-root"
              style={{
                width: format === 'thermal' ? '72mm' : '100%',
                maxWidth: format === 'thermal' ? '72mm' : '700px',
                backgroundColor: '#FFFFFF',
                padding: format === 'thermal' ? '4mm 2mm' : '15mm',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                color: '#000000',
                fontSize: format === 'thermal' ? '11px' : '13px',
                lineHeight: 1.35,
                direction: 'rtl',
                textAlign: 'right',
                boxSizing: 'border-box',
                fontFamily: 'var(--font-family-base, "Cairo", sans-serif)',
              }}
            >
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 800, fontSize: format === 'thermal' ? '16px' : '20px' }}>
                  معرض العالمية للمفروشات
                </div>
                <div style={{ fontSize: format === 'thermal' ? '12px' : '14px', fontWeight: 700, color: '#B45309', marginTop: '2px' }}>
                  *** إيصال إرجاع بضاعة (مرتجع مبيعات) ***
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000000', margin: '4px 0' }} />

              {/* Metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: format === 'thermal' ? '11px' : '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>رقم إشعار المرتجع:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{salesReturn.return_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>الفاتورة الأصلية:</span>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{salesReturn.invoice_number}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>تاريخ المرتجع:</span>
                  <span style={{ direction: 'ltr' }}>{salesReturn.created_at_formatted || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>العميل:</span>
                  <span style={{ fontWeight: 600 }}>{salesReturn.customer_name || 'عميل نقدي / عام'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>طريقة التسوية:</span>
                  <span style={{ fontWeight: 700 }}>{salesReturn.resolution_label}</span>
                </div>
                {salesReturn.creator_name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>الموظف / الكاشير:</span>
                    <span>{salesReturn.creator_name}</span>
                  </div>
                )}
              </div>

              <div style={{ borderBottom: '1px solid #000000', margin: '6px 0 4px' }} />

              {/* Section A: Returned Items (Negative Values) */}
              <div style={{ marginTop: '4px' }}>
                <div style={{ fontWeight: 800, fontSize: format === 'thermal' ? '11px' : '13px', color: '#B91C1C', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>[القسم أ] الأصناف المرتجعة المستلمة:</span>
                  <span style={{ fontSize: '10px', fontWeight: 600 }}>(قيم سالبة مستردة)</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: format === 'thermal' ? '10.5px' : '12.5px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #000000', backgroundColor: '#F8FAFC' }}>
                      <th style={{ textAlign: 'right', padding: '3px 2px' }}>الصنف المرتجع</th>
                      <th style={{ textAlign: 'center', padding: '3px 2px', width: '35px' }}>الكمية</th>
                      <th style={{ textAlign: 'left', padding: '3px 2px', width: '50px' }}>السعر</th>
                      <th style={{ textAlign: 'left', padding: '3px 2px', width: '65px' }}>القيمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(salesReturn.items || []).map((it) => {
                      const isDamaged = it.item_condition === 'damaged';
                      return (
                        <tr key={it.id} style={{ borderBottom: '1px dotted #ccc' }}>
                          <td style={{ padding: '3px 2px' }}>
                            <div>{it.product_name}</div>
                            <div style={{ fontSize: '9px', color: isDamaged ? '#DC2626' : '#15803D' }}>
                              الحالة: {isDamaged ? '⚠️ تالف / عيب مصنعي' : '✓ سليم (صالح للبيع)'}
                              {it.return_reason ? ` — سبب: ${it.return_reason}` : ''}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '3px 2px', fontWeight: 600 }}>{formatQuantity(it.quantity)}</td>
                          <td style={{ textAlign: 'left', padding: '3px 2px', direction: 'ltr' }}>{parseFloat(it.unit_sale_price).toFixed(2)}</td>
                          <td style={{ textAlign: 'left', padding: '3px 2px', fontWeight: 700, direction: 'ltr', color: '#B91C1C' }}>
                            -{parseFloat(it.subtotal).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Section B: Replacement Items (Positive Values) */}
              {salesReturn.replacement_items && salesReturn.replacement_items.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: format === 'thermal' ? '11px' : '13px', color: '#15803D', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>[القسم ب] الأصناف البديلة المسلمة:</span>
                    <span style={{ fontSize: '10px', fontWeight: 600 }}>(فاتورة بديلة #{salesReturn.replacement_invoice_number || salesReturn.replacement_invoice_id})</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: format === 'thermal' ? '10.5px' : '12.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #000000', backgroundColor: '#F8FAFC' }}>
                        <th style={{ textAlign: 'right', padding: '3px 2px' }}>الصنف الجديد</th>
                        <th style={{ textAlign: 'center', padding: '3px 2px', width: '35px' }}>الكمية</th>
                        <th style={{ textAlign: 'left', padding: '3px 2px', width: '50px' }}>السعر</th>
                        <th style={{ textAlign: 'left', padding: '3px 2px', width: '65px' }}>الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesReturn.replacement_items.map((rit) => (
                        <tr key={rit.id} style={{ borderBottom: '1px dotted #ccc' }}>
                          <td style={{ padding: '3px 2px' }}>{rit.product_name}</td>
                          <td style={{ textAlign: 'center', padding: '3px 2px', fontWeight: 600 }}>{formatQuantity(rit.quantity)}</td>
                          <td style={{ textAlign: 'left', padding: '3px 2px', direction: 'ltr' }}>{parseFloat(rit.unit_sale_price).toFixed(2)}</td>
                          <td style={{ textAlign: 'left', padding: '3px 2px', fontWeight: 700, direction: 'ltr', color: '#15803D' }}>
                            +{parseFloat(rit.subtotal).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ borderBottom: '1px solid #000000', margin: '6px 0' }} />

              {/* Section C: Financial Summary & Settlement Method */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ fontWeight: 800, fontSize: format === 'thermal' ? '11px' : '13px', marginBottom: '2px' }}>
                  [القسم ج] الملخص المالي والتسوية:
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <span>إجمالي قيمة المرتجع (أ):</span>
                  <span style={{ direction: 'ltr', color: '#B91C1C', fontWeight: 700 }}>
                    -{formatCurrency(totalReturnNum)}
                  </span>
                </div>

                {salesReturn.replacement_value && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                    <span>إجمالي قيمة الاستبدال (ب):</span>
                    <span style={{ direction: 'ltr', color: '#15803D', fontWeight: 700 }}>
                      +{formatCurrency(salesReturn.replacement_value)}
                    </span>
                  </div>
                )}

                {parseFloat(salesReturn.difference_paid_amount || salesReturn.difference_amount || '0') > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: format === 'thermal' ? '12px' : '14px', fontWeight: 800, backgroundColor: '#FEF3C7', padding: '3px 4px', borderRadius: '4px' }}>
                    <span>فارق مستحق ومحصل من العميل:</span>
                    <span style={{ direction: 'ltr' }}>{formatCurrency(salesReturn.difference_paid_amount || salesReturn.difference_amount)}</span>
                  </div>
                ) : salesReturn.resolution === 'customer_account_credit' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#EFF6FF', padding: '3px 4px', borderRadius: '4px' }}>
                    <span>رصيد دائن مضاف لحساب العميل:</span>
                    <span style={{ direction: 'ltr' }}>{formatCurrency(totalReturnNum)}</span>
                  </div>
                ) : salesReturn.resolution === 'refund_cash' ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, backgroundColor: '#F0FDF4', padding: '3px 4px', borderRadius: '4px' }}>
                    <span>المبلغ المسترد نقداً للعميل:</span>
                    <span style={{ direction: 'ltr' }}>{formatCurrency(totalReturnNum)}</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700 }}>
                    <span>صافي الفارق:</span>
                    <span>استبدال متطابق القيمة (0.00 ج.م)</span>
                  </div>
                )}
              </div>

              {salesReturn.notes && (
                <div style={{ marginTop: '6px', fontSize: '10.5px', color: '#444' }}>
                  <strong>ملاحظات:</strong> {salesReturn.notes}
                </div>
              )}

              <div style={{ borderBottom: '1px dashed #000000', margin: '6px 0' }} />

              {/* Barcode & Footer */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
                <Code128Barcode value={salesReturn.return_number} moduleWidth={format === 'thermal' ? 1.5 : 2} height={format === 'thermal' ? 32 : 44} />
                <div style={{ fontSize: '9.5px', color: '#555', textAlign: 'center', marginTop: '2px' }}>
                  تم استلام الأصناف المرتجعة وتحديث المخزون والحسابات بنجاح.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
};
