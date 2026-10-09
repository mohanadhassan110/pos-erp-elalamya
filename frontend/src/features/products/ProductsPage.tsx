import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '../../services/api/productsApi';
import { categoriesApi } from '../../services/api/categoriesApi';
import type { Product, Category, PaginatedResponse } from '../../types/domain';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../app/providers/useToast';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [productsData, setProductsData] = useState<PaginatedResponse<Product> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [page, setPage] = useState<number>(1);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formPurchaseCost, setFormPurchaseCost] = useState<string>('');
  const [formWholesalePrice, setFormWholesalePrice] = useState<string>('');
  const [formRetailPrice, setFormRetailPrice] = useState<string>('');
  const [formInitialStock, setFormInitialStock] = useState<string>('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Load Categories for dropdown
  useEffect(() => {
    categoriesApi.list({ is_active: true }).then(setCategories).catch(() => {});
  }, []);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number | boolean | undefined | null> = { page };

      if (search) params.search = search;
      if (selectedCategory) params.category_id = Number(selectedCategory);
      if (selectedStatus === 'active') params.is_active = true;
      if (selectedStatus === 'inactive') params.is_active = false;

      const data = await productsApi.list(params);
      setProductsData(data);
    } catch {
      showToast('تعذر تحميل المنتجات، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [search, selectedCategory, selectedStatus, page, showToast]);

  useEffect(() => {
    let active = true;
    const params: Record<string, string | number | boolean | undefined | null> = { page };

    if (search) params.search = search;
    if (selectedCategory) params.category_id = Number(selectedCategory);
    if (selectedStatus === 'active') params.is_active = true;
    if (selectedStatus === 'inactive') params.is_active = false;

    productsApi.list(params)
      .then((data) => {
        if (active) {
          setProductsData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          showToast('تعذر تحميل المنتجات، يرجى المحاولة لاحقاً', 'error');
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [search, selectedCategory, selectedStatus, page, showToast]);

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategoryId(categories[0]?.id ? String(categories[0].id) : '');
    setFormPurchaseCost('');
    setFormWholesalePrice('');
    setFormRetailPrice('');
    setFormInitialStock('0');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategoryId(String(p.category_id));
    setFormPurchaseCost(p.purchase_cost);
    setFormWholesalePrice(p.wholesale_price);
    setFormRetailPrice(p.retail_price);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim()) {
      setFormError('اسم المنتج مطلوب');
      return;
    }
    if (!formCategoryId) {
      setFormError('يرجى اختيار فئة المنتج');
      return;
    }
    if (!formPurchaseCost || Number(formPurchaseCost) < 0) {
      setFormError('سعر الشراء الحالي يجب أن يكون رقماً صالحاً غير سالب');
      return;
    }
    if (!formWholesalePrice || Number(formWholesalePrice) < 0) {
      setFormError('سعر الجملة يجب أن يكون رقماً صالحاً غير سالب');
      return;
    }
    if (!formRetailPrice || Number(formRetailPrice) < 0) {
      setFormError('سعر القطاعي يجب أن يكون رقماً صالحاً غير سالب');
      return;
    }

    setIsSaving(true);
    try {
      if (editingProduct) {
        await productsApi.update(editingProduct.id, {
          name: formName.trim(),
          category_id: Number(formCategoryId),
          purchase_cost: formPurchaseCost,
          wholesale_price: formWholesalePrice,
          retail_price: formRetailPrice,
        });
        showToast('تم تحديث بيانات المنتج بنجاح', 'success');
      } else {
        await productsApi.create({
          name: formName.trim(),
          category_id: Number(formCategoryId),
          purchase_cost: formPurchaseCost,
          wholesale_price: formWholesalePrice,
          retail_price: formRetailPrice,
          initial_stock: Number(formInitialStock) || 0,
        });
        showToast('تمت إضافة المنتج وتوليد الباركود بنجاح', 'success');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ المنتج';
      setFormError(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (p: Product) => {
    try {
      await productsApi.toggleStatus(p.id, !p.is_active);
      showToast(p.is_active ? 'تم تعطيل المنتج' : 'تم تفعيل المنتج', 'info');
      fetchProducts();
    } catch {
      showToast('فشل تغيير حالة المنتج', 'error');
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'barcode',
      header: 'الباركود',
      width: '8rem',
      render: (p: Product) => (
        <span
          style={{
            fontFamily: 'var(--font-family-mono)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-primary-700)',
          }}
        >
          {p.barcode}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'اسم المنتج',
      render: (p: Product) => (
        <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{p.name}</span>
      ),
    },
    {
      key: 'category_name',
      header: 'الفئة',
      width: '9rem',
      render: (p: Product) => <span>{p.category_name ?? '-'}</span>,
    },
    {
      key: 'stock_quantity',
      header: 'الرصيد',
      width: '7rem',
      render: (p: Product) => (
        <Badge variant={p.stock_quantity > 0 ? 'success' : 'danger'} size="sm">
          {p.stock_quantity} قطعة
        </Badge>
      ),
    },
    {
      key: 'purchase_cost',
      header: 'سعر الشراء',
      width: '8rem',
      render: (p: Product) => <span style={{ fontFamily: 'var(--font-family-mono)' }}>{p.purchase_cost_formatted}</span>,
    },
    {
      key: 'wholesale_price',
      header: 'سعر الجملة',
      width: '8rem',
      render: (p: Product) => <span style={{ fontFamily: 'var(--font-family-mono)' }}>{p.wholesale_price_formatted}</span>,
    },
    {
      key: 'retail_price',
      header: 'سعر القطاعي',
      width: '8rem',
      render: (p: Product) => (
        <span style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--font-weight-bold)' }}>
          {p.retail_price_formatted}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'الحالة',
      width: '6rem',
      render: (p: Product) => (
        <Badge variant={p.is_active ? 'success' : 'neutral'} size="sm">
          {p.is_active ? 'نشط' : 'معطل'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'الإجراءات',
      width: '13rem',
      align: 'left',
      render: (p: Product) => (
        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/barcodes?productId=${p.id}`)}
            title="طباعة ملصق باركود لهذا المنتج"
          >
            🏷️ باركود
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenEditModal(p)}>
            تعديل
          </Button>
          <Button
            variant={p.is_active ? 'danger' : 'outline'}
            size="sm"
            onClick={() => handleToggleStatus(p)}
          >
            {p.is_active ? 'تعطيل' : 'تفعيل'}
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
            إدارة منتجات المعرض
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            تعريف قطع الأثاث، الأسعار، توليد الباركود، ومتابعة الأرصدة
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="outline" onClick={() => navigate('/barcodes')}>
            🏷️ طباعة ملصقات الباركود
          </Button>
          <Button variant="primary" onClick={handleOpenAddModal}>
            + إضافة منتج جديد
          </Button>
        </div>
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
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '16rem' }}>
          <Input
            placeholder="بحث بالاسم أو الباركود..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div style={{ width: '14rem' }}>
          <Select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'جميع الفئات' },
              ...categories.map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` })),
            ]}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            variant={selectedStatus === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectedStatus('all');
              setPage(1);
            }}
          >
            الكل
          </Button>
          <Button
            variant={selectedStatus === 'active' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectedStatus('active');
              setPage(1);
            }}
          >
            النشطة
          </Button>
          <Button
            variant={selectedStatus === 'inactive' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectedStatus('inactive');
              setPage(1);
            }}
          >
            المعطلة
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
            <Spinner size="lg" />
          </div>
        ) : !productsData || productsData.data.length === 0 ? (
          <EmptyState
            title="لا توجد منتجات مسجلة"
            description="لم يتم العثور على أي منتجات مطابقة لخيارات البحث."
          />
        ) : (
          <>
            <Table
              columns={columns}
              data={productsData.data}
              keyExtractor={(p) => p.id}
            />

            {/* Pagination Controls */}
            {productsData.meta && productsData.meta.last_page > 1 && (
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
                  إجمالي المنتجات: {productsData.meta.total} | الصفحة {productsData.meta.current_page} من {productsData.meta.last_page}
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
                    disabled={page >= productsData.meta.last_page}
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

      {/* Product Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSaving && setIsModalOpen(false)}
        title={editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {formError && <Alert type="error" message={formError} />}

          <Input
            label="اسم المنتج"
            placeholder="مثال: غرفة نوم كينج، ركنة مودرن 3×2"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            required
            autoFocus
          />

          <Select
            label="الفئة"
            value={formCategoryId}
            onChange={(e) => setFormCategoryId(e.target.value)}
            required
            options={[
              { value: '', label: 'اختر الفئة...' },
              ...categories.map((c) => ({ value: String(c.id), label: `${c.name} (كود: ${c.code})` })),
            ]}
          />

          {editingProduct && (
            <Input
              label="الباركود (ثابت ولا يمكن تعديله)"
              value={editingProduct.barcode}
              disabled
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <Input
              label="سعر الشراء الحالي (ج.م)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formPurchaseCost}
              onChange={(e) => setFormPurchaseCost(e.target.value)}
              required
            />
            <Input
              label="سعر الجملة (ج.م)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formWholesalePrice}
              onChange={(e) => setFormWholesalePrice(e.target.value)}
              required
            />
            <Input
              label="سعر القطاعي (ج.م)"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formRetailPrice}
              onChange={(e) => setFormRetailPrice(e.target.value)}
              required
            />
          </div>

          {!editingProduct && (
            <div>
              <Input
                label="الرصيد الافتتاحي بالمعرض (عدد القطع)"
                type="number"
                min="0"
                step="1"
                value={formInitialStock}
                onChange={(e) => setFormInitialStock(e.target.value)}
              />
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                سيتم قيد حركة مخزنية وارد افتتاحية بهذا الرصيد تلقائياً.
              </p>
            </div>
          )}

          {editingProduct && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
              ⚠️ تعديل سعر الشراء يؤثر على المبيعات المستقبلية فقط ولا يغير تكلفة أو أرباح الفواتير التاريخية السابقة.
            </p>
          )}

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
              {editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
