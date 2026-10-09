import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../providers/useAuth';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { ApiError } from '../../../types/api';

export const LoginPage: React.FC = () => {
  const [loginInput, setLoginInput] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/system-check';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!loginInput.trim()) {
      setError('يرجى إدخال اسم المستخدم أو البريد الإلكتروني');
      return;
    }

    if (!password) {
      setError('يرجى إدخال كلمة المرور');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({
        login: loginInput.trim(),
        password,
        device_name: 'web-browser-pos',
      });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.errors) {
          setFieldErrors(err.errors);
        }
      } else {
        setError('حدث خطأ غير متوقع أثناء تسجيل الدخول');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setLoginInput(u);
    setPassword(p);
    setError(null);
    setFieldErrors({});
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: 'var(--color-slate-900)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '28rem' }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🛋️</div>
          <h1 style={{ color: '#ffffff', fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-extrabold)' }}>
            العالمية ERP/POS
          </h1>
          <p style={{ color: 'var(--color-slate-400)', fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
            نظام إدارة معارض الأثاث والمفروشات — تسجيل الدخول
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && <Alert type="error" message={error} />}

            <Input
              label="اسم المستخدم أو البريد الإلكتروني"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="مثال: owner أو cashier"
              required
              autoFocus
              error={fieldErrors['login']?.[0]}
            />

            <Input
              label="كلمة المرور"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              error={fieldErrors['password']?.[0]}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              تسجيل الدخول للنظام
            </Button>
          </form>

          {/* Quick Demo Credentials Assistant */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontWeight: 'var(--font-weight-semibold)' }}>
              حسابات تجريبية سريعة للفحص:
            </span>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleQuickFill('owner', 'password123')}
                style={{
                  padding: '0.375rem 0.625rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'inherit',
                }}
              >
                <Badge variant="primary" size="sm">
                  مالك
                </Badge>
                <span>owner / password123</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFill('cashier', 'password123')}
                style={{
                  padding: '0.375rem 0.625rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'inherit',
                }}
              >
                <Badge variant="warning" size="sm">
                  كاشير
                </Badge>
                <span>cashier / password123</span>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
