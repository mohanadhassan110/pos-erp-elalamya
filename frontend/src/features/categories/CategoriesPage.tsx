import React, { useState, useEffect, useCallback } from 'react';
import { categoriesApi } from '../../services/api/categoriesApi';
import type { Category } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../app/providers/useToast';

export const CategoriesPage: React.FC = () => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number | boolean | undefined | null> = {};
      if (search) params.search = search;
      if (statusFilter === 'active') params.is_active = true;
      if (statusFilter === 'inactive') params.is_active = false;

      const data = await categoriesApi.list(params);
      setCategories(data);
    } catch {
      showToast('تعذر تحميل الفئات، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, showToast]);

  useEffect(() => {
    let active = true;
    const params: Record<string, string | number | boolean | undefined | null> = {};
    if (search) params.search = search;
    if (statusFilter === 'active') params.is_active = true;
    if (statusFilter === 'inactive') params.is_active = false;

    categoriesApi.list(params)
      .then((data) => {
        if (active) {
          setCategories(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          showToast('تعذر تحميل الفئات، يرجى المحاولة لاحقاً', 'error');
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [search, statusFilter, showToast]);

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormCode('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormCode(cat.code);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formName.trim();
    const trimmedCode = formCode.trim().toUpperCase();

    if (!trimmedName) {
      setFormError('اسم الفئة مطلوب');
      return;
    }

    if (!trimmedCode || !/^[A-Z]$/.test(trimmedCode)) {
      setFormError('كود الفئة يجب أن يكون حرفاً إنجليزياً واحداً فقط (A-Z)');
      return;
    }

    setIsSaving(true);
    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, {
          name: trimmedName,
          code: trimmedCode,
        });
        showToast('تم تحديث الفئة بنجاح', 'success');
      } else {
        await categoriesApi.create({
          name: trimmedName,
          code: trimmedCode,
        });
        showToast('تمت إضافة الفئة بنجاح', 'success');
      }
      setIsModalOpen(false);
      fetchCategories();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الفئة';
      setFormError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (cat: Category) => {
    try {
      await categoriesApi.toggleStatus(cat.id, !cat.is_active);
      showToast(cat.is_active ? 'تم تعطيل الفئة' : 'تم تفعيل الفئة', 'info');
      fetchCategories();
    } catch {
      showToast('فشل تغيير حالة الفئة', 'error');
    }
  };

  const columns: Column<Category>[] = [
    {
      key: 'code',
      header: 'حرف الباركود',
      width: '6rem',
      render: (cat: Category) => (
        <Badge variant="primary" size="md">
          {cat.code}
        </Badge>
      ),
    },
    {
      key: 'name',
      header: 'اسم الفئة',
      render: (cat: Category) => (
        <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{cat.name}</span>
      ),
    },
    {
      key: 'products_count',
      header: 'عدد المنتجات',
      width: '8rem',
      render: (cat: Category) => <span>{cat.products_count ?? 0} منتج</span>,
    },
    {
      key: 'is_active',
      header: 'الحالة',
      width: '8rem',
      render: (cat: Category) => (
        <Badge variant={cat.is_active ? 'success' : 'neutral'} size="sm">
          {cat.is_active ? 'نشطة' : 'معطلة'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      width: '10rem',
      align: 'left',
      render: (cat: Category) => (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(cat)}>
            تعديل
          </Button>
          <Button
            variant={cat.is_active ? 'danger' : 'outline'}
            size="sm"
            onClick={() => handleToggleStatus(cat)}
          >
            {cat.is_active ? 'تعطيل' : 'تفعيل'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
            إدارة فئات المنتجات
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            تعريف الفئات ورموز الباركود الأبجدية لتوليد أكواد المعرض
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenAddModal}>
          + إضافة فئة جديدة
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
            placeholder="بحث بالاسم أو حرف الفئة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            variant={statusFilter === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
          >
            الكل
          </Button>
          <Button
            variant={statusFilter === 'active' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('active')}
          >
            النشطة فقط
          </Button>
          <Button
            variant={statusFilter === 'inactive' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('inactive')}
          >
            المعطلة
          </Button>
        </div>
      </div>

      {/* Categories Table */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Spinner size="lg" />
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            title="لا توجد فئات مطابقة"
            description="لم يتم العثور على أي فئات تطابق معايير البحث الحالية."
          />
        ) : (
          <Table
            columns={columns}
            data={categories}
            keyExtractor={(cat) => cat.id}
          />
        )}
      </div>

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {formError && <Alert type="error" message={formError} />}

          <Input
            label="اسم الفئة"
            placeholder="مثال: غرف نوم، صالونات، كراسي"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />

          <div>
            <Input
              label="حرف كود الباركود (حرف إنجليزي واحد)"
              placeholder="A - Z"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value.toUpperCase().slice(0, 1))}
              disabled={Boolean(editingCategory && (editingCategory.products_count ?? 0) > 0)}
              maxLength={1}
              required
            />
            {editingCategory && (editingCategory.products_count ?? 0) > 0 ? (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning-700)', marginTop: '0.25rem' }}>
                ⚠️ لا يمكن تغيير حرف الفئة لوجود منتجات مسجلة بالفعل مرتبطة بتسلسل هذا الحرف.
              </p>
            ) : (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                الحرف يستخدم في تكوين الباركود المتسلسل (مثال: B0001, B0002).
              </p>
            )}
          </div>

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
              {editingCategory ? 'حفظ التعديلات' : 'إضافة الفئة'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
