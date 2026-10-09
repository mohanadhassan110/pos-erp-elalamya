import React, { useState, useEffect } from 'react';
import { inventoryApi } from '../../services/api/inventoryApi';
import { categoriesApi } from '../../services/api/categoriesApi';
import type { InventoryItem, InventoryResponse, Category } from '../../types/domain';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, type Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Alert } from '../../components/ui/Alert';
import { EmptyState } from '../../components/ui/EmptyState';

export const InventoryPage: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [stockStatus, setStockStatus] = useState<string>('');
  const [isActiveFilter, setIsActiveFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    let active = true;
    categoriesApi.getCategories({ per_page: 100 })
      .then((res) => {
        if (active) {
          setCategories(res.data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    inventoryApi.getInventory({
      search: search.trim() || undefined,
      category_id: categoryId ? Number(categoryId) : undefined,
      stock_status: stockStatus ? (stockStatus as 'in_stock' | 'out_of_stock') : undefined,
      is_active: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      page,
      per_page: 25,
    })
      .then((res) => {
        if (active) {
          setInventory(res);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const error = err as { message?: string };
          setErrorMessage(error.message || 'فشل في تحميل بيانات جرد المخزون');
          setIsLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [search, categoryId, stockStatus, isActiveFilter, page]);

  const handleResetFilters = () => {
    setSearch('');
    setCategoryId('');
    setStockStatus('');
    setIsActiveFilter('');
    setPage(1);
  };

  const columns: Column<InventoryItem>[] = [
    {
      key: 'barcode',
      header: 'الباركود',
      render: (item: InventoryItem) => (
        <span
          style={{
            fontFamily: 'var(--font-family-mono)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-primary-700)',
          }}
        >
          {item.barcode}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'اسم المنتج',
      render: (item: InventoryItem) => (
        <div>
          <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
            {item.name}
          </span>
          {!item.is_active && (
            <Badge variant="neutral" size="sm" style={{ marginRight: '0.5rem' }}>
              معطل
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'category_name',
      header: 'الفئة',
      render: (item: InventoryItem) => (
        <span style={{ color: 'var(--text-secondary)' }}>{item.category_name || '—'}</span>
      ),
    },
    {
      key: 'current_stock',
      header: 'الرصيد المتاح بالمخزن',
      render: (item: InventoryItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              fontFamily: 'var(--font-family-mono)',
              fontWeight: 'var(--font-weight-bold)',
              fontSize: 'var(--font-size-base)',
              color: item.current_stock > 0 ? 'var(--color-success-700)' : 'var(--color-danger-700)',
            }}
          >
            {item.current_stock}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>قطعة</span>
          <Badge variant={item.is_in_stock ? 'success' : 'danger'} size="sm">
            {item.is_in_stock ? 'متوفر' : 'نفد'}
          </Badge>
        </div>
      ),
    },
    {
      key: 'current_purchase_cost',
      header: 'تكلفة الشراء الحالية',
      render: (item: InventoryItem) => (
        <span style={{ fontFamily: 'var(--font-family-mono)' }}>
          {item.current_purchase_cost_formatted}
        </span>
      ),
    },
    {
      key: 'stock_valuation',
      header: 'إجمالي تقييم الرصيد الحالي',
      render: (item: InventoryItem) => (
        <span
          style={{
            fontFamily: 'var(--font-family-mono)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-primary-800)',
          }}
        >
          {item.stock_valuation_formatted}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header and Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
            إدارة ورؤية المخزون
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            رؤية أرصدة المنتجات بالمعرض وتقييم المخزون الحالي (الرصيد المتاح × تكلفة الشراء الحالية).
          </p>
        </div>
      </div>

      {/* Valuation Summary Statistics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 'var(--font-weight-semibold)' }}>
                إجمالي عدد القطع بالمخزن (للمنتجات المعروضة)
              </span>
              <div
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-primary-800)',
                  marginTop: '0.25rem',
                  fontFamily: 'var(--font-family-mono)',
                }}
              >
                {inventory?.summary.total_quantity?.toLocaleString('ar-EG') ?? '0'} قطعة
              </div>
            </div>
            <div style={{ fontSize: '2rem' }}>📦</div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 'var(--font-weight-semibold)' }}>
                إجمالي قيمة المخزون الحالي (بسعر التكلفة)
              </span>
              <div
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-success-700)',
                  marginTop: '0.25rem',
                  fontFamily: 'var(--font-family-mono)',
                }}
              >
                {inventory?.summary.total_valuation_formatted ?? '0.00 ج.م'}
              </div>
            </div>
            <div style={{ fontSize: '2rem' }}>💰</div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Input
              label="بحث بالاسم أو الباركود"
              placeholder="اكتب اسم المنتج أو الباركود..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div style={{ width: '180px' }}>
            <Select
              label="الفئة"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'جميع الفئات' },
                ...categories.map((c) => ({ value: String(c.id), label: `${c.name} (${c.code})` })),
              ]}
            />
          </div>

          <div style={{ width: '160px' }}>
            <Select
              label="حالة التوفر"
              value={stockStatus}
              onChange={(e) => {
                setStockStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'الكل' },
                { value: 'in_stock', label: 'متوفر بالمخزن' },
                { value: 'out_of_stock', label: 'نفد من المخزن' },
              ]}
            />
          </div>

          <div style={{ width: '140px' }}>
            <Select
              label="حالة الصنف"
              value={isActiveFilter}
              onChange={(e) => {
                setIsActiveFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'الكل' },
                { value: 'true', label: 'نشط' },
                { value: 'false', label: 'معطل' },
              ]}
            />
          </div>

          <div>
            <Button variant="outline" onClick={handleResetFilters}>
              إعادة ضبط
            </Button>
          </div>
        </div>
      </Card>

      {/* Error Message */}
      {errorMessage && (
        <Alert type="error" title="خطأ أثناء جلب المخزون" message={errorMessage} />
      )}

      {/* Inventory Table */}
      <Card>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Spinner size="lg" />
          </div>
        ) : !inventory || inventory.data.length === 0 ? (
          <EmptyState
            title="لا توجد بيانات مخزون مطابقة"
            description="لم يتم العثور على أي منتجات مطابقة لشروط البحث أو الفلاتر المحددة."
          />
        ) : (
          <div>
            <Table
              columns={columns}
              data={inventory.data}
              keyExtractor={(item) => item.id}
            />

            {/* Pagination Controls */}
            {inventory.meta.last_page > 1 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                  عرض صفحة {inventory.meta.current_page} من {inventory.meta.last_page} (إجمالي{' '}
                  {inventory.meta.total} منتج)
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    السابق
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= inventory.meta.last_page}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    التالي
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
