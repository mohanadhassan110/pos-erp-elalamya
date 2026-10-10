import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../providers/useAuth';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { ApiError } from '../../../types/api';
import logoWhite from '../../../assets/brand/logo-white.png';
import { LogIn } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [loginInput, setLoginInput] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/pos';

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
        device_name: 'shop-terminal',
      });
      navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.errors) {
          setFieldErrors(err.errors);
        }
      } else {
        setError('حدث خطأ أثناء الاتصال بالخادم، يرجى المحاولة ثانية');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: '#0B1220',
      }}
      dir="rtl"
    >
      <div style={{ width: '100%', maxWidth: '26rem' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img
            src={logoWhite}
            alt="معرض العالمية للمفروشات"
            style={{
              maxWidth: '240px',
              height: 'auto',
              margin: '0 auto 1rem',
              display: 'block',
            }}
          />
          <h1 style={{ color: '#ffffff', fontSize: '18px', fontWeight: 700, margin: 0 }}>
            معرض العالمية للمفروشات
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '0.25rem' }}>
            نظام إدارة المبيعات ونقاط البيع والمخزون
          </p>
        </div>

        {/* Login Form Card */}
        <Card style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && <Alert type="error" message={error} />}

            <Input
              id="login-input"
              name="login"
              label="اسم المستخدم"
              value={loginInput}
              onChange={(e) => setLoginInput(e.target.value)}
              placeholder="اسم المستخدم"
              required
              autoFocus
              error={fieldErrors['login']?.[0]}
            />

            <Input
              id="password-input"
              name="password"
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
              icon={<LogIn size={18} />}
              style={{ width: '100%', marginTop: '0.5rem', height: '48px' }}
            >
              تسجيل الدخول
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
