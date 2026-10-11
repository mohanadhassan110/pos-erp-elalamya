import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { ToastContext, type Toast, type ToastType } from './toastContextDef';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 'var(--z-toast, 1080)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
          maxWidth: '24rem',
          width: 'calc(100% - 3rem)',
          pointerEvents: 'none',
        }}
        role="region"
        aria-label="الإشعارات"
      >
        {toasts.map((toast) => {
          const accentColor =
            toast.type === 'success'
              ? '#16A34A'
              : toast.type === 'error'
              ? '#DC2626'
              : toast.type === 'warning'
              ? '#D97706'
              : '#0B1220';

          return (
            <div
              key={toast.id}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                border: '1px solid #CBD5E1',
                borderRight: `5px solid ${accentColor}`,
                padding: '0.875rem 1.125rem',
                borderRadius: 'var(--radius-md, 6px)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                pointerEvents: 'auto',
                direction: 'rtl',
              }}
              role="status"
            >
              <span style={{ lineHeight: 1.4 }}>{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748B',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0.25rem',
                  flexShrink: 0,
                }}
                aria-label="إغلاق الإشعار"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
