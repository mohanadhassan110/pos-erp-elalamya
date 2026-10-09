import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../providers/useAuth';
import type { UserRole } from '../../types/auth';
import { Spinner } from '../../components/ui/Spinner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: '1rem',
          backgroundColor: 'var(--bg-app)',
        }}
      >
        <Spinner size="lg" />
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
          جاري التحقق من الجلسة...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export interface RequireRoleProps {
  roles: UserRole[];
  children: React.ReactNode;
}

export const RequireRole: React.FC<RequireRoleProps> = ({ roles, children }) => {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return (
      <div style={{ padding: '2rem', maxWidth: '36rem', margin: '3rem auto' }}>
        <Card title="وصول غير مصرح به">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--color-danger-700)', fontSize: 'var(--font-size-base)', lineHeight: 1.6 }}>
              عذراً، هذا القسم مخصص لصلاحية ({roles.map((r) => (r === 'owner' ? 'المالك' : 'الكاشير')).join(' أو ')}) فقط.
              ليس لديك الصلاحية الكافية لعرض هذه الصفحة.
            </p>
            <div>
              <Button variant="secondary" onClick={() => window.history.back()}>
                العودة للصفحة السابقة
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
