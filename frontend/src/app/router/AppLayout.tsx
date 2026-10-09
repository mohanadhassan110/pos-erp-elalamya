import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/useAuth';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

export const AppLayout: React.FC = () => {
  const { user, isOwner, logout } = useAuth();
  const navigate = useNavigate();
  const [cairoTime, setCairoTime] = useState<string>('');
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCairoTime(
        now.toLocaleTimeString('ar-EG', {
          timeZone: 'Africa/Cairo',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navItems = [
    { to: '/system-check', label: 'فحص أساس النظام', isOwnerOnly: false, icon: '⚡' },
    { to: '/categories', label: 'فئات الأصناف', isOwnerOnly: false, icon: '🏷️' },
    { to: '/products', label: 'دليل المنتجات', isOwnerOnly: false, icon: '🛋️' },
    { to: '/customers', label: 'العملاء والحسابات', isOwnerOnly: false, icon: '👥' },
    { to: '/suppliers', label: 'الموردين والحسابات', isOwnerOnly: false, icon: '🏢' },
    { to: '/stock-receiving', label: 'استلام بضاعة', isOwnerOnly: false, icon: '📥' },
    { to: '/inventory', label: 'إدارة المخزون', isOwnerOnly: false, icon: '📦' },
    { to: '/pos', label: 'نقطة البيع (POS)', isOwnerOnly: false, icon: '🛒' },
    { to: '/invoices', label: 'فواتير المبيعات', isOwnerOnly: false, icon: '📄' },
    { to: '/returns', label: 'مرتجع واستبدال', isOwnerOnly: false, icon: '🔄' },
    { to: '/barcodes', label: 'طباعة الباركود', isOwnerOnly: false, icon: '🏷️' },
    { to: '/expenses', label: 'سجل المصروفات', isOwnerOnly: false, icon: '💰' },
    { to: '/reports', label: 'التقارير والأرباح', isOwnerOnly: true, icon: '📊' },
    { to: '/settings', label: 'إعدادات النظام', isOwnerOnly: true, icon: '⚙️' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Top Application Bar */}
      <header
        style={{
          height: '3.5rem',
          backgroundColor: 'var(--color-slate-900)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.25rem',
          borderBottom: '1px solid var(--color-slate-800)',
          zIndex: 'var(--z-fixed, 1030)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🛋️</span>
            <span style={{ fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-lg)' }}>
              العالمية ERP/POS
            </span>
          </div>
          <span style={{ color: 'var(--color-slate-400)', fontSize: 'var(--font-size-xs)' }}>|</span>
          <span style={{ color: 'var(--color-slate-300)', fontSize: 'var(--font-size-xs)' }}>
            معرض الأثاث والمفروشات
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Cairo Clock */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              backgroundColor: 'var(--color-slate-800)',
              padding: '0.25rem 0.625rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-family-mono)',
            }}
          >
            <span style={{ color: 'var(--color-slate-400)' }}>القاهرة:</span>
            <span>{cairoTime}</span>
          </div>

          {/* User & Role Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Badge variant={isOwner ? 'primary' : 'warning'} size="sm">
              {user?.role_label || 'كاشير'}
            </Badge>
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
              {user?.name}
            </span>
          </div>

          {/* Logout Action */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            isLoading={isLoggingOut}
            style={{ color: 'var(--color-slate-300)' }}
          >
            تسجيل الخروج
          </Button>
        </div>
      </header>

      {/* Main Body: RTL Sidebar + Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar Navigation */}
        <aside
          style={{
            width: '16rem',
            backgroundColor: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1rem 0',
          }}
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0 0.75rem' }}>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-bold)',
                color: 'var(--text-muted)',
                padding: '0.5rem 0.5rem 0.25rem',
              }}
            >
              القوائم التشغيلية
            </span>

            {navItems.map((item) => {
              const isLockedForCashier = item.isOwnerOnly && !isOwner;

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-base)',
                    fontWeight: isActive ? 'var(--font-weight-bold)' : 'var(--font-weight-medium)',
                    backgroundColor: isActive ? 'var(--color-primary-50)' : 'transparent',
                    color: isActive
                      ? 'var(--color-primary-800)'
                      : isLockedForCashier
                      ? 'var(--text-disabled)'
                      : 'var(--text-secondary)',
                    textDecoration: 'none',
                    opacity: isLockedForCashier ? 0.7 : 1,
                  })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.isOwnerOnly && (
                    <Badge variant={isOwner ? 'primary' : 'neutral'} size="sm">
                      مالك فقط
                    </Badge>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div
            style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-muted)',
            }}
          >
            <div>الوضع التشغيلي: <strong style={{ color: 'var(--text-primary)' }}>متصل</strong></div>
            <div style={{ marginTop: '0.25rem' }}>قاعدة البيانات: MySQL</div>
          </div>
        </aside>

        {/* Content Viewport */}
        <main style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>

      {/* Operational Footer Bar */}
      <footer
        style={{
          height: '2rem',
          backgroundColor: 'var(--color-slate-100)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.25rem',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--text-muted)',
        }}
      >
        <span>العالمية ERP/POS — المرحلة 1 (الأساس الهندسي والتشغيلي)</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>المنطقة الزمنية: Africa/Cairo</span>
          <span>الاتصال: /api/v1</span>
        </div>
      </footer>
    </div>
  );
};
