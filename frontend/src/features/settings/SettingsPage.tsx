import React, { useState, useEffect } from 'react';
import { settingsApi, type ShowroomSettings } from '../../services/api/settingsApi';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../app/providers/useToast';
import { Store, KeyRound, Activity } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { showToast } = useToast();

  // Showroom Info State
  const [showroom, setShowroom] = useState<ShowroomSettings | null>(null);
  const [phones, setPhones] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [tagline, setTagline] = useState<string>('');
  const [returnPolicy, setReturnPolicy] = useState<string>('');
  const [thankYouLine, setThankYouLine] = useState<string>('');
  const [isLoadingShowroom, setIsLoadingShowroom] = useState<boolean>(true);
  const [isSavingShowroom, setIsSavingShowroom] = useState<boolean>(false);
  const [showroomError, setShowroomError] = useState<string | null>(null);

  // Reports Password State
  const [reportsPassword, setReportsPassword] = useState<string>('');
  const [reportsPasswordConfirm, setReportsPasswordConfirm] = useState<string>('');
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // System Health State
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    database: string;
    timezone: string;
  } | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState<boolean>(true);

  // Active section tab
  const [activeTab, setActiveTab] = useState<'info' | 'password' | 'system'>('info');

  useEffect(() => {
    let active = true;

    // Load Showroom Settings
    settingsApi
      .getShowroom()
      .then((data) => {
        if (!active) return;
        setShowroom(data);
        setPhones(data.phones || '');
        setAddress(data.address || '');
        setTagline(data.tagline || '');
        setReturnPolicy(data.return_policy || '');
        setThankYouLine(data.thank_you_line || '');
      })
      .catch((err) => {
        if (active) setShowroomError(err?.message || 'تعذر تحميل إعدادات المعرض');
      })
      .finally(() => {
        if (active) setIsLoadingShowroom(false);
      });

    // Load System Health
    settingsApi
      .getHealth()
      .then((health) => {
        if (active) setHealthStatus(health);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setIsLoadingHealth(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSaveShowroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowroomError(null);
    setIsSavingShowroom(true);

    try {
      const res = await settingsApi.updateShowroom({
        phones: phones.trim() || undefined,
        address: address.trim() || undefined,
        tagline: tagline.trim() || undefined,
        return_policy: returnPolicy.trim() || undefined,
        thank_you_line: thankYouLine.trim() || undefined,
      });

      setShowroom(res.data);
      showToast('تم حفظ بيانات المعرض بنجاح', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ البيانات';
      setShowroomError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSavingShowroom(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (reportsPassword.length < 8) {
      setPasswordError('كلمة المرور يجب ألا تقل عن 8 أحرف');
      return;
    }

    if (reportsPassword !== reportsPasswordConfirm) {
      setPasswordError('كلمتا المرور غير متطابقتين');
      return;
    }

    setIsSavingPassword(true);

    try {
      await settingsApi.setReportsPassword(reportsPassword);
      setReportsPassword('');
      setReportsPasswordConfirm('');
      showToast('تم تحديث كلمة سر التقارير بنجاح', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تعيين كلمة السر';
      setPasswordError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div style={{ maxWidth: '64rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
          إعدادات النظام والمالك
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
          إدارة بيانات المعرض المطبوعة على الفواتير، كلمة سر التقارير، وحالة النظام
        </p>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('info')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            backgroundColor: activeTab === 'info' ? 'var(--color-navy-950)' : 'transparent',
            color: activeTab === 'info' ? '#FFFFFF' : 'var(--text-secondary)',
            fontWeight: activeTab === 'info' ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-base)',
          }}
        >
          <Store size={18} />
          <span>بيانات المعرض على الفاتورة</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('password')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            backgroundColor: activeTab === 'password' ? 'var(--color-navy-950)' : 'transparent',
            color: activeTab === 'password' ? '#FFFFFF' : 'var(--text-secondary)',
            fontWeight: activeTab === 'password' ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-base)',
          }}
        >
          <KeyRound size={18} />
          <span>كلمة سر التقارير</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            backgroundColor: activeTab === 'system' ? 'var(--color-navy-950)' : 'transparent',
            color: activeTab === 'system' ? '#FFFFFF' : 'var(--text-secondary)',
            fontWeight: activeTab === 'system' ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
            cursor: 'pointer',
            fontSize: 'var(--font-size-base)',
          }}
        >
          <Activity size={18} />
          <span>حالة النظام</span>
        </button>
      </div>

      {/* Tab 1: Showroom Info */}
      {activeTab === 'info' && (
        <Card title="بيانات المعرض الرسمية على الفاتورة (80 مم و A4)">
          {isLoadingShowroom ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Spinner size="md" />
            </div>
          ) : (
            <form onSubmit={handleSaveShowroom} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {showroomError && <Alert type="error" message={showroomError} />}

              {/* Fixed Showroom Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-secondary)' }}>
                  اسم المعرض (ثابت)
                </label>
                <div
                  style={{
                    padding: '0.625rem 0.875rem',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontWeight: 'var(--font-weight-bold)',
                    fontSize: 'var(--font-size-base)',
                  }}
                >
                  {showroom?.showroom_name || 'معرض العالمية للمفروشات'}
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  اسم المعرض مسجل ومعتمد رسمياً وفق الدستور التشغيلي ولا يمكن تغييره.
                </span>
              </div>

              {/* Phones */}
              <Input
                label="أرقام هواتف المعرض"
                value={phones}
                onChange={(e) => setPhones(e.target.value)}
                placeholder="مثال: 01003116622 - 01010498956"
                helperText="تظهر على الفاتورة المطبوعة. الحقول الفارغة تُحذف تلقائياً من الطباعة."
              />

              {/* Address */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-secondary)' }}>
                  عنوان المعرض
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="مثال: شارع مسجد النجار المتفرع من شارع بورسعيد، أمام عمارة قيبع بالمنصورة"
                  rows={2}
                  style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-base)',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Tagline */}
              <Input
                label="الشعار / الوصف المختصر"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="مثال: بيت المفروشات"
                helperText="يظهر أسفل اسم المعرض في رأس الفاتورة."
              />

              {/* Return Policy */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-secondary)' }}>
                  سياسة الاسترجاع والاستبدال المطبوعة
                </label>
                <textarea
                  value={returnPolicy}
                  onChange={(e) => setReturnPolicy(e.target.value)}
                  placeholder="مثال: الاسترجاع والاستبدال خلال 14 يومًا من تاريخ الفاتورة"
                  rows={2}
                  style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-size-base)',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Thank you line */}
              <Input
                label="عبارة الشكر وتذييل الفاتورة"
                value={thankYouLine}
                onChange={(e) => setThankYouLine(e.target.value)}
                placeholder="مثال: شكراً لتعاملكم مع معرض العالمية للمفروشات"
              />

              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '0.5rem' }}>
                <Button type="submit" variant="primary" size="md" isLoading={isSavingShowroom}>
                  حفظ بيانات المعرض
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* Tab 2: Reports Password */}
      {activeTab === 'password' && (
        <Card title="تعيين أو تغيير كلمة سر تقارير المبيعات والأرباح">
          <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '32rem' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              المالك يدخل للتقارير تلقائياً دون كلمة سر. الكاشير يحتاج إدخال كلمة السر لفتح شاشة التقارير مؤقتاً لمدة 15 دقيقة.
            </p>

            {passwordError && <Alert type="error" message={passwordError} />}

            <Input
              label="كلمة السر الجديدة"
              type="password"
              value={reportsPassword}
              onChange={(e) => setReportsPassword(e.target.value)}
              placeholder="••••••••"
              helperText="يجب ألا تقل عن 8 أحرف"
              required
            />

            <Input
              label="تأكيد كلمة السر"
              type="password"
              value={reportsPasswordConfirm}
              onChange={(e) => setReportsPasswordConfirm(e.target.value)}
              placeholder="••••••••"
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button type="submit" variant="primary" size="md" isLoading={isSavingPassword}>
                تحديث كلمة سر التقارير
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab 3: System Health */}
      {activeTab === 'system' && (
        <Card title="حالة الاتصال والتشغيل">
          {isLoadingHealth ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Spinner size="md" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '36rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)', color: 'var(--text-secondary)' }}>
                  حالة النظام
                </span>
                <Badge variant={healthStatus?.status === 'ok' ? 'success' : 'danger'}>
                  {healthStatus?.status === 'ok' ? 'متصل وجاهز للعمل' : 'غير متصل'}
                </Badge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)', color: 'var(--text-secondary)' }}>
                  قاعدة البيانات
                </span>
                <Badge variant={healthStatus?.database === 'connected' ? 'success' : 'danger'}>
                  {healthStatus?.database === 'connected' ? 'متصلة (MySQL)' : 'غير متصلة'}
                </Badge>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-medium)', color: 'var(--text-secondary)' }}>
                  المنطقة الزمنية المعتمدة
                </span>
                <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
                  توقيت القاهرة (Africa/Cairo)
                </span>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
