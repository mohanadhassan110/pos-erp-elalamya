import React, { useState, useEffect } from 'react';
import { useAuth } from '../../providers/useAuth';
import { authApi } from '../../../services/api/auth';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { MoneyDisplay } from '../../../components/ui/MoneyDisplay';
import type { ApiHealthData } from '../../../types/api';

export const SystemFoundationPage: React.FC = () => {
  const { user, isOwner } = useAuth();
  const [health, setHealth] = useState<ApiHealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);
  const [ownerCheckResult, setOwnerCheckResult] = useState<string | null>(null);
  const [ownerCheckError, setOwnerCheckError] = useState<string | null>(null);
  const [cashierCheckResult, setCashierCheckResult] = useState<string | null>(null);

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const data = await authApi.getHealth();
      setHealth(data);
    } catch (e: unknown) {
      const err = e as Error;
      setOwnerCheckError(err.message);
    } finally {
      setHealthLoading(false);
    }
  };

  const testOwnerEndpoint = async () => {
    setOwnerCheckResult(null);
    setOwnerCheckError(null);
    try {
      const res = await authApi.checkOwnerAccess();
      setOwnerCheckResult(`تم بنجاح! الصلاحية: ${res.role} (نطاق المالك مؤكد)`);
    } catch (e: unknown) {
      const err = e as Error;
      setOwnerCheckError(err.message);
    }
  };

  const testCashierEndpoint = async () => {
    setCashierCheckResult(null);
    try {
      const res = await authApi.checkCashierAccess();
      setCashierCheckResult(`تم بنجاح! الصلاحية: ${res.role} (نطاق العمليات التشغيلية مؤكد)`);
    } catch (e: unknown) {
      const err = e as Error;
      setCashierCheckResult(`خطأ: ${err.message}`);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      setHealthLoading(true);
      try {
        const data = await authApi.getHealth();
        if (isMounted) setHealth(data);
      } catch (e: unknown) {
        if (isMounted) {
          const err = e as Error;
          setOwnerCheckError(err.message);
        }
      } finally {
        if (isMounted) setHealthLoading(false);
      }
    };
    void run();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '64rem', margin: '0 auto' }}>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-extrabold)' }}>
          لوحة فحص وتأكيد أساس النظام (المرحلة 1)
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
          تأكيد جاهزية البنية التحتية الخلفية والأمامية لنظام العالمية ERP/POS وفق دستور المشروع AGENTS.md.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '1.25rem' }}>
        {/* Backend Health Card */}
        <Card
          title="حالة الخادم الخلفي (API Health)"
          actions={
            <Button size="sm" variant="secondary" onClick={fetchHealth} isLoading={healthLoading}>
              تحديث
            </Button>
          }
        >
          {health ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: 'var(--font-size-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>الحالة التشغيلية:</span>
                <Badge variant="success">{health.status}</Badge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>إصدار الـ API:</span>
                <span className="font-mono">{health.api_version}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>المنطقة الزمنية:</span>
                <span className="font-mono">{health.timezone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>اللغة الأساسية:</span>
                <span>{health.locale} (العربية)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>قاعدة البيانات:</span>
                <Badge variant={health.database === 'connected' ? 'success' : 'danger'}>
                  {health.database}
                </Badge>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>جاري جلب حالة الخادم...</p>
          )}
        </Card>

        {/* Current User Session Card */}
        <Card title="بيانات الجلسة والصلاحيات">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: 'var(--font-size-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>المستخدم الحالي:</span>
              <strong>{user?.name}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>اسم الدخول:</span>
              <span className="font-mono">{user?.username}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>الدور التشغيلي:</span>
              <Badge variant={isOwner ? 'primary' : 'warning'}>{user?.role_label}</Badge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>صلاحية التقارير:</span>
              <Badge variant={user?.capabilities?.reports_view ? 'success' : 'danger'}>
                {user?.capabilities?.reports_view ? 'متاحة (مالك)' : 'محجوبة (كاشير)'}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Authorization Foundation Verification */}
      <Card title="فحص جدار الحماية والصلاحيات من الخادم الخلفي">
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '1rem' }}>
          يتم التحقق من الصلاحيات خادمياً (Server-Side) عبر Middleware و Laravel Gates وليس مجرد إخفاء أزرار في الواجهة.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Button variant="primary" onClick={testOwnerEndpoint}>
            فحص نقطة وصول المالك (/api/v1/system/owner-check)
          </Button>

          <Button variant="secondary" onClick={testCashierEndpoint}>
            فحص نقطة وصول العمليات المشتركة (/api/v1/system/cashier-check)
          </Button>
        </div>

        {ownerCheckResult && <Alert type="success" message={ownerCheckResult} />}
        {ownerCheckError && <Alert type="error" message={ownerCheckError} />}
        {cashierCheckResult && <Alert type="info" message={cashierCheckResult} style={{ marginTop: '0.5rem' }} />}
      </Card>

      {/* Financial Precision Demonstration */}
      <Card title="قواعد الدقة المالية (AGENTS.md Section 9)">
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '1rem' }}>
          النظام يستخدم دقة عشرية ثابتة (DECIMAL 15,2) ولا يسمح أبداً بالأعداد العائمة (Floating Point) للأموال، والكميات أعداد صحيحة دائماً.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>إجمالي مبيعات نموذجي:</span>
            <div style={{ marginTop: '0.25rem', fontSize: 'var(--font-size-xl)' }}>
              <MoneyDisplay amount="34500.00" colored />
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>مصروفات نموذجية:</span>
            <div style={{ marginTop: '0.25rem', fontSize: 'var(--font-size-xl)' }}>
              <MoneyDisplay amount="-1250.75" colored />
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>ربح تاريخي مجمد:</span>
            <div style={{ marginTop: '0.25rem', fontSize: 'var(--font-size-xl)' }}>
              <MoneyDisplay amount="7800.25" colored />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
