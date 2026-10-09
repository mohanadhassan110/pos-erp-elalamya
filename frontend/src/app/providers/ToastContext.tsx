import React, { useState, useCallback } from 'react';
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
          bottom: '1.25rem',
          left: '1.25rem',
          zIndex: 'var(--z-toast, 1080)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxWidth: '24rem',
          width: '100%',
          pointerEvents: 'none',
        }}
        role="region"
        aria-label="الإشعارات"
      >
        {toasts.map((toast) => {
          const bg =
            toast.type === 'success'
              ? 'var(--color-success-700)'
              : toast.type === 'error'
              ? 'var(--color-danger-700)'
              : toast.type === 'warning'
              ? 'var(--color-warning-700)'
              : 'var(--color-slate-800)';

          return (
            <div
              key={toast.id}
              style={{
                backgroundColor: bg,
                color: '#ffffff',
                padding: '0.625rem 1rem',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                pointerEvents: 'auto',
              }}
              role="status"
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  padding: '0.25rem',
                  opacity: 0.8,
                }}
                aria-label="إغلاق الإشعار"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
