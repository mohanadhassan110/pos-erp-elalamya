import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { invoicesApi } from '../../services/api/invoicesApi';
import type { PrintableInvoice, Invoice } from '../../types/domain';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';
import { PrintableInvoiceDocument } from './PrintableInvoiceDocument';
import { Printer, X, Receipt, FileText } from 'lucide-react';

export interface InvoicePrintModalProps {
  invoiceId?: number;
  initialInvoice?: Invoice | PrintableInvoice | null;
  isOpen: boolean;
  onClose: () => void;
  defaultFormat?: 'thermal' | 'a4';
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  invoiceId,
  initialInvoice,
  isOpen,
  onClose,
  defaultFormat,
}) => {
  // Read saved print format from localStorage or default to thermal
  const [format, setFormat] = useState<'thermal' | 'a4'>(() => {
    if (defaultFormat) return defaultFormat;
    const saved = localStorage.getItem('alalamya_print_format');
    return saved === 'a4' ? 'a4' : 'thermal';
  });

  const [invoice, setInvoice] = useState<PrintableInvoice | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Switch format and save preference
  const handleFormatChange = (newFormat: 'thermal' | 'a4') => {
    setFormat(newFormat);
    localStorage.setItem('alalamya_print_format', newFormat);
  };

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadData = async () => {
      if (invoiceId) {
        setIsLoading(true);
        setError(null);
        try {
          const data = await invoicesApi.getPrintable(invoiceId);
          if (isMounted) setInvoice(data);
        } catch {
          if (isMounted) setError('تعذر تحميل بيانات الفاتورة للطباعة');
        } finally {
          if (isMounted) setIsLoading(false);
        }
      } else if (initialInvoice) {
        if ('showroom' in initialInvoice && 'items' in initialInvoice) {
          if (isMounted) setInvoice(initialInvoice as PrintableInvoice);
        } else if (initialInvoice.id) {
          setIsLoading(true);
          setError(null);
          try {
            const data = await invoicesApi.getPrintable(initialInvoice.id);
            if (isMounted) setInvoice(data);
          } catch {
            if (isMounted) setError('تعذر تحميل بيانات الفاتورة للطباعة');
          } finally {
            if (isMounted) setIsLoading(false);
          }
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, invoiceId, initialInvoice]);

  // Keyboard shortcut: Esc to close, Enter/P to print
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const printableRoot = document.getElementById('printable-root');

  return (
    <>
      {/* 1. Modal Overlay for Screen Preview & Controls */}
      <div
        className="no-print"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(11, 18, 32, 0.75)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
        dir="rtl"
      >
        <div
          style={{
            backgroundColor: 'var(--bg-surface, #ffffff)',
            borderRadius: 'var(--radius-lg, 8px)',
            boxShadow: 'var(--shadow-lg)',
            width: '100%',
            maxWidth: format === 'thermal' ? '500px' : '840px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border-medium)',
          }}
        >
          {/* Modal Header */}
          <div
            style={{
              padding: '0.875rem 1.25rem',
              backgroundColor: 'var(--color-navy-950, #0B1220)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <Printer size={20} />
              <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md, 16px)' }}>
                معاينة وطباعة الفاتورة
              </span>
              {invoice && (
                <span
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                  }}
                >
                  {invoice.invoice_number}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#CBD5E1',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
              }}
              title="إغلاق (Esc)"
              aria-label="إغلاق النافذة"
            >
              <X size={20} />
            </button>
          </div>

          {/* Modal Toolbar: Format Switcher & Print Button */}
          <div
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: 'var(--bg-surface-subtle, #F1F5F9)',
              borderBottom: '1px solid var(--border-subtle, #E2E8F0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            {/* Format Switcher */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>
                مقاس الطباعة:
              </span>
              <button
                type="button"
                onClick={() => handleFormatChange('thermal')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: format === 'thermal' ? 'var(--color-navy-950)' : 'var(--border-medium)',
                  backgroundColor: format === 'thermal' ? 'var(--color-navy-950)' : '#FFFFFF',
                  color: format === 'thermal' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: format === 'thermal' ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <Receipt size={16} />
                <span>إيصال حراري (80 مم)</span>
              </button>

              <button
                type="button"
                onClick={() => handleFormatChange('a4')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: format === 'a4' ? 'var(--color-navy-950)' : 'var(--border-medium)',
                  backgroundColor: format === 'a4' ? 'var(--color-navy-950)' : '#FFFFFF',
                  color: format === 'a4' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: format === 'a4' ? 700 : 500,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                <FileText size={16} />
                <span>فاتورة A4 رسمية</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <Button variant="secondary" size="md" onClick={onClose}>
                إغلاق
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handlePrint}
                disabled={isLoading || !invoice}
                icon={<Printer size={18} />}
              >
                طباعة الفاتورة الآن
              </Button>
            </div>
          </div>

          {/* Modal Preview Area (WYSIWYG) */}
          <div
            style={{
              padding: '1.25rem',
              overflowY: 'auto',
              backgroundColor: '#E2E8F0',
              display: 'flex',
              justifyContent: 'center',
              flex: 1,
            }}
          >
            {isLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <Spinner size="lg" />
                <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)' }}>جاري تجهيز الفاتورة للطباعة...</p>
              </div>
            ) : error ? (
              <div style={{ width: '100%', maxWidth: '400px' }}>
                <Alert type="error" message={error} />
              </div>
            ) : invoice ? (
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  padding: format === 'thermal' ? '0' : '10px',
                }}
              >
                <PrintableInvoiceDocument invoice={invoice} format={format} isScreenPreview={true} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* 2. React Portal to #printable-root for Real Print Engine */}
      {printableRoot && invoice && createPortal(
        <PrintableInvoiceDocument invoice={invoice} format={format} isScreenPreview={false} />,
        printableRoot
      )}
    </>
  );
};
