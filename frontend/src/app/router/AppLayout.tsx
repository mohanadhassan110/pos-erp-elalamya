import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/useAuth';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatLiveTime } from '../../utils/formatters';
import {
  ShoppingCart,
  FileText,
  Package,
  Tags,
  ArrowDownToLine,
  Layers,
  Barcode,
  Users,
  Building2,
  BarChart3,
  Settings,
  LogOut,
  Clock,
  User as UserIcon,
  Menu,
} from 'lucide-react';

interface NavGroup {
  heading: string;
  items: {
    to: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    isOwnerOnly?: boolean;
  }[];
}

export const AppLayout: React.FC = () => {
  const { user, isOwner, logout } = useAuth();
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
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

  const navGroups: NavGroup[] = [
    {
      heading: 'المبيعات',
      items: [
        { to: '/pos', label: 'نقطة البيع (POS)', icon: ShoppingCart },
        { to: '/invoices', label: 'الفواتير والمرتجعات', icon: FileText },
      ],
    },
    {
      heading: 'المخزون',
      items: [
        { to: '/products', label: 'دليل المنتجات', icon: Package },
        { to: '/categories', label: 'فئات الأصناف', icon: Tags },
        { to: '/stock-receiving', label: 'استلام بضاعة', icon: ArrowDownToLine },
        { to: '/inventory', label: 'حركة المخزون', icon: Layers },
        { to: '/barcodes', label: 'طباعة الباركود', icon: Barcode },
      ],
    },
    {
      heading: 'العملاء والموردين',
      items: [
        { to: '/customers', label: 'العملاء والحسابات', icon: Users },
        { to: '/suppliers', label: 'الموردين والحسابات', icon: Building2 },
      ],
    },
    {
      heading: 'التقارير',
      items: [
        { to: '/reports', label: 'التقارير والأرباح', icon: BarChart3 },
      ],
    },
    ...(isOwner
      ? [
          {
            heading: 'الإدارة',
            items: [
              { to: '/settings', label: 'إعدادات النظام', icon: Settings, isOwnerOnly: true },
            ],
          },
        ]
      : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
      {/* Top Application Bar — Deep Navy (#0B1220) */}
      <header
        style={{
          height: '3.75rem',
          backgroundColor: 'var(--color-navy-950, #0B1220)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.25rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          zIndex: 100,
        }}
      >
        {/* Right (Start side in RTL): Logo & Fixed Showroom Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
            style={{
              display: 'none',
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px',
            }}
            className="md-mobile-menu-btn"
            title="القائمة"
          >
            <Menu size={22} />
          </button>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: '16px', color: '#ffffff', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
              معرض العالمية للمفروشات
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.2 }}>
              نظام إدارة المبيعات ونقاط البيع والمخزون
            </span>
          </div>
        </div>

        {/* Left (End side in RTL): Clock, User Role Badge, Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Live Cairo Clock */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              padding: '0.375rem 0.625rem',
              borderRadius: 'var(--radius-sm, 4px)',
              fontSize: '13px',
              fontVariantNumeric: 'tabular-nums',
              color: '#F8FAFC',
              direction: 'ltr',
            }}
          >
            <Clock size={14} style={{ color: '#94A3B8' }} />
            <span>{formatLiveTime(currentTime)}</span>
          </div>

          {/* User info & Role badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <UserIcon size={16} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', lineHeight: 1.2 }}>
                {user?.name}
              </span>
              <Badge variant={isOwner ? 'warning' : 'primary'} size="sm">
                {isOwner ? 'المالك' : 'كاشير'}
              </Badge>
            </div>
          </div>

          {/* Logout Action */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            isLoading={isLoggingOut}
            icon={<LogOut size={16} />}
            style={{
              color: '#CBD5E1',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              height: '36px',
            }}
          >
            خروج
          </Button>
        </div>
      </header>

      {/* Main Body: Right Sidebar + Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Right Sidebar Navigation */}
        <aside
          style={{
            width: '15.5rem',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            borderLeft: '1px solid var(--border-subtle, #E2E8F0)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '1rem 0',
            overflowY: 'auto',
          }}
        >
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0 0.75rem' }}>
            {navGroups.map((group) => (
              <div key={group.heading} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: 'var(--text-muted, #64748B)',
                    padding: '0.25rem 0.5rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {group.heading}
                </span>

                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5625rem 0.75rem',
                        borderRadius: 'var(--radius-md, 6px)',
                        fontSize: '14px',
                        fontWeight: isActive ? 700 : 500,
                        backgroundColor: isActive ? 'var(--color-navy-950, #0B1220)' : 'transparent',
                        color: isActive ? '#FFFFFF' : 'var(--text-secondary, #334155)',
                        textDecoration: 'none',
                        transition: 'background-color 120ms ease, color 120ms ease',
                      })}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <Icon size={18} />
                        <span>{item.label}</span>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          <div
            style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid var(--border-subtle, #E2E8F0)',
              fontSize: '12px',
              color: 'var(--text-muted, #64748B)',
              textAlign: 'center',
            }}
          >
            <span>معرض العالمية للمفروشات</span>
          </div>
        </aside>

        {/* Content Viewport */}
        <main
          style={{
            flex: 1,
            padding: '1.25rem 1.5rem',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-app, #F8FAFC)',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
