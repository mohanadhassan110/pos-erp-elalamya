import React, { useState, useEffect, useCallback } from 'react';
import { reportsApi } from '../../services/api/reportsApi';
import type {
  ReportPeriodPreset,
  ReportOverviewData,
  SalesReportResponseData,
  ExpensesReportData,
  CustomerReportData,
  SupplierReportData,
  InventoryReportData,
  PaymentsReportData,
  ReportInvoicesHistoryData,
  ReportInvoiceHistoryItem,
  ReportReturnsHistoryData,
} from '../../types/domain';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { MoneyDisplay } from '../../components/ui/MoneyDisplay';
import { useAuth } from '../../app/providers/useAuth';
import {
  BarChart3,
  Lock,
  RefreshCw,
  TrendingUp,
  Tag,
  Wallet,
  Users,
  Package,
  Coins,
  FileText,
  RotateCcw,
} from 'lucide-react';

type ReportTab = 'overview' | 'sales' | 'expenses' | 'ledgers' | 'inventory' | 'cash' | 'history';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [periodPreset, setPeriodPreset] = useState<ReportPeriodPreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // States for each report section
  const [overviewData, setOverviewData] = useState<ReportOverviewData | null>(null);
  const [salesData, setSalesData] = useState<SalesReportResponseData | null>(null);
  const [expensesData, setExpensesData] = useState<ExpensesReportData | null>(null);
  const [customerData, setCustomerData] = useState<CustomerReportData | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierReportData | null>(null);
  const [inventoryData, setInventoryData] = useState<InventoryReportData | null>(null);
  const [paymentsData, setPaymentsData] = useState<PaymentsReportData | null>(null);
  const [invoicesHistory, setInvoicesHistory] = useState<ReportInvoicesHistoryData | null>(null);
  const [returnsHistory, setReturnsHistory] = useState<ReportReturnsHistoryData | null>(null);

  // Secondary sub-filters
  const [customerFilter, setCustomerFilter] = useState<'all' | 'debtors' | 'creditors'>('all');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [supplierFilter, setSupplierFilter] = useState<'all' | 'with_payable'>('all');
  const [supplierSearch, setSupplierSearch] = useState<string>('');
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [inventoryStatus, setInventoryStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [historySubTab, setHistorySubTab] = useState<'invoices' | 'returns'>('invoices');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('');
  const [invoiceSaleTypeFilter, setInvoiceSaleTypeFilter] = useState<string>('');
  const [invoiceDocumentTypeFilter, setInvoiceDocumentTypeFilter] = useState<string>('');
  const [invoiceSearch, setInvoiceSearch] = useState<string>('');
  const [invoiceSortBy, setInvoiceSortBy] = useState<string>('created_at');
  const [invoiceSortDir, setInvoiceSortDir] = useState<'desc' | 'asc'>('desc');
  const [selectedInvoiceDrilldown, setSelectedInvoiceDrilldown] = useState<ReportInvoiceHistoryItem | null>(null);
  const [invoiceHistoryPage, setInvoiceHistoryPage] = useState<number>(1);
  const [returnResolutionFilter, setReturnResolutionFilter] = useState<string>('');
  const [returnHistoryPage, setReturnHistoryPage] = useState<number>(1);

  // Auth & Password Gate states
  const { isOwner } = useAuth();
  const [isReportsLocked, setIsReportsLocked] = useState<boolean>(false);
  const [unlockPassword, setUnlockPassword] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isSubmittingUnlock, setIsSubmittingUnlock] = useState<boolean>(false);
  const [fetchTrigger, setFetchTrigger] = useState<number>(0);

  // Loading & Error states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getFilterParams = useCallback(() => {
    if (periodPreset === 'custom') {
      return {
        range_preset: 'custom' as const,
        start_date: customStartDate || undefined,
        end_date: customEndDate || undefined,
      };
    }
    return {
      range_preset: periodPreset,
    };
  }, [periodPreset, customStartDate, customEndDate]);

  useEffect(() => {
    let active = true;
    const params = getFilterParams();

    const runFetch = async () => {
      if (activeTab === 'overview') {
        const data = await reportsApi.overview(params);
        if (active) setOverviewData(data);
      } else if (activeTab === 'sales') {
        const data = await reportsApi.sales(params);
        if (active) setSalesData(data);
      } else if (activeTab === 'expenses') {
        const data = await reportsApi.expenses(params);
        if (active) setExpensesData(data);
      } else if (activeTab === 'ledgers') {
        const [cust, supp] = await Promise.all([
          reportsApi.customers({
            filter: customerFilter === 'all' ? undefined : customerFilter,
            search: customerSearch.trim() || undefined,
          }),
          reportsApi.suppliers({
            filter: supplierFilter === 'all' ? undefined : supplierFilter,
            search: supplierSearch.trim() || undefined,
          }),
        ]);
        if (active) {
          setCustomerData(cust);
          setSupplierData(supp);
        }
      } else if (activeTab === 'inventory') {
        const data = await reportsApi.inventory({
          search: inventorySearch.trim() || undefined,
          status: inventoryStatus === 'all' ? undefined : inventoryStatus,
        });
        if (active) setInventoryData(data);
      } else if (activeTab === 'cash') {
        const data = await reportsApi.payments(params);
        if (active) setPaymentsData(data);
      } else if (activeTab === 'history') {
        if (historySubTab === 'invoices') {
          const data = await reportsApi.invoicesHistory({
            status: invoiceStatusFilter || undefined,
            sale_type: invoiceSaleTypeFilter || undefined,
            document_type: invoiceDocumentTypeFilter || undefined,
            search: invoiceSearch.trim() || undefined,
            sort_by: invoiceSortBy || undefined,
            sort_direction: invoiceSortDir || undefined,
            range_preset: periodPreset === 'custom' ? undefined : periodPreset,
            from_date: periodPreset === 'custom' ? customStartDate : undefined,
            to_date: periodPreset === 'custom' ? customEndDate : undefined,
            page: invoiceHistoryPage,
            per_page: 15,
          });
          if (active) setInvoicesHistory(data);
        } else {
          const data = await reportsApi.returnsHistory({
            resolution: returnResolutionFilter || undefined,
            range_preset: periodPreset === 'custom' ? undefined : periodPreset,
            from_date: periodPreset === 'custom' ? customStartDate : undefined,
            to_date: periodPreset === 'custom' ? customEndDate : undefined,
            page: returnHistoryPage,
            per_page: 15,
          });
          if (active) setReturnsHistory(data);
        }
      }
    };

    runFetch()
      .catch((err: unknown) => {
        if (active) {
          const error = err as { message?: string; code?: string };
          if (error?.code === 'REPORTS_LOCKED') {
            setIsReportsLocked(true);
            setErrorMessage(null);
          } else {
            setErrorMessage(error?.message || 'حدث خطأ أثناء جلب بيانات التقرير.');
          }
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    activeTab,
    getFilterParams,
    customerFilter,
    customerSearch,
    supplierFilter,
    supplierSearch,
    inventorySearch,
    inventoryStatus,
    historySubTab,
    invoiceStatusFilter,
    invoiceSaleTypeFilter,
    invoiceDocumentTypeFilter,
    invoiceSearch,
    invoiceSortBy,
    invoiceSortDir,
    invoiceHistoryPage,
    returnResolutionFilter,
    returnHistoryPage,
    periodPreset,
    customStartDate,
    customEndDate,
    fetchTrigger,
  ]);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword.trim()) return;

    setIsSubmittingUnlock(true);
    setUnlockError(null);

    try {
      await reportsApi.unlock(unlockPassword);
      setIsReportsLocked(false);
      setUnlockPassword('');
      setErrorMessage(null);
      setIsLoading(true);
      setFetchTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setUnlockError(error?.message || 'كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmittingUnlock(false);
    }
  };

  const handleLockReports = async () => {
    try {
      await reportsApi.lock();
    } catch {
      // Ignored
    } finally {
      setIsReportsLocked(true);
      setOverviewData(null);
      setSalesData(null);
      setExpensesData(null);
      setCustomerData(null);
      setSupplierData(null);
      setInventoryData(null);
      setPaymentsData(null);
      setInvoicesHistory(null);
      setReturnsHistory(null);
    }
  };

  const handleRefresh = () => {
    // Trigger re-render / re-fetch
    setErrorMessage(null);
    setIsLoading(true);
    const params = getFilterParams();

    const runFetch = async () => {
      if (activeTab === 'overview') {
        setOverviewData(await reportsApi.overview(params));
      } else if (activeTab === 'sales') {
        setSalesData(await reportsApi.sales(params));
      } else if (activeTab === 'expenses') {
        setExpensesData(await reportsApi.expenses(params));
      } else if (activeTab === 'ledgers') {
        const [cust, supp] = await Promise.all([
          reportsApi.customers({
            filter: customerFilter === 'all' ? undefined : customerFilter,
            search: customerSearch.trim() || undefined,
          }),
          reportsApi.suppliers({
            filter: supplierFilter === 'all' ? undefined : supplierFilter,
            search: supplierSearch.trim() || undefined,
          }),
        ]);
        setCustomerData(cust);
        setSupplierData(supp);
      } else if (activeTab === 'inventory') {
        setInventoryData(await reportsApi.inventory({
          search: inventorySearch.trim() || undefined,
          status: inventoryStatus === 'all' ? undefined : inventoryStatus,
        }));
      } else if (activeTab === 'cash') {
        setPaymentsData(await reportsApi.payments(params));
      } else if (activeTab === 'history') {
        if (historySubTab === 'invoices') {
          setInvoicesHistory(await reportsApi.invoicesHistory({
            status: invoiceStatusFilter || undefined,
            sale_type: invoiceSaleTypeFilter || undefined,
            document_type: invoiceDocumentTypeFilter || undefined,
            search: invoiceSearch.trim() || undefined,
            sort_by: invoiceSortBy || undefined,
            sort_direction: invoiceSortDir || undefined,
            range_preset: periodPreset === 'custom' ? undefined : periodPreset,
            from_date: periodPreset === 'custom' ? customStartDate : undefined,
            to_date: periodPreset === 'custom' ? customEndDate : undefined,
            page: invoiceHistoryPage,
            per_page: 15,
          }));
        } else {
          setReturnsHistory(await reportsApi.returnsHistory({
            resolution: returnResolutionFilter || undefined,
            range_preset: periodPreset === 'custom' ? undefined : periodPreset,
            from_date: periodPreset === 'custom' ? customStartDate : undefined,
            to_date: periodPreset === 'custom' ? customEndDate : undefined,
            page: returnHistoryPage,
            per_page: 15,
          }));
        }
      }
    };

    runFetch()
      .catch((err: unknown) => {
        const error = err as { message?: string };
        setErrorMessage(error?.message || 'حدث خطأ أثناء جلب بيانات التقرير.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      {/* Header and Period Filter */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          backgroundColor: '#ffffff',
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={24} style={{ color: 'var(--color-navy-800)' }} />
            التقارير المالية والتشغيلية
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            معرض العالمية للمفروشات — مؤشرات الأداء، الأرباح المحققة، حركة النقدية والمخزون
          </p>
        </div>

        {/* Date Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-app)', padding: '0.25rem', borderRadius: 'var(--radius-sm)' }}>
            <button
              type="button"
              onClick={() => setPeriodPreset('today')}
              style={{
                padding: '0.375rem 0.75rem',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: periodPreset === 'today' ? 'bold' : 'normal',
                backgroundColor: periodPreset === 'today' ? '#ffffff' : 'transparent',
                color: periodPreset === 'today' ? 'var(--color-primary-600)' : 'var(--text-main)',
                boxShadow: periodPreset === 'today' ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
              }}
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('this_week')}
              style={{
                padding: '0.375rem 0.75rem',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: periodPreset === 'this_week' ? 'bold' : 'normal',
                backgroundColor: periodPreset === 'this_week' ? '#ffffff' : 'transparent',
                color: periodPreset === 'this_week' ? 'var(--color-primary-600)' : 'var(--text-main)',
                boxShadow: periodPreset === 'this_week' ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
              }}
            >
              هذا الأسبوع
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('this_month')}
              style={{
                padding: '0.375rem 0.75rem',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: periodPreset === 'this_month' ? 'bold' : 'normal',
                backgroundColor: periodPreset === 'this_month' ? '#ffffff' : 'transparent',
                color: periodPreset === 'this_month' ? 'var(--color-primary-600)' : 'var(--text-main)',
                boxShadow: periodPreset === 'this_month' ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
              }}
            >
              هذا الشهر
            </button>
            <button
              type="button"
              onClick={() => setPeriodPreset('custom')}
              style={{
                padding: '0.375rem 0.75rem',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: periodPreset === 'custom' ? 'bold' : 'normal',
                backgroundColor: periodPreset === 'custom' ? '#ffffff' : 'transparent',
                color: periodPreset === 'custom' ? 'var(--color-primary-600)' : 'var(--text-main)',
                boxShadow: periodPreset === 'custom' ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
              }}
            >
              فترة مخصصة
            </button>
          </div>

          {periodPreset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  padding: '0.375rem 0.5rem',
                  fontSize: 'var(--font-size-xs)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>إلى</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: '0.375rem 0.5rem',
                  fontSize: 'var(--font-size-xs)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                }}
              />
            </div>
          )}

          {!isOwner && !isReportsLocked && (
            <Button variant="outline" size="sm" onClick={handleLockReports}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Lock size={14} /> قفل التقارير
              </span>
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={isLoading || isReportsLocked}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <RefreshCw size={14} /> تحديث
            </span>
          </Button>
        </div>
      </div>

      {isReportsLocked ? (
        <div style={{ maxWidth: '30rem', margin: '3rem auto', width: '100%' }}>
          <Card title="قسم التقارير مقفل بكلمة مرور">
            <form onSubmit={handleUnlockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', lineHeight: 1.6, margin: 0 }}>
                قسم التقارير يحتوي على مؤشرات الأداء والأرباح. يتطلب هذا القسم إدخال كلمة المرور المصرح بها لإلغاء القفل مؤقتاً.
              </p>

              {unlockError && <Alert type="error" message={unlockError} />}

              <div>
                <label style={{ display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', marginBottom: '0.375rem' }}>
                  كلمة مرور التقارير
                </label>
                <Input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور..."
                  disabled={isSubmittingUnlock}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <Button type="submit" variant="primary" disabled={isSubmittingUnlock || !unlockPassword.trim()}>
                  {isSubmittingUnlock ? 'جاري التحقق...' : 'إلغاء القفل ومتابعة'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : (
        <>
          {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '0.5rem',
          borderBottom: '2px solid var(--border-color)',
          paddingBottom: '0.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: activeTab === 'overview' ? 'bold' : 'normal',
            backgroundColor: activeTab === 'overview' ? 'var(--color-primary-600)' : '#ffffff',
            color: activeTab === 'overview' ? '#ffffff' : 'var(--text-main)',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <TrendingUp size={16} />
          <span>نظرة عامة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: activeTab === 'sales' ? 'bold' : 'normal',
            backgroundColor: activeTab === 'sales' ? 'var(--color-navy-800)' : '#ffffff',
            color: activeTab === 'sales' ? '#ffffff' : 'var(--text-main)',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <Tag size={16} />
          <span>المبيعات والأرباح</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: activeTab === 'expenses' ? 'bold' : 'normal',
            backgroundColor: activeTab === 'expenses' ? 'var(--color-navy-800)' : '#ffffff',
            color: activeTab === 'expenses' ? '#ffffff' : 'var(--text-main)',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <Wallet size={16} />
          <span>المصروفات التشغيلية</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledgers')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: activeTab === 'ledgers' ? 'bold' : 'normal',
            backgroundColor: activeTab === 'ledgers' ? 'var(--color-navy-800)' : '#ffffff',
            color: activeTab === 'ledgers' ? '#ffffff' : 'var(--text-main)',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <Users size={16} />
          <span>العملاء والموردين</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: activeTab === 'inventory' ? 'bold' : 'normal',
            backgroundColor: activeTab === 'inventory' ? 'var(--color-navy-800)' : '#ffffff',
            color: activeTab === 'inventory' ? '#ffffff' : 'var(--text-main)',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <Package size={16} />
          <span>تقييم المخزون</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cash')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: activeTab === 'cash' ? 'bold' : 'normal',
            backgroundColor: activeTab === 'cash' ? 'var(--color-navy-800)' : '#ffffff',
            color: activeTab === 'cash' ? '#ffffff' : 'var(--text-main)',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <Coins size={16} />
          <span>حركة وطرق الدفع</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          style={{
            padding: '0.625rem 1rem',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: activeTab === 'history' ? 'bold' : 'normal',
            backgroundColor: activeTab === 'history' ? 'var(--color-navy-800)' : '#ffffff',
            color: activeTab === 'history' ? '#ffffff' : 'var(--text-main)',
            boxShadow: 'var(--shadow-xs)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <FileText size={16} />
          <span>سجل الفواتير والمرتجع</span>
        </button>
      </div>

      {/* Error state */}
      {errorMessage && <Alert type="error" message={errorMessage} />}

      {/* Loading state */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4rem 0' }}>
          <Spinner size="lg" />
          <span style={{ marginRight: '1rem', color: 'var(--text-muted)' }}>جاري معالجة بيانات التقرير...</span>
        </div>
      )}

      {/* Content based on Active Tab */}
      {!isLoading && (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && overviewData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Core Financial KPIs */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                }}
              >
                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>إجمالي المبيعات (Gross Sales)</div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.gross_sales} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    عدد الفواتير المرحلة: {overviewData.invoices_count}
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--color-danger-700)', fontSize: 'var(--font-size-xs)' }}>إجمالي المرتجعات (Returns)</div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.total_returns} colored />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    مردودات مبيعات معتمدة
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--color-primary-700)', fontSize: 'var(--font-size-xs)' }}>صافي المبيعات (Net Sales)</div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.net_sales} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    المبيعات بعد خصم المرتجعات
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--color-success-700)', fontSize: 'var(--font-size-xs)' }}>
                    صافي الربح الإجمالي المحقق
                  </div>
                  <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.net_realized_gross_profit} colored />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    هامش الربح: {overviewData.profit_margin_percentage}%
                  </div>
                </Card>
              </div>

              {/* Expenses and Net Operating Result */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                }}
              >
                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>المصروفات العامة للمعرض</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.general_expenses} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    مصروفات تشغيلية (إيجار، عمالة، بوفيه...)
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                    شراء منتجات خارجية (Policy C)
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.external_product_expenses} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    محسوبة ضمن تكلفة البضاعة المباعة مباشرة
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>
                    صافي النتيجة التشغيلية
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.net_operating_result} colored />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    الربح الإجمالي المحقق - المصروفات العامة
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>صافي حركة النقدية</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.net_cash_movement} colored />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    المقبوضات الفعلية - المبالغ المستردة
                  </div>
                </Card>
              </div>

              {/* Balances and Assets */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                }}
              >
                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>مديونيات العملاء المستحقة</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.total_customer_debts} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    عدد العملاء المدينين: {overviewData.debtors_count}
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>مستحقات الموردين القائمة</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.total_supplier_payables} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    عدد الموردين المستحق لهم: {overviewData.with_payable_suppliers_count}
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>تقييم المخزون بسعر الشراء</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={overviewData.total_inventory_valuation} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    إجمالي القطع: {overviewData.total_stock_units} قطعة
                  </div>
                </Card>
              </div>

              {/* Policy & Invariant Transparency Note */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.25rem' }}>
                  محددات وقواعد الاحتساب المالية المعتمدة:
                </div>
                <ul style={{ margin: 0, paddingRight: '1.25rem' }}>
                  <li>أرباح المبيعات وتكلفة البضاعة المباعة تعتمد على لقطة التكلفة التاريخية المحفوظة مع كل بند فاتورة ولا تتغير بتغير سعر شراء المنتج الحالي.</li>
                  <li>أرصدة العملاء والموردين مستخرجة حصرياً من دفاتر الأستاذ (Customer & Supplier Ledgers).</li>
                  <li>طبقاً لسياسة (Policy C)، مصروفات شراء المنتجات الخارجية تُحتسب ضمن تكلفة البضاعة المباعة ولا يتم خصمها مرتين من المصروفات العامة للمعرض.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: SALES & PROFIT */}
          {activeTab === 'sales' && salesData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                }}
              >
                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>مبيعات القطاعي</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={salesData.sales_summary.retail_sales} />
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>مبيعات الجملة</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={salesData.sales_summary.wholesale_sales} />
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>مبيعات الاستبدال (فواتير بديلة)</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={salesData.sales_summary.replacement_sales} />
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>إجمالي القطع المباعة</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    {salesData.sales_summary.items_sold_count} قطعة
                  </div>
                </Card>
              </div>

              {/* Returns Analysis */}
              <Card title="تفاصيل المرتجعات وقرارات التسوية">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>استرداد نقدي (Refund Cash):</span>
                    <div style={{ fontWeight: 'bold' }}>
                      <MoneyDisplay amount={salesData.sales_summary.cash_refunds_total} />
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>رصيد حساب عميل (Account Credit):</span>
                    <div style={{ fontWeight: 'bold' }}>
                      <MoneyDisplay amount={salesData.sales_summary.account_credits_total} />
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>استبدال بضاعة (Exchanges):</span>
                    <div style={{ fontWeight: 'bold' }}>
                      <MoneyDisplay amount={salesData.sales_summary.exchanges_total} />
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>فوارق استبدال محصلة:</span>
                    <div style={{ fontWeight: 'bold' }}>
                      <MoneyDisplay amount={salesData.sales_summary.difference_collected_total} />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Realized Profit Reconciliation */}
              <Card title="تسوية الأرباح وتكلفة البضاعة المباعة">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                      <th style={{ padding: '0.75rem' }}>البيان</th>
                      <th style={{ padding: '0.75rem' }}>إجمالي المبيعات</th>
                      <th style={{ padding: '0.75rem' }}>المردودات والمرتجعات</th>
                      <th style={{ padding: '0.75rem' }}>الصافي المحقق</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>الإيرادات (Revenue)</td>
                      <td style={{ padding: '0.75rem' }}><MoneyDisplay amount={salesData.profit_analysis.gross_revenue} /></td>
                      <td style={{ padding: '0.75rem', color: 'var(--color-danger-700)' }}>
                        -<MoneyDisplay amount={salesData.profit_analysis.returned_revenue} />
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                        <MoneyDisplay amount={salesData.profit_analysis.net_revenue} />
                      </td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>تكلفة البضاعة المباعة (COGS)</td>
                      <td style={{ padding: '0.75rem' }}><MoneyDisplay amount={salesData.profit_analysis.gross_cogs} /></td>
                      <td style={{ padding: '0.75rem', color: 'var(--color-success-700)' }}>
                        -<MoneyDisplay amount={salesData.profit_analysis.returned_cogs_reversal} />
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>
                        <MoneyDisplay amount={salesData.profit_analysis.net_cogs} />
                      </td>
                    </tr>
                    <tr style={{ backgroundColor: 'var(--bg-app)', fontWeight: 'bold' }}>
                      <td style={{ padding: '0.75rem' }}>الربح الإجمالي المحقق (Gross Profit)</td>
                      <td style={{ padding: '0.75rem' }}><MoneyDisplay amount={salesData.profit_analysis.gross_profit} /></td>
                      <td style={{ padding: '0.75rem', color: 'var(--color-danger-700)' }}>
                        -<MoneyDisplay amount={salesData.profit_analysis.profit_reversal} />
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--color-success-700)', fontSize: 'var(--font-size-base)' }}>
                        <MoneyDisplay amount={salesData.profit_analysis.net_profit} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Card>

              {/* Categories Performance Table */}
              <Card title="أداء المبيعات والأرباح حسب الفئات">
                {salesData.profit_analysis.categories_breakdown.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    لا توجد مبيعات مسجلة خلال الفترة المختارة
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                        <th style={{ padding: '0.75rem' }}>الفئة</th>
                        <th style={{ padding: '0.75rem' }}>الكمية المباعة</th>
                        <th style={{ padding: '0.75rem' }}>إجمالي الإيراد</th>
                        <th style={{ padding: '0.75rem' }}>التكلفة</th>
                        <th style={{ padding: '0.75rem' }}>الربح المحقق</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.profit_analysis.categories_breakdown.map((cat, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{cat.category_name}</td>
                          <td style={{ padding: '0.75rem' }}>{cat.quantity_sold} قطعة</td>
                          <td style={{ padding: '0.75rem' }}><MoneyDisplay amount={cat.revenue} /></td>
                          <td style={{ padding: '0.75rem' }}><MoneyDisplay amount={cat.cogs} /></td>
                          <td style={{ padding: '0.75rem', color: 'var(--color-success-700)', fontWeight: 'bold' }}>
                            <MoneyDisplay amount={cat.profit} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </div>
          )}

          {/* TAB 3: EXPENSES */}
          {activeTab === 'expenses' && expensesData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: '1rem',
                }}
              >
                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>إجمالي المصروفات المسجلة</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={expensesData.total_expenses} />
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>المصروفات العامة والتشغيلية</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={expensesData.general_expenses} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    تُخصم من الربح الإجمالي للوصول للنتيجة التشغيلية
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>مشتريات منتجات خارجية (Policy C)</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={expensesData.external_product_expenses} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    تكلفة بضاعة مباعة للعميل مباشرة
                  </div>
                </Card>
              </div>

              {/* Categories & Methods breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                <Card title="توزيع المصروفات حسب التصنيف">
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '0.5rem' }}>التصنيف</th>
                        <th style={{ padding: '0.5rem' }}>العدد</th>
                        <th style={{ padding: '0.5rem' }}>المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensesData.categories.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem' }}>
                            {c.category_name}
                            {c.is_external_product && <Badge variant="warning" size="sm" style={{ marginRight: '0.5rem' }}>خارجي</Badge>}
                          </td>
                          <td style={{ padding: '0.5rem' }}>{c.count}</td>
                          <td style={{ padding: '0.5rem', fontWeight: 'bold' }}><MoneyDisplay amount={c.total_amount} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                <Card title="توزيع المصروفات حسب طريقة السداد">
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '0.5rem' }}>طريقة الدفع</th>
                        <th style={{ padding: '0.5rem' }}>العدد</th>
                        <th style={{ padding: '0.5rem' }}>المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensesData.payment_methods.map((pm, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem' }}>{pm.payment_method_name}</td>
                          <td style={{ padding: '0.5rem' }}>{pm.count}</td>
                          <td style={{ padding: '0.5rem', fontWeight: 'bold' }}><MoneyDisplay amount={pm.total_amount} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>

              {/* Detailed Expense Entries */}
              <Card title="جدول بنود المصروفات المسجلة">
                {expensesData.items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    لا توجد مصروفات مسجلة خلال الفترة المختارة
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                          <th style={{ padding: '0.75rem' }}>التاريخ</th>
                          <th style={{ padding: '0.75rem' }}>التصنيف</th>
                          <th style={{ padding: '0.75rem' }}>طريقة الدفع</th>
                          <th style={{ padding: '0.75rem' }}>الوصف / البيان</th>
                          <th style={{ padding: '0.75rem' }}>المبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expensesData.items.map((item) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem' }}>{item.expense_date}</td>
                            <td style={{ padding: '0.75rem' }}>
                              {item.category_name}
                              {item.is_external_product && (
                                <Badge variant="warning" size="sm" style={{ marginRight: '0.5rem' }}>منتج خارجي</Badge>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem' }}>{item.payment_method_name}</td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{item.description || '-'}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold' }}><MoneyDisplay amount={item.amount} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* TAB 4: CUSTOMERS & SUPPLIERS LEDGERS */}
          {activeTab === 'ledgers' && customerData && supplierData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Section 1: Customers */}
              <Card
                title="أرصدة ومديونيات العملاء (Customer Ledger Accounts)"
                actions={
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ width: '200px' }}>
                      <Input
                        placeholder="بحث بالاسم أو الهاتف..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomerFilter('all')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: 'var(--font-size-xs)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: customerFilter === 'all' ? 'var(--color-primary-600)' : '#ffffff',
                        color: customerFilter === 'all' ? '#ffffff' : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      الكل ({customerData.total_customers_count})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerFilter('debtors')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: 'var(--font-size-xs)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: customerFilter === 'debtors' ? 'var(--color-danger-700)' : '#ffffff',
                        color: customerFilter === 'debtors' ? '#ffffff' : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      مدينين فقط ({customerData.debtors_count})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerFilter('creditors')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: 'var(--font-size-xs)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: customerFilter === 'creditors' ? 'var(--color-success-700)' : '#ffffff',
                        color: customerFilter === 'creditors' ? '#ffffff' : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      دائنين فقط ({customerData.creditors_count})
                    </button>
                  </div>
                }
              >
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>إجمالي مديونيات العملاء المستحقة:</span>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--color-danger-700)' }}>
                      <MoneyDisplay amount={customerData.total_receivable_debts} />
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>إجمالي أرصدة العملاء الدائنة (أمانات/رصيد لهم):</span>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--color-success-700)' }}>
                      <MoneyDisplay amount={customerData.total_customer_credits} />
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                        <th style={{ padding: '0.5rem' }}>اسم العميل</th>
                        <th style={{ padding: '0.5rem' }}>الهاتف</th>
                        <th style={{ padding: '0.5rem' }}>إجمالي المسحوبات (مدين)</th>
                        <th style={{ padding: '0.5rem' }}>إجمالي المدفوعات (دائن)</th>
                        <th style={{ padding: '0.5rem' }}>الرصيد الفعلي</th>
                        <th style={{ padding: '0.5rem' }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerData.customers.map((c) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{c.name}</td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{c.phone || '-'}</td>
                          <td style={{ padding: '0.5rem' }}><MoneyDisplay amount={c.total_debits} /></td>
                          <td style={{ padding: '0.5rem' }}><MoneyDisplay amount={c.total_credits} /></td>
                          <td style={{ padding: '0.5rem', fontWeight: 'bold' }}><MoneyDisplay amount={c.balance} colored /></td>
                          <td style={{ padding: '0.5rem' }}>
                            {c.status === 'debtor' && <Badge variant="danger" size="sm">مدين (عليه دين)</Badge>}
                            {c.status === 'creditor' && <Badge variant="success" size="sm">دائن (له رصيد)</Badge>}
                            {c.status === 'settled' && <Badge variant="neutral" size="sm">خالص (0)</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Section 2: Suppliers */}
              <Card
                title="مستحقات وحسابات الموردين (Supplier Ledger Accounts)"
                actions={
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ width: '200px' }}>
                      <Input
                        placeholder="بحث بالاسم أو الهاتف..."
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSupplierFilter('all')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: 'var(--font-size-xs)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: supplierFilter === 'all' ? 'var(--color-primary-600)' : '#ffffff',
                        color: supplierFilter === 'all' ? '#ffffff' : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      الكل ({supplierData.total_suppliers_count})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplierFilter('with_payable')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: 'var(--font-size-xs)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: supplierFilter === 'with_payable' ? 'var(--color-danger-700)' : '#ffffff',
                        color: supplierFilter === 'with_payable' ? '#ffffff' : 'var(--text-main)',
                        cursor: 'pointer',
                      }}
                    >
                      مستحق له فقط ({supplierData.with_payable_count})
                    </button>
                  </div>
                }
              >
                <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>إجمالي المستحقات للموردين القائمة:</span>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--color-danger-700)' }}>
                      <MoneyDisplay amount={supplierData.total_payables_owed} />
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>مبالغ مدفوعة مقدماً للموردين:</span>
                    <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'bold', color: 'var(--color-success-700)' }}>
                      <MoneyDisplay amount={supplierData.total_overpayments} />
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                        <th style={{ padding: '0.5rem' }}>اسم المورد</th>
                        <th style={{ padding: '0.5rem' }}>الهاتف</th>
                        <th style={{ padding: '0.5rem' }}>إجمالي المشتريات المستحقة</th>
                        <th style={{ padding: '0.5rem' }}>إجمالي السدادات المدفوعة</th>
                        <th style={{ padding: '0.5rem' }}>المستحق القائم</th>
                        <th style={{ padding: '0.5rem' }}>الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplierData.suppliers.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{s.name}</td>
                          <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{s.phone || '-'}</td>
                          <td style={{ padding: '0.5rem' }}><MoneyDisplay amount={s.total_purchases_credits} /></td>
                          <td style={{ padding: '0.5rem' }}><MoneyDisplay amount={s.total_payments_debits} /></td>
                          <td style={{ padding: '0.5rem', fontWeight: 'bold' }}><MoneyDisplay amount={s.payable_balance} colored /></td>
                          <td style={{ padding: '0.5rem' }}>
                            {s.status === 'payable' && <Badge variant="danger" size="sm">مستحق له</Badge>}
                            {s.status === 'overpaid' && <Badge variant="success" size="sm">مدفوع مقدماً</Badge>}
                            {s.status === 'settled' && <Badge variant="neutral" size="sm">مصفى (0)</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 5: INVENTORY VALUATION */}
          {activeTab === 'inventory' && inventoryData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                }}
              >
                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>تقييم المخزون بسعر الشراء (التكلفة)</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={inventoryData.total_cost_valuation} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    القيمة الفعلية للأصول في المعرض
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>تقييم المخزون بسعر القطاعي</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={inventoryData.total_retail_valuation} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    قيمة البيع المتوقعة قطاعي
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>تقييم المخزون بسعر الجملة</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={inventoryData.total_wholesale_valuation} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    قيمة البيع المتوقعة جملة
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>إجمالي القطع في المخزن</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    {inventoryData.total_units_in_stock} قطعة
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    أصناف منخفضة: {inventoryData.low_stock_count} | نفدت: {inventoryData.out_of_stock_count}
                  </div>
                </Card>
              </div>

              {/* Category Valuation Table */}
              <Card title="تقييم المخزون حسب الفئات">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                      <th style={{ padding: '0.75rem' }}>اسم الفئة</th>
                      <th style={{ padding: '0.75rem' }}>عدد الأصناف</th>
                      <th style={{ padding: '0.75rem' }}>إجمالي القطع</th>
                      <th style={{ padding: '0.75rem' }}>قيمة التكلفة (شراء)</th>
                      <th style={{ padding: '0.75rem' }}>قيمة البيع (قطاعي)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryData.categories.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{c.category_name}</td>
                        <td style={{ padding: '0.75rem' }}>{c.products_count} صنف</td>
                        <td style={{ padding: '0.75rem' }}>{c.total_units} قطعة</td>
                        <td style={{ padding: '0.75rem', fontWeight: 'bold' }}><MoneyDisplay amount={c.cost_valuation} /></td>
                        <td style={{ padding: '0.75rem' }}><MoneyDisplay amount={c.retail_valuation} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              {/* Search & Products Valuation Table */}
              <Card
                title="تفاصيل المنتجات وقيمة المخزون"
                actions={
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ width: '140px' }}>
                      <Select
                        options={[
                          { value: 'all', label: 'كافة الأصناف' },
                          { value: 'active', label: 'النشط فقط' },
                          { value: 'inactive', label: 'المعطل فقط' },
                        ]}
                        value={inventoryStatus}
                        onChange={(e) => setInventoryStatus(e.target.value as 'all' | 'active' | 'inactive')}
                      />
                    </div>
                    <div style={{ width: '220px' }}>
                      <Input
                        placeholder="بحث بالاسم أو الباركود..."
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                      />
                    </div>
                  </div>
                }
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                        <th style={{ padding: '0.75rem' }}>المنتج</th>
                        <th style={{ padding: '0.75rem' }}>الباركود</th>
                        <th style={{ padding: '0.75rem' }}>الفئة</th>
                        <th style={{ padding: '0.75rem' }}>الكمية</th>
                        <th style={{ padding: '0.75rem' }}>سعر الشراء الحالي</th>
                        <th style={{ padding: '0.75rem' }}>سعر القطاعي</th>
                        <th style={{ padding: '0.75rem' }}>تقييم المخزون بالتكلفة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryData.products.map((p) => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{p.name}</td>
                          <td style={{ padding: '0.75rem', fontFamily: 'var(--font-family-mono)' }}>{p.barcode}</td>
                          <td style={{ padding: '0.75rem' }}>{p.category_name}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ fontWeight: 'bold', color: p.stock_quantity <= 5 ? 'var(--color-danger-700)' : 'inherit' }}>
                              {p.stock_quantity}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem' }}><MoneyDisplay amount={p.purchase_cost} /></td>
                          <td style={{ padding: '0.75rem' }}><MoneyDisplay amount={p.retail_price} /></td>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold' }}><MoneyDisplay amount={p.cost_valuation} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 6: CASH & PAYMENTS */}
          {activeTab === 'cash' && paymentsData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                }}
              >
                <Card>
                  <div style={{ color: 'var(--color-success-700)', fontSize: 'var(--font-size-xs)' }}>إجمالي المقبوضات (Inflows)</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={paymentsData.total_inflows} colored />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    سدادات فواتير وفوارق استبدال
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--color-danger-700)', fontSize: 'var(--font-size-xs)' }}>إجمالي المدفوعات المستردة (Refunds)</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={paymentsData.total_outflows} colored />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    استرداد نقدي لمرتجعات المبيعات
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>صافي حركة النقدية</div>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                    <MoneyDisplay amount={paymentsData.net_cash_movement} colored />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    المقبوضات - المبالغ المستردة
                  </div>
                </Card>

                <Card>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)' }}>حركة الكاش النقدي الخالص</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
                    وارد كاش: <MoneyDisplay amount={paymentsData.cash_inflows} />
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
                    صادر كاش: <MoneyDisplay amount={paymentsData.cash_outflows} />
                  </div>
                </Card>
              </div>

              {/* Payment Methods Breakdown */}
              <Card title="تفاصيل حركة الأموال حسب طريقة الدفع">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                      <th style={{ padding: '0.75rem' }}>طريقة الدفع</th>
                      <th style={{ padding: '0.75rem' }}>النوع</th>
                      <th style={{ padding: '0.75rem' }}>عدد العمليات</th>
                      <th style={{ padding: '0.75rem' }}>المقبوضات (وارد)</th>
                      <th style={{ padding: '0.75rem' }}>المسترد (صادر)</th>
                      <th style={{ padding: '0.75rem' }}>الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsData.payment_methods.map((pm, i) => {
                      const net = (Number(pm.inflows) - Number(pm.outflows)).toFixed(2);
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{pm.payment_method_name}</td>
                          <td style={{ padding: '0.75rem' }}>
                            {pm.is_cash ? <Badge variant="neutral" size="sm">نقدي (كاش)</Badge> : <Badge variant="neutral" size="sm">إلكتروني / تحويل</Badge>}
                          </td>
                          <td style={{ padding: '0.75rem' }}>{pm.count}</td>
                          <td style={{ padding: '0.75rem', color: 'var(--color-success-700)' }}><MoneyDisplay amount={pm.inflows} /></td>
                          <td style={{ padding: '0.75rem', color: 'var(--color-danger-700)' }}><MoneyDisplay amount={pm.outflows} /></td>
                          <td style={{ padding: '0.75rem', fontWeight: 'bold' }}><MoneyDisplay amount={net} colored /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              {/* Detailed Payment Records */}
              <Card title="سجل حركات السداد والمقبوضات">
                {paymentsData.payments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    لا توجد حركات سداد مسجلة خلال الفترة المختارة
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                          <th style={{ padding: '0.75rem' }}>رقم العملية</th>
                          <th style={{ padding: '0.75rem' }}>التاريخ والوقت</th>
                          <th style={{ padding: '0.75rem' }}>نوع الحركة</th>
                          <th style={{ padding: '0.75rem' }}>طريقة الدفع</th>
                          <th style={{ padding: '0.75rem' }}>المبلغ</th>
                          <th style={{ padding: '0.75rem' }}>ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentsData.payments.map((p) => (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem', fontFamily: 'var(--font-family-mono)' }}>{p.payment_number}</td>
                            <td style={{ padding: '0.75rem' }}>{p.paid_at}</td>
                            <td style={{ padding: '0.75rem' }}>
                              {p.is_outflow ? (
                                <Badge variant="danger" size="sm">{p.payment_type_label}</Badge>
                              ) : (
                                <Badge variant="success" size="sm">{p.payment_type_label}</Badge>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem' }}>{p.payment_method_name}</td>
                            <td style={{ padding: '0.75rem', fontWeight: 'bold', color: p.is_outflow ? 'var(--color-danger-700)' : 'var(--color-success-700)' }}>
                              {p.is_outflow ? '-' : '+'}<MoneyDisplay amount={p.amount} />
                            </td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{p.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* TAB 7: HISTORY (INVOICES & RETURNS) */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <Button
                  variant={historySubTab === 'invoices' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setHistorySubTab('invoices')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <FileText size={14} /> سجل فواتير المبيعات
                  </span>
                </Button>
                <Button
                  variant={historySubTab === 'returns' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setHistorySubTab('returns')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <RotateCcw size={14} /> سجل عمليات المرتجع والاستبدال
                  </span>
                </Button>
              </div>

              {historySubTab === 'invoices' && invoicesHistory && (
                <Card
                  title="تقرير أرباح فواتير المبيعات (حسب التكلفة التاريخية)"
                  actions={
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="بحث برقم الفاتورة أو العميل..."
                        value={invoiceSearch}
                        onChange={(e) => {
                          setInvoiceSearch(e.target.value);
                          setInvoiceHistoryPage(1);
                        }}
                        style={{
                          padding: '0.375rem 0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-color)',
                          fontSize: 'var(--font-size-xs)',
                          minWidth: '180px',
                        }}
                      />
                      <select
                        value={invoiceDocumentTypeFilter}
                        onChange={(e) => {
                          setInvoiceDocumentTypeFilter(e.target.value);
                          setInvoiceHistoryPage(1);
                        }}
                        style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: 'var(--font-size-xs)' }}
                      >
                        <option value="">كل الوثائق</option>
                        <option value="sale">بيع عادي</option>
                        <option value="replacement">فاتورة بديلة (استبدال)</option>
                      </select>
                      <select
                        value={invoiceSaleTypeFilter}
                        onChange={(e) => {
                          setInvoiceSaleTypeFilter(e.target.value);
                          setInvoiceHistoryPage(1);
                        }}
                        style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: 'var(--font-size-xs)' }}
                      >
                        <option value="">كل الأنواع</option>
                        <option value="retail">قطاعي</option>
                        <option value="wholesale">جملة</option>
                      </select>
                      <select
                        value={invoiceStatusFilter}
                        onChange={(e) => {
                          setInvoiceStatusFilter(e.target.value);
                          setInvoiceHistoryPage(1);
                        }}
                        style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: 'var(--font-size-xs)' }}
                      >
                        <option value="">كل الحالات</option>
                        <option value="posted">معتمدة ومرحلة</option>
                        <option value="cancelled">ملغاة</option>
                      </select>
                      <select
                        value={`${invoiceSortBy}:${invoiceSortDir}`}
                        onChange={(e) => {
                          const [sb, sd] = e.target.value.split(':');
                          setInvoiceSortBy(sb);
                          setInvoiceSortDir(sd as 'desc' | 'asc');
                          setInvoiceHistoryPage(1);
                        }}
                        style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: 'var(--font-size-xs)' }}
                      >
                        <option value="created_at:desc">التاريخ (الأحدث أولاً)</option>
                        <option value="created_at:asc">التاريخ (الأقدم أولاً)</option>
                        <option value="net_profit:desc">الأرباح (الأعلى ربحاً)</option>
                        <option value="net_profit:asc">الأرباح (الأقل ربحاً)</option>
                        <option value="total:desc">المبيعات (الأعلى مبيعاً)</option>
                      </select>
                    </div>
                  }
                >
                  {/* Historical Cost Audit Notice Banner */}
                  <div
                    style={{
                      padding: '0.6rem 0.85rem',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.825rem',
                      color: '#1E40AF',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>
                      <strong>الربح بحسب تكلفة الشراء وقت البيع:</strong> يتم احتساب أرباح البنود بناءً على اللقطة التاريخية لتكلفة الشراء عند اعتماد الفاتورة. تغيير تكاليف الأصناف مستقبلاً لا يؤثر على أرباح الفواتير السابقة.
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                          <th style={{ padding: '0.65rem 0.5rem' }}>رقم الفاتورة</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>التاريخ والوقت</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>العميل</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>نوع الوثيقة</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>إجمالي المبيعات</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>تكلفة البضاعة</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>إجمالي الربح</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>هامش الربح</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>قيمة المرتجع</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>أرباح مستردة</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>صافي الربح</th>
                          <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoicesHistory.items.length === 0 ? (
                          <tr>
                            <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              لا توجد فواتير مطابقة للبحث والفترة المحددة
                            </td>
                          </tr>
                        ) : (
                          invoicesHistory.items.map((inv) => (
                            <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: inv.is_replacement ? '#F8FAFC' : undefined }}>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold', fontFamily: 'var(--font-family-mono)', whiteSpace: 'nowrap' }}>
                                <div>{inv.invoice_number}</div>
                                {inv.status === 'cancelled' && <Badge variant="danger" size="sm">ملغاة</Badge>}
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                {inv.created_at}
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span title={inv.customer_name}>{inv.customer_name}</span>
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', whiteSpace: 'nowrap' }}>
                                {inv.is_replacement ? (
                                  <Badge variant="primary" size="sm">فاتورة بديلة</Badge>
                                ) : (
                                  <Badge variant="neutral" size="sm">{inv.sale_type_label}</Badge>
                                )}
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>
                                <MoneyDisplay amount={inv.total_sales ?? inv.stored_total} />
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', color: 'var(--text-secondary)' }}>
                                <MoneyDisplay amount={inv.cost_of_goods ?? '0.00'} />
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 600 }}>
                                <MoneyDisplay amount={inv.gross_profit ?? '0.00'} colored />
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontSize: '12px' }}>
                                {inv.profit_margin_percentage ? `${inv.profit_margin_percentage}%` : '—'}
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', color: parseFloat(inv.returned_value ?? '0') > 0 ? '#B45309' : 'inherit' }}>
                                {parseFloat(inv.returned_value ?? '0') > 0 ? (
                                  <MoneyDisplay amount={inv.returned_value ?? '0.00'} />
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', color: parseFloat(inv.profit_reversal ?? '0') > 0 ? '#DC2626' : 'inherit' }}>
                                {parseFloat(inv.profit_reversal ?? '0') > 0 ? (
                                  `-${Number(inv.profit_reversal).toFixed(2)}`
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, fontSize: '13px' }}>
                                <MoneyDisplay amount={inv.net_profit ?? inv.gross_profit ?? '0.00'} colored />
                              </td>
                              <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setSelectedInvoiceDrilldown(inv)}
                                >
                                  تفاصيل الربح
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>

                      {/* Filtered Period Totals Row */}
                      {invoicesHistory.totals && (
                        <tfoot>
                          <tr style={{ backgroundColor: '#0B1220', color: '#FFFFFF', fontWeight: 700, borderTop: '2px solid #000' }}>
                            <td colSpan={4} style={{ padding: '0.75rem 0.5rem' }}>
                              إجمالي الفترة المحددة ({invoicesHistory.pagination.total} فاتورة):
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ color: '#FFFFFF' }}>{Number(invoicesHistory.totals.total_sales).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ color: '#E2E8F0' }}>{Number(invoicesHistory.totals.cost_of_goods).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ color: '#34D399' }}>{Number(invoicesHistory.totals.gross_profit).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>
                              {invoicesHistory.totals.average_margin_percentage}%
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ color: '#FBBF24' }}>{Number(invoicesHistory.totals.returned_value).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ color: '#F87171' }}>-{Number(invoicesHistory.totals.profit_reversal).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', fontSize: '14px' }}>
                              <span style={{ color: '#10B981', fontWeight: 800 }}>{Number(invoicesHistory.totals.net_profit).toLocaleString('ar-EG', { minimumFractionDigits: 2 })} ج.م</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }} />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Pagination */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      صفحة {invoicesHistory.pagination.current_page} من {invoicesHistory.pagination.last_page} (إجمالي: {invoicesHistory.pagination.total} فاتورة)
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={invoicesHistory.pagination.current_page <= 1}
                        onClick={() => setInvoiceHistoryPage((p) => Math.max(1, p - 1))}
                      >
                        السابق
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={invoicesHistory.pagination.current_page >= invoicesHistory.pagination.last_page}
                        onClick={() => setInvoiceHistoryPage((p) => p + 1)}
                      >
                        التالي
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Owner Invoice Profit Drill-Down Modal */}
              {selectedInvoiceDrilldown && (
                <Modal
                  isOpen={true}
                  onClose={() => setSelectedInvoiceDrilldown(null)}
                  title={`تحليل أرباح الفاتورة: ${selectedInvoiceDrilldown.invoice_number}`}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Invoice Metadata Header */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                        gap: '0.75rem',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div>رقم الفاتورة: <strong>{selectedInvoiceDrilldown.invoice_number}</strong></div>
                      <div>التاريخ: <strong>{selectedInvoiceDrilldown.created_at}</strong></div>
                      <div>العميل: <strong>{selectedInvoiceDrilldown.customer_name}</strong></div>
                      <div>نوع البيع: <strong>{selectedInvoiceDrilldown.sale_type_label}</strong></div>
                      <div>الحالة: <strong>{selectedInvoiceDrilldown.status_label}</strong></div>
                      <div>نوع الوثيقة: <strong>{selectedInvoiceDrilldown.document_type_label || (selectedInvoiceDrilldown.is_replacement ? 'فاتورة بديلة' : 'فاتورة بيع')}</strong></div>
                    </div>

                    {/* Replacement Case Banner */}
                    {selectedInvoiceDrilldown.is_replacement && selectedInvoiceDrilldown.replacement_details && (
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: '#EFF6FF',
                          border: '1px solid #BFDBFE',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#1E40AF', marginBottom: '0.25rem' }}>
                          فاتورة استبدال بديلة عن #{selectedInvoiceDrilldown.replacement_details.original_invoice_number} (رقم المرتجع: {selectedInvoiceDrilldown.replacement_details.return_number})
                        </div>
                        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                          <div>قيمة المرتجع: <strong>{parseFloat(selectedInvoiceDrilldown.replacement_details.returned_value).toFixed(2)} ج.م</strong></div>
                          <div>قيمة البدائل: <strong>{parseFloat(selectedInvoiceDrilldown.replacement_details.replacement_value).toFixed(2)} ج.م</strong></div>
                          <div>الفرق المدفوع: <strong style={{ color: '#059669' }}>{parseFloat(selectedInvoiceDrilldown.replacement_details.difference_paid_amount || selectedInvoiceDrilldown.replacement_details.difference_amount).toFixed(2)} ج.م</strong></div>
                        </div>
                      </div>
                    )}

                    {/* Exchange Profit Combined Net Card */}
                    {selectedInvoiceDrilldown.exchange_drilldown && (
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          backgroundColor: '#F0FDF4',
                          border: '1px solid #BBF7D0',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ fontWeight: 700, color: '#166534', marginBottom: '0.35rem' }}>
                          صافي أرباح عملية الاستبدال الموحدة (الفاتورة الأصلية + المرتجع + الفاتورة البديلة)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
                          <div>ربح الفاتورة الأصلية ({selectedInvoiceDrilldown.exchange_drilldown.original_invoice_number}): <strong>+{selectedInvoiceDrilldown.exchange_drilldown.original_invoice_profit} ج.م</strong></div>
                          <div>استرداد أرباح المرتجع: <strong style={{ color: '#DC2626' }}>-{selectedInvoiceDrilldown.exchange_drilldown.return_profit_reversal} ج.م</strong></div>
                          <div>ربح الفاتورة البديلة: <strong>+{selectedInvoiceDrilldown.exchange_drilldown.replacement_invoice_profit} ج.م</strong></div>
                          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #86EFAC', paddingTop: '0.35rem', fontWeight: 800, color: '#15803D' }}>
                            صافي الربح الموحد لعملية الاستبدال: {selectedInvoiceDrilldown.exchange_drilldown.combined_net_profit} ج.م
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Per-Item Cost and Profit Lines */}
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 'bold' }}>
                        تفاصيل بنود الفاتورة والتكلفة التاريخية
                      </h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '0.4rem 0.5rem' }}>الصنف</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>النوع</th>
                            <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>الكمية</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>سعر البيع</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>التكلفة التاريخية</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>الإجمالي</th>
                            <th style={{ padding: '0.4rem 0.5rem' }}>ربح البند</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvoiceDrilldown.items_drilldown?.map((it: NonNullable<ReportInvoiceHistoryItem['items_drilldown']>[number]) => (
                            <tr key={it.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.45rem 0.5rem' }}>
                                <div style={{ fontWeight: 600 }}>{it.product_name}</div>
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center' }}>
                                {it.is_external ? (
                                  <Badge variant="warning" size="sm">خارجي</Badge>
                                ) : (
                                  <Badge variant="neutral" size="sm">مخزني</Badge>
                                )}
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', textAlign: 'center', fontFamily: 'monospace' }}>
                                {it.quantity}
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem' }}>
                                <MoneyDisplay amount={it.unit_sale_price} />
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', color: 'var(--text-secondary)' }}>
                                <MoneyDisplay amount={it.unit_cost} />
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', fontWeight: 600 }}>
                                <MoneyDisplay amount={it.subtotal} />
                              </td>
                              <td style={{ padding: '0.45rem 0.5rem', fontWeight: 700 }}>
                                <MoneyDisplay amount={it.profit} colored />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Returned Items Drilldown (if any) */}
                    {selectedInvoiceDrilldown.returns_drilldown && selectedInvoiceDrilldown.returns_drilldown.length > 0 && (
                      <div>
                        <h4 style={{ margin: '0.5rem 0 0.4rem', fontSize: '0.95rem', fontWeight: 'bold', color: '#B45309' }}>
                          الأصناف المرتجعة واسترداد الأرباح
                        </h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#FEF3C7', borderBottom: '1px solid #FCD34D' }}>
                              <th style={{ padding: '0.4rem 0.5rem' }}>رقم المرتجع</th>
                              <th style={{ padding: '0.4rem 0.5rem' }}>الصنف</th>
                              <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>الكمية</th>
                              <th style={{ padding: '0.4rem 0.5rem' }}>القيمة المرتجعة</th>
                              <th style={{ padding: '0.4rem 0.5rem' }}>أرباح مستردة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedInvoiceDrilldown.returns_drilldown.flatMap((ret) =>
                              ret.items.map((rit, idx) => (
                                <tr key={`${ret.id}-${rit.id}-${idx}`} style={{ borderBottom: '1px solid #FDE68A' }}>
                                  <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace', fontWeight: 600 }}>{ret.return_number}</td>
                                  <td style={{ padding: '0.4rem 0.5rem' }}>{rit.product_name}</td>
                                  <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontFamily: 'monospace' }}>{rit.quantity}</td>
                                  <td style={{ padding: '0.4rem 0.5rem' }}><MoneyDisplay amount={rit.subtotal} /></td>
                                  <td style={{ padding: '0.4rem 0.5rem', color: '#DC2626', fontWeight: 700 }}>
                                    -{parseFloat(rit.profit_reversal).toFixed(2)} ج.م
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Net Profit Summary Box */}
                    <div
                      style={{
                        padding: '0.85rem',
                        backgroundColor: '#0B1220',
                        color: '#FFFFFF',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
                        <div>إجمالي المبيعات: <strong>{Number(selectedInvoiceDrilldown.total_sales ?? selectedInvoiceDrilldown.stored_total).toFixed(2)} ج.م</strong></div>
                        <div>تكلفة البضاعة: <strong>{Number(selectedInvoiceDrilldown.cost_of_goods ?? '0').toFixed(2)} ج.م</strong></div>
                        <div>إجمالي الربح: <strong>{Number(selectedInvoiceDrilldown.gross_profit ?? '0').toFixed(2)} ج.م</strong></div>
                        {parseFloat(selectedInvoiceDrilldown.profit_reversal ?? '0') > 0 && (
                          <div style={{ color: '#F87171' }}>أرباح مستردة: <strong>-{Number(selectedInvoiceDrilldown.profit_reversal).toFixed(2)} ج.م</strong></div>
                        )}
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>صافي الربح النهائي للفاتورة:</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34D399' }}>
                          {Number(selectedInvoiceDrilldown.net_profit ?? selectedInvoiceDrilldown.gross_profit ?? '0').toFixed(2)} ج.م
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <Button variant="secondary" onClick={() => setSelectedInvoiceDrilldown(null)}>
                        إغلاق
                      </Button>
                    </div>
                  </div>
                </Modal>
              )}

              {historySubTab === 'returns' && returnsHistory && (
                <Card
                  title="سجل عمليات المرتجع والاستبدال (مع تفاصيل الأثر المالي وأرباح المرتجع)"
                  actions={
                    <select
                      value={returnResolutionFilter}
                      onChange={(e) => {
                        setReturnResolutionFilter(e.target.value);
                        setReturnHistoryPage(1);
                      }}
                      style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: 'var(--font-size-xs)' }}
                    >
                      <option value="">كل القرارات</option>
                      <option value="refund_cash">استرداد نقدي</option>
                      <option value="exchange_equal">استبدال مساوي</option>
                      <option value="exchange_upgrade">استبدال بفارق</option>
                      <option value="customer_account_credit">رصيد حساب عميل</option>
                    </select>
                  }
                >
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)' }}>
                          <th style={{ padding: '0.65rem 0.5rem' }}>رقم المرتجع</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>التاريخ</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>رقم الفاتورة الأصلية</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>العميل</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>قرار التسوية</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>قيمة المرتجع</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>قيمة البدائل</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>الفارق المسدد</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>استرداد أرباح المرتجع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnsHistory.items.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              لا توجد عمليات مرتجع مسجلة خلال الفترة المختارة
                            </td>
                          </tr>
                        ) : (
                          returnsHistory.items.map((ret) => (
                            <tr key={ret.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.65rem 0.5rem', fontWeight: 'bold', fontFamily: 'var(--font-family-mono)' }}>{ret.return_number}</td>
                              <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-secondary)' }}>{ret.created_at}</td>
                              <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'var(--font-family-mono)' }}>{ret.invoice_number || '-'}</td>
                              <td style={{ padding: '0.65rem 0.5rem' }}>{ret.customer_name}</td>
                              <td style={{ padding: '0.65rem 0.5rem' }}><Badge variant="neutral" size="sm">{ret.resolution_label}</Badge></td>
                              <td style={{ padding: '0.65rem 0.5rem', fontWeight: 'bold', color: '#B45309' }}>
                                <MoneyDisplay amount={ret.total_return_amount} />
                              </td>
                              <td style={{ padding: '0.65rem 0.5rem' }}>
                                {ret.replacement_value ? <MoneyDisplay amount={ret.replacement_value} /> : '—'}
                              </td>
                              <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600 }}>
                                {parseFloat(ret.difference_paid_amount || ret.difference_amount || '0') > 0 ? (
                                  <MoneyDisplay amount={ret.difference_paid_amount || ret.difference_amount} />
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td style={{ padding: '0.65rem 0.5rem', color: '#DC2626', fontWeight: 700 }}>
                                {ret.profit_reversal && parseFloat(ret.profit_reversal) > 0 ? (
                                  `-${Number(ret.profit_reversal).toFixed(2)} ج.م`
                                ) : (
                                  '—'
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      صفحة {returnsHistory.pagination.current_page} من {returnsHistory.pagination.last_page} (إجمالي: {returnsHistory.pagination.total})
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={returnsHistory.pagination.current_page <= 1}
                        onClick={() => setReturnHistoryPage((p) => Math.max(1, p - 1))}
                      >
                        السابق
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={returnsHistory.pagination.current_page >= returnsHistory.pagination.last_page}
                        onClick={() => setReturnHistoryPage((p) => p + 1)}
                      >
                        التالي
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
};
