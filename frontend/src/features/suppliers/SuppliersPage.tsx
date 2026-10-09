import React, { useState, useEffect, useCallback } from 'react';
import { suppliersApi } from '../../services/api/suppliersApi';
import type { Supplier, PaginatedResponse } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../app/providers/useToast';

export const SuppliersPage: React.FC = () => {
  const { showToast } = useToast();
  const [suppliersData, setSuppliersData] = useState<PaginatedResponse<Supplier> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Supplier Edit/Add Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Add Balance Modal
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState<boolean>(false);
  const [balanceSupplier, setBalanceSupplier] = useState<Supplier | null>(null);
  const [balanceAmount, setBalanceAmount] = useState<string>('');
  const [balanceDescription, setBalanceDescription] = useState<string>('');
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [isSubmittingBalance, setIsSubmittingBalance] = useState<boolean>(false);

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await suppliersApi.list({ search, page });
      setSuppliersData(data);
    } catch {
      showToast('تعذر تحميل بيانات الموردين', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [search, page, showToast]);

  useEffect(() => {
    let active = true;
    suppliersApi.list({ search, page })
      .then((data) => {
        if (active) {
          setSuppliersData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          showToast('تعذر تحميل بيانات الموردين', 'error');
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [search, page, showToast]);

  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setFormName(s.name);
    setFormPhone(s.phone || '');
    setFormAddress(s.address || '');
    setFormNotes(s.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenAddBalanceModal = (s: Supplier) => {
    setBalanceSupplier(s);
    setBalanceAmount('');
    setBalanceDescription('');
    setBalanceError(null);
    setIsBalanceModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('اسم المورد مطلوب');
      return;
    }

    setIsSaving(true);
    try {
      if (editingSupplier) {
        await suppliersApi.update(editingSupplier.id, {
          name: formName.trim(),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          notes: formNotes.trim() || null,
        });
        showToast('تم تحديث بيانات المورد بنجاح', 'success');
      } else {
        await suppliersApi.create({
          name: formName.trim(),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          notes: formNotes.trim() || null,
        });
        showToast('تمت إضافة المورد بنجاح', 'success');
      }
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ المورد';
      setFormError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBalanceError(null);

    if (!balanceSupplier) return;
    if (!balanceAmount || Number(balanceAmount) <= 0) {
      setBalanceError('المبلغ المضاف يجب أن يكون رقماً أكبر من الصفر');
      return;
    }
    if (!balanceDescription.trim()) {
      setBalanceError('يجب كتابة بيان وتفاصيل إضافة الرصيد');
      return;
    }

    setIsSubmittingBalance(true);
    try {
      await suppliersApi.addBalance(balanceSupplier.id, {
        amount: balanceAmount,
        description: balanceDescription.trim(),
      });
      showToast('تمت إضافة الرصيد لحساب المورد بنجاح', 'success');
      setIsBalanceModalOpen(false);
      fetchSuppliers();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'فشل إضافة الرصيد للمورد';
      setBalanceError(errorMsg);
    } finally {
      setIsSubmittingBalance(false);
    }
  };

  const handleToggleStatus = async (s: Supplier) => {
    try {
      await suppliersApi.toggleStatus(s.id, !s.is_active);
      showToast(s.is_active ? 'تم تعطيل حساب المورد' : 'تم تفعيل حساب المورد', 'info');
      fetchSuppliers();
    } catch {
      showToast('فشل تغيير حالة المورد', 'error');
    }
  };

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'اسم المورد / المصنع',
      render: (s: Supplier) => (
        <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{s.name}</span>
      ),
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      width: '10rem',
      render: (s: Supplier) => (
        <span style={{ direction: 'ltr', display: 'inline-block' }}>{s.phone || '—'}</span>
      ),
    },
    {
      key: 'address',
      header: 'العنوان',
      render: (s: Supplier) => <span>{s.address || '—'}</span>,
    },
    {
      key: 'payable',
      header: 'المستحق للمورد (دفتر الأستاذ)',
      width: '13rem',
      render: (s: Supplier) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-family-mono)' }}>
            {s.payable_formatted}
          </span>
          <Badge variant={s.is_settled ? 'success' : 'warning'} size="sm">
            {s.is_settled ? 'خالص / مسدد' : 'مستحق للمورد'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'الحالة',
      width: '6rem',
      render: (s: Supplier) => (
        <Badge variant={s.is_active ? 'success' : 'neutral'} size="sm">
          {s.is_active ? 'نشط' : 'معطل'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      width: '15rem',
      align: 'left',
      render: (s: Supplier) => (
        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenAddBalanceModal(s)}
            disabled={!s.is_active}
          >
            + إضافة رصيد
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(s)}>
            تعديل
          </Button>
          <Button
            variant={s.is_active ? 'danger' : 'outline'}
            size="sm"
            onClick={() => handleToggleStatus(s)}
          >
            {s.is_active ? 'تعطيل' : 'تفعيل'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
            إدارة الموردين والمصانع
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            سجل ورش ومصانع التوريد، المديونيات المستحقة، وإضافة الأرصدة
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAddModal}>
          + إضافة مورد جديد
        </Button>
      </div>

      {/* Filters Bar */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          backgroundColor: 'var(--bg-surface)',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, maxWidth: '24rem' }}>
          <Input
            placeholder="بحث باسم المورد أو رقم الهاتف..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Spinner size="lg" />
          </div>
        ) : !suppliersData || suppliersData.data.length === 0 ? (
          <EmptyState
            title="لا يوجد موردين مسجلين"
            description="لم يتم العثور على أي موردين يطابقون معايير البحث."
          />
        ) : (
          <>
            <Table
              columns={columns}
              data={suppliersData.data}
              keyExtractor={(s) => s.id}
            />

            {/* Pagination Controls */}
            {suppliersData.meta && suppliersData.meta.last_page > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1.25rem',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                  إجمالي الموردين: {suppliersData.meta.total} | الصفحة {suppliersData.meta.current_page} من {suppliersData.meta.last_page}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((prev) => prev - 1)}
                  >
                    السابق
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= suppliersData.meta.last_page}
                    onClick={() => setPage((prev) => prev + 1)}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Supplier Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
      >
        <form onSubmit={handleSaveSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {formError && <Alert type="error" message={formError} />}

          <Input
            label="اسم المورد أو المصنع"
            placeholder="مثال: مصنع دمياط للموبيليا، ورشة الأمانة"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="رقم الهاتف"
            placeholder="مثال: 01012345678"
            value={formPhone}
            onChange={(e) => setFormPhone(e.target.value)}
          />

          <Input
            label="العنوان"
            placeholder="مثال: دمياط - المنطقة الصناعية"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
          />

          <Input
            label="ملاحظات"
            placeholder="ملاحظات إضافية..."
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Balance Modal */}
      <Modal
        isOpen={isBalanceModalOpen}
        onClose={() => !isSubmittingBalance && setIsBalanceModalOpen(false)}
        title={`إضافة رصيد مستحق للمورد: ${balanceSupplier?.name || ''}`}
      >
        <form onSubmit={handleAddBalanceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {balanceError && <Alert type="error" message={balanceError} />}

          <div style={{ backgroundColor: 'var(--color-primary-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary-800)', margin: 0 }}>
              💡 هذه العملية تزيد رصيد المستحق للمورد في دفتر الأستاذ (مثل فواتير توريد خارجية سابقة) ولا تؤثر على المخزون الفعلي. استلام البضاعة للمخزن يتم عبر شاشة <strong>استلام بضاعة</strong>.
            </p>
          </div>

          <Input
            label="المبلغ المضاف (ج.م)"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={balanceAmount}
            onChange={(e) => setBalanceAmount(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="البيان / تفاصيل العملية"
            placeholder="مثال: فاتورة شراء 20 قطعة لحاف تركي، مصنعية دهانات"
            value={balanceDescription}
            onChange={(e) => setBalanceDescription(e.target.value)}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBalanceModalOpen(false)}
              disabled={isSubmittingBalance}
            >
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingBalance}>
              تأكيد إضافة الرصيد
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
