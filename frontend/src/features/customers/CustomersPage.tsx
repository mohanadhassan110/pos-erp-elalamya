import React, { useState, useEffect, useCallback } from 'react';
import { customersApi } from '../../services/api/customersApi';
import type { Customer, PaginatedResponse } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../app/providers/useToast';

export const CustomersPage: React.FC = () => {
  const { showToast } = useToast();
  const [customersData, setCustomersData] = useState<PaginatedResponse<Customer> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formAddress, setFormAddress] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await customersApi.list({ search, page });
      setCustomersData(data);
    } catch {
      showToast('تعذر تحميل بيانات العملاء', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [search, page, showToast]);

  useEffect(() => {
    let active = true;
    customersApi.list({ search, page })
      .then((data) => {
        if (active) {
          setCustomersData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          showToast('تعذر تحميل بيانات العملاء', 'error');
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [search, page, showToast]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormPhone(c.phone || '');
    setFormAddress(c.address || '');
    setFormNotes(c.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('اسم العميل مطلوب');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCustomer) {
        await customersApi.update(editingCustomer.id, {
          name: formName.trim(),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          notes: formNotes.trim() || null,
        });
        showToast('تم تحديث بيانات العميل بنجاح', 'success');
      } else {
        await customersApi.create({
          name: formName.trim(),
          phone: formPhone.trim() || null,
          address: formAddress.trim() || null,
          notes: formNotes.trim() || null,
        });
        showToast('تمت إضافة العميل بنجاح', 'success');
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ العميل';
      setFormError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (c: Customer) => {
    try {
      await customersApi.toggleStatus(c.id, !c.is_active);
      showToast(c.is_active ? 'تم تعطيل حساب العميل' : 'تم تفعيل حساب العميل', 'info');
      fetchCustomers();
    } catch {
      showToast('فشل تغيير حالة العميل', 'error');
    }
  };

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'اسم العميل',
      render: (c: Customer) => (
        <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{c.name}</span>
      ),
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      width: '10rem',
      render: (c: Customer) => (
        <span style={{ direction: 'ltr', display: 'inline-block' }}>{c.phone || '—'}</span>
      ),
    },
    {
      key: 'address',
      header: 'العنوان',
      render: (c: Customer) => <span>{c.address || '—'}</span>,
    },
    {
      key: 'balance',
      header: 'رصيد الحساب (دفتر الأستاذ)',
      width: '13rem',
      render: (c: Customer) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-family-mono)' }}>
            {c.balance_formatted}
          </span>
          <Badge
            variant={
              c.balance_status === 'debt'
                ? 'danger'
                : c.balance_status === 'credit'
                ? 'primary'
                : 'success'
            }
            size="sm"
          >
            {c.balance_status_label}
          </Badge>
        </div>
      ),
    },
    {
      key: 'is_active',
      header: 'الحالة',
      width: '6rem',
      render: (c: Customer) => (
        <Badge variant={c.is_active ? 'success' : 'neutral'} size="sm">
          {c.is_active ? 'نشط' : 'معطل'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      width: '9rem',
      align: 'left',
      render: (c: Customer) => (
        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(c)}>
            تعديل
          </Button>
          <Button
            variant={c.is_active ? 'danger' : 'outline'}
            size="sm"
            onClick={() => handleToggleStatus(c)}
          >
            {c.is_active ? 'تعطيل' : 'تفعيل'}
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
            إدارة العملاء وحسابات الجملة
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            سجل العملاء، بيانات الاتصال، وأرصدة الحسابات المستحقة
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAddModal}>
          + إضافة عميل جديد
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
            placeholder="بحث باسم العميل أو رقم الهاتف..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* Customers Table */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Spinner size="lg" />
          </div>
        ) : !customersData || customersData.data.length === 0 ? (
          <EmptyState
            title="لا يوجد عملاء مسجلين"
            description="لم يتم العثور على أي عملاء مسجلين يطابقون معايير البحث."
          />
        ) : (
          <>
            <Table
              columns={columns}
              data={customersData.data}
              keyExtractor={(c) => c.id}
            />

            {/* Pagination Controls */}
            {customersData.meta && customersData.meta.last_page > 1 && (
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
                  إجمالي العملاء: {customersData.meta.total} | الصفحة {customersData.meta.current_page} من {customersData.meta.last_page}
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
                    disabled={page >= customersData.meta.last_page}
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

      {/* Customer Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {formError && <Alert type="error" message={formError} />}

          <Input
            label="اسم العميل أو المعرض"
            placeholder="مثال: معرض الأمل للأثاث، أحمد محمود"
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
            placeholder="مثال: القاهرة - مدينة نصر"
            value={formAddress}
            onChange={(e) => setFormAddress(e.target.value)}
          />

          <Input
            label="ملاحظات"
            placeholder="ملاحظات اختيارية..."
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
              {editingCustomer ? 'حفظ التعديلات' : 'إضافة العميل'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
