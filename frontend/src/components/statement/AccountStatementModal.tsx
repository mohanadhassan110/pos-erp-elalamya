import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { customersApi } from '../../services/api/customersApi';
import { suppliersApi } from '../../services/api/suppliersApi';
import type { CustomerStatementResponse, SupplierStatementResponse } from '../../types/domain';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { Alert } from '../ui/Alert';
import { EmptyState } from '../ui/EmptyState';
import { Printer, X, Calendar, RefreshCw, FileText, Wallet, ArrowUpRight, ArrowDownLeft, Scale, ArrowUpDown } from 'lucide-react';

export interface AccountStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'customer' | 'supplier';
  entityId: number | null;
  entityName: string;
}

export const AccountStatementModal: React.FC<AccountStatementModalProps> = ({
  isOpen,
  onClose,
  entityType,
  entityId,
  entityName,
}) => {
  const [statement, setStatement] = useState<CustomerStatementResponse | SupplierStatementResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const fetchStatement = useCallback(
    async (from?: string, to?: string) => {
      if (!entityId) return;
      setIsLoading(true);
      setError(null);
      try {
        const params = {
          from_date: from || undefined,
          to_date: to || undefined,
        };
        if (entityType === 'customer') {
          const res = await customersApi.getStatement(entityId, params);
          const unwrapped = (res as any)?.data?.transactions ? (res as any).data : res;
          setStatement(unwrapped);
        } else {
          const res = await suppliersApi.getStatement(entityId, params);
          const unwrapped = (res as any)?.data?.transactions ? (res as any).data : res;
          setStatement(unwrapped);
        }
      } catch {
        setError('تعذر تحميل كشف الحساب، يرجى المحاولة مرة أخرى.');
      } finally {
        setIsLoading(false);
      }
    },
    [entityId, entityType]
  );

  const handleClose = useCallback(() => {
    setFromDate('');
    setToDate('');
    setStatement(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen && entityId) {
      queueMicrotask(() => {
        void fetchStatement();
      });
    }
  }, [isOpen, entityId, fetchStatement]);

  // Keyboard shortcut Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatement(fromDate, toDate);
  };

  const handleResetFilter = () => {
    setFromDate('');
    setToDate('');
    fetchStatement('', '');
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const printableRoot = document.getElementById('printable-root');

  const isCustomer = entityType === 'customer';
  const titleLabel = isCustomer ? 'كشف حساب عميل' : 'كشف حساب مورد';
  const debitHeader = isCustomer ? 'مدين (+ مبيعات)' : 'مدين (مسدد للمورد)';
  const creditHeader = isCustomer ? 'دائن (- دفعات)' : 'دائن (+ توريدات)';
  const balanceHeader = isCustomer ? 'رصيد المديونية' : 'المستحق للمورد';

  // Sort transactions (default newest-to-oldest)
  const sortedTransactions = useMemo(() => {
    if (!statement?.transactions) return [];
    if (sortOrder === 'desc') {
      return [...statement.transactions].reverse();
    }
    return statement.transactions;
  }, [statement?.transactions, sortOrder]);

  // Compute status pill for closing balance
  const closingNum = statement ? Number(statement.period_summary.closing_balance) : 0;
  let statusBadge = { label: 'الحساب خالص', bg: '#DCFCE7', color: '#166534' };
  if (statement) {
    if (isCustomer) {
      if (closingNum > 0) {
        statusBadge = { label: 'مطلوب من العميل', bg: '#FEE2E2', color: '#991B1B' };
      } else if (closingNum < 0) {
        statusBadge = { label: 'رصيد لصالح العميل', bg: '#DBEAFE', color: '#1E40AF' };
      }
    } else {
      if (closingNum > 0) {
        statusBadge = { label: 'مستحق للمورد', bg: '#FEF3C7', color: '#92400E' };
      } else if (closingNum < 0) {
        statusBadge = { label: 'مدفوع زيادة للمورد', bg: '#DBEAFE', color: '#1E40AF' };
      }
    }
  }

  return (
    <>
      {/* 1. Modal Dialog for Screen Display */}
      <div
        className="no-print"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(11, 18, 32, 0.75)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          overscrollBehavior: 'contain',
        }}
        dir="rtl"
        onClick={handleClose}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-surface, #ffffff)',
            borderRadius: 'var(--radius-lg, 8px)',
            boxShadow: 'var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.2))',
            width: '100%',
            maxWidth: '1120px',
            height: '92vh',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border-medium, #CBD5E1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.875rem 1.25rem',
              backgroundColor: 'var(--color-navy-950, #0B1220)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FileText size={22} style={{ color: 'var(--color-primary-400, #60A5FA)' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg, 18px)', fontWeight: 'var(--font-weight-bold, 700)' }}>
                  {titleLabel}: {entityName}
                </h2>
                <p style={{ margin: '0.15rem 0 0', fontSize: 'var(--font-size-xs, 12px)', color: '#94A3B8' }}>
                  تتبع تفصيلي لجميع الحركات المالية والأرصدة التراكمية
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePrint}
                disabled={isLoading || !statement}
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <Printer size={16} />
                طباعة كشف الحساب
              </Button>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94A3B8',
                  cursor: 'pointer',
                  padding: '0.375rem',
                  borderRadius: 'var(--radius-sm, 4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="إغلاق (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Compact Filter Bar */}
          <form
            onSubmit={handleApplyFilter}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>من:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    padding: '0.35rem 0.5rem',
                    border: '1px solid #CBD5E1',
                    borderRadius: '5px',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    color: '#1E293B',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>إلى:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    padding: '0.35rem 0.5rem',
                    border: '1px solid #CBD5E1',
                    borderRadius: '5px',
                    fontSize: '13px',
                    backgroundColor: '#ffffff',
                    color: '#1E293B',
                  }}
                />
              </div>
              <Button type="submit" variant="secondary" size="sm" isLoading={isLoading} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Calendar size={14} />
                تصفية
              </Button>
              {(fromDate || toDate) && (
                <Button type="button" variant="outline" size="sm" onClick={handleResetFilter} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <RefreshCw size={12} />
                  إلغاء التصفية
                </Button>
              )}
            </div>

            {statement && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>إجمالي حركات الفترة:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'var(--font-family-mono)' }}>
                    {statement.period_summary.transactions_count}
                  </strong>
                </div>

                {/* Sort Order Toggle */}
                <button
                  type="button"
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.3rem 0.65rem',
                    backgroundColor: sortOrder === 'desc' ? '#F0FDF4' : '#F8FAFC',
                    border: `1px solid ${sortOrder === 'desc' ? '#86EFAC' : '#CBD5E1'}`,
                    borderRadius: '5px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: sortOrder === 'desc' ? '#15803D' : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="انقر للتبديل بين الترتيب الزمني"
                >
                  <ArrowUpDown size={13} style={{ color: sortOrder === 'desc' ? '#16A34A' : '#64748B' }} />
                  <span>الترتيب: <strong>{sortOrder === 'desc' ? 'من الأحدث للأقدم ⬇' : 'من الأقدم للأحدث ⬆'}</strong></span>
                </button>
              </div>
            )}
          </form>

          {/* Modal Content Body */}
          <div
            style={{
              padding: '1rem 1.25rem',
              flex: '1 1 auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.875rem',
              overflow: 'hidden',
            }}
          >
            {error && <Alert type="error" message={error} />}

            {isLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem', flex: 1 }}>
                <Spinner size="lg" />
              </div>
            ) : statement ? (
              <>
                {/* Unified Executive KPI Strip */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {/* Item 1: Opening Balance */}
                  <div style={{ padding: '0.75rem 1rem', borderLeft: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#64748B', fontSize: '12px', fontWeight: 600 }}>
                      <Wallet size={14} style={{ color: '#94A3B8' }} />
                      <span>الرصيد الافتتاحي</span>
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: '#334155', marginTop: '0.375rem' }}>
                      {statement.opening_balance_formatted}
                    </div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '0.125rem' }}>
                      قبل بداية الفترة
                    </div>
                  </div>

                  {/* Item 2: Debits */}
                  <div style={{ padding: '0.75rem 1rem', borderLeft: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#1E40AF', fontSize: '12px', fontWeight: 600 }}>
                      <ArrowUpRight size={14} style={{ color: '#2563EB' }} />
                      <span>{isCustomer ? 'إجمالي المبيعات (مدين +)' : 'مسدد للمورد (مدين -)'}</span>
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: '#1D4ED8', marginTop: '0.375rem' }}>
                      {statement.period_summary.total_debits} ج.م
                    </div>
                    <div style={{ fontSize: '11px', color: '#60A5FA', marginTop: '0.125rem' }}>
                      {isCustomer ? 'قيمة فواتير الفترة' : 'مجموع الدفعات المسددة'}
                    </div>
                  </div>

                  {/* Item 3: Credits */}
                  <div style={{ padding: '0.75rem 1rem', borderLeft: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#15803D', fontSize: '12px', fontWeight: 600 }}>
                      <ArrowDownLeft size={14} style={{ color: '#16A34A' }} />
                      <span>{isCustomer ? 'إجمالي السداد (دائن -)' : 'توريدات بضاعة (دائن +)'}</span>
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: 700, fontFamily: 'var(--font-family-mono)', color: '#15803D', marginTop: '0.375rem' }}>
                      {statement.period_summary.total_credits} ج.م
                    </div>
                    <div style={{ fontSize: '11px', color: '#4ADE80', marginTop: '0.125rem' }}>
                      {isCustomer ? 'مجموع الدفعات والمردودات' : 'قيمة الفواتير والتوريدات'}
                    </div>
                  </div>

                  {/* Item 4: Closing Balance */}
                  <div style={{ padding: '0.75rem 1rem', backgroundColor: '#F8FAFC', borderRight: '3px solid #0B1220' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#0F172A', fontSize: '12px', fontWeight: 700 }}>
                        <Scale size={14} style={{ color: '#0B1220' }} />
                        <span>الرصيد الختامي الحالي</span>
                      </div>
                      <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '10px', fontWeight: 700, backgroundColor: statusBadge.bg, color: statusBadge.color }}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-family-mono)', color: '#0F172A', marginTop: '0.375rem' }}>
                      {statement.period_summary.closing_balance_formatted}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '0.125rem' }}>
                      صافي الذمة بعد كافة الحركات
                    </div>
                  </div>
                </div>

                {/* Transactions Table with Dedicated Scrollbar and Sticky Header */}
                {statement.transactions.length === 0 ? (
                  <EmptyState title="لا توجد حركات مسجلة" description="لا توجد أي معاملات مسجلة في كشف الحساب خلال الفترة المحددة." />
                ) : (
                  <div
                    style={{
                      flex: '1 1 auto',
                      minHeight: 0,
                      overflowY: 'auto',
                      overflowX: 'auto',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      overscrollBehavior: 'contain',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px', minWidth: '820px' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                        <tr style={{ backgroundColor: 'var(--color-navy-950, #0B1220)', color: '#F8FAFC' }}>
                          <th style={{ padding: '0.625rem 0.75rem', width: '3rem' }}>#</th>
                          <th style={{ padding: '0.625rem 0.75rem', width: '10.5rem' }}>
                            <button
                              type="button"
                              onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#F8FAFC',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontWeight: 700,
                                fontSize: '13px',
                              }}
                              title="انقر لتبديل الترتيب الزمني"
                            >
                              <span>التاريخ والوقت</span>
                              <ArrowUpDown size={12} style={{ opacity: 0.8 }} />
                              <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#93C5FD' }}>
                                ({sortOrder === 'desc' ? 'الأحدث أولاً' : 'الأقدم أولاً'})
                              </span>
                            </button>
                          </th>
                          <th style={{ padding: '0.625rem 0.75rem', width: '9rem' }}>نوع الحركة</th>
                          <th style={{ padding: '0.625rem 0.75rem', width: '9rem' }}>رقم المرجع</th>
                          <th style={{ padding: '0.625rem 0.75rem' }}>البيان / التفاصيل</th>
                          <th style={{ padding: '0.625rem 0.75rem', width: '7rem', textAlign: 'left' }}>{debitHeader}</th>
                          <th style={{ padding: '0.625rem 0.75rem', width: '7rem', textAlign: 'left' }}>{creditHeader}</th>
                          <th style={{ padding: '0.625rem 0.75rem', width: '8.5rem', textAlign: 'left' }}>{balanceHeader}</th>
                          <th style={{ padding: '0.625rem 0.75rem', width: '6.5rem' }}>المسؤول</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTransactions.map((tx, idx) => {
                          const hasDebit = Number(tx.debit) > 0;
                          const hasCredit = Number(tx.credit) > 0;
                          return (
                            <tr
                              key={tx.id}
                              style={{
                                borderBottom: '1px solid #E2E8F0',
                                backgroundColor: idx % 2 === 0 ? '#ffffff' : '#F8FAFC',
                              }}
                            >
                              <td style={{ padding: '0.625rem 0.75rem', color: '#94A3B8' }}>{idx + 1}</td>
                              <td style={{ padding: '0.625rem 0.75rem', direction: 'ltr', textAlign: 'right', fontFamily: 'var(--font-family-mono)', color: '#475569' }}>
                                {tx.date_formatted}
                              </td>
                              <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600 }}>
                                {tx.type_label}
                              </td>
                              <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-family-mono)', color: '#0284C7' }}>
                                {tx.reference_number || '—'}
                              </td>
                              <td style={{ padding: '0.625rem 0.75rem', color: '#334155' }}>
                                {tx.description || '—'}
                              </td>
                              <td
                                style={{
                                  padding: '0.625rem 0.75rem',
                                  textAlign: 'left',
                                  fontFamily: 'var(--font-family-mono)',
                                  fontWeight: hasDebit ? 700 : 400,
                                  color: hasDebit ? '#1D4ED8' : '#94A3B8',
                                }}
                              >
                                {hasDebit ? `${tx.debit}` : '—'}
                              </td>
                              <td
                                style={{
                                  padding: '0.625rem 0.75rem',
                                  textAlign: 'left',
                                  fontFamily: 'var(--font-family-mono)',
                                  fontWeight: hasCredit ? 700 : 400,
                                  color: hasCredit ? '#15803D' : '#94A3B8',
                                }}
                              >
                                {hasCredit ? `${tx.credit}` : '—'}
                              </td>
                              <td
                                style={{
                                  padding: '0.625rem 0.75rem',
                                  textAlign: 'left',
                                  fontFamily: 'var(--font-family-mono)',
                                  fontWeight: 700,
                                  color: '#0F172A',
                                }}
                              >
                                {tx.running_balance_formatted}
                              </td>
                              <td style={{ padding: '0.625rem 0.75rem', fontSize: '12px', color: '#64748B' }}>
                                {tx.creator_name || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* 2. Dedicated Portal for High-Quality A4 Print Layout */}
      {printableRoot && statement &&
        createPortal(
          <div className="a4-invoice-page" dir="rtl" style={{ color: '#000000', backgroundColor: '#ffffff' }}>
            {/* Showroom Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000000', paddingBottom: '8px', marginBottom: '12px' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>{statement.showroom.name}</h1>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#333333' }}>
                  {statement.showroom.address} | هاتف: {statement.showroom.phone}
                </p>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#000000' }}>
                  {titleLabel}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#555555' }}>
                  تاريخ الطباعة: {statement.generated_at}
                </p>
              </div>
            </div>

            {/* Account Information Box */}
            <div style={{ border: '1px solid #000000', borderRadius: '4px', padding: '10px', marginBottom: '12px', backgroundColor: '#f9f9f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '13px' }}>
                <div>
                  <strong>اسم الحساب: </strong> {entityName}
                </div>
                <div>
                  <strong>رقم الهاتف: </strong> {isCustomer ? (statement as CustomerStatementResponse).customer.phone || '—' : (statement as SupplierStatementResponse).supplier.phone || '—'}
                </div>
                <div>
                  <strong>الفترة: </strong>
                  {statement.period.from_date || statement.period.to_date
                    ? `من ${statement.period.from_date || 'البداية'} إلى ${statement.period.to_date || 'الآن'}`
                    : 'كافة المعاملات التاريخية'}
                </div>
                <div>
                  <strong>الترتيب: </strong> {sortOrder === 'desc' ? 'من الأحدث إلى الأقدم' : 'من الأقدم إلى الأحدث'}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #cccccc', fontSize: '13px' }}>
                <div>
                  <strong>الرصيد الافتتاحي: </strong> {statement.opening_balance_formatted}
                </div>
                <div>
                  <strong>إجمالي المدين: </strong> {statement.period_summary.total_debits} ج.م
                </div>
                <div>
                  <strong>إجمالي الدائن: </strong> {statement.period_summary.total_credits} ج.م
                </div>
                <div>
                  <strong>الرصيد الختامي: </strong>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{statement.period_summary.closing_balance_formatted}</span>
                </div>
              </div>
            </div>

            {/* Transactions Table for Print */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'right', marginBottom: '16px' }}>
              <thead>
                <tr style={{ backgroundColor: '#eeeeee', borderTop: '1px solid #000000', borderBottom: '1px solid #000000' }}>
                  <th style={{ padding: '6px 4px', width: '25px', textAlign: 'center' }}>#</th>
                  <th style={{ padding: '6px', width: '90px' }}>التاريخ</th>
                  <th style={{ padding: '6px', width: '90px' }}>نوع الحركة</th>
                  <th style={{ padding: '6px', width: '80px' }}>رقم المرجع</th>
                  <th style={{ padding: '6px' }}>البيان / التفاصيل</th>
                  <th style={{ padding: '6px', width: '70px', textAlign: 'left' }}>مدين</th>
                  <th style={{ padding: '6px', width: '70px', textAlign: 'left' }}>دائن</th>
                  <th style={{ padding: '6px', width: '80px', textAlign: 'left' }}>الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.map((tx, idx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #dddddd' }}>
                    <td style={{ padding: '5px 4px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '5px 6px', direction: 'ltr', textAlign: 'right' }}>{tx.date_formatted}</td>
                    <td style={{ padding: '5px 6px' }}>{tx.type_label}</td>
                    <td style={{ padding: '5px 6px' }}>{tx.reference_number || '—'}</td>
                    <td style={{ padding: '5px 6px' }}>{tx.description || '—'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'left' }}>{Number(tx.debit) > 0 ? tx.debit : '—'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'left' }}>{Number(tx.credit) > 0 ? tx.credit : '—'}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'left', fontWeight: 'bold' }}>{tx.running_balance_formatted}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #000000', fontWeight: 'bold', backgroundColor: '#f5f5f5' }}>
                  <td colSpan={5} style={{ padding: '8px', textAlign: 'right' }}>الإجماليات وصافي الحركة خلال الفترة:</td>
                  <td style={{ padding: '8px', textAlign: 'left' }}>{statement.period_summary.total_debits}</td>
                  <td style={{ padding: '8px', textAlign: 'left' }}>{statement.period_summary.total_credits}</td>
                  <td style={{ padding: '8px', textAlign: 'left', fontSize: '13px' }}>{statement.period_summary.closing_balance_formatted}</td>
                </tr>
              </tfoot>
            </table>

            {/* Signatures */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', padding: '0 20px', fontSize: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0 }}>توقيع المحاسب / المبيعات</p>
                <div style={{ marginTop: '35px', borderBottom: '1px dotted #000000', width: '150px' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0 }}>توقيع المستلم / المعتمد</p>
                <div style={{ marginTop: '35px', borderBottom: '1px dotted #000000', width: '150px' }} />
              </div>
            </div>
          </div>,
          printableRoot
        )}
    </>
  );
};
