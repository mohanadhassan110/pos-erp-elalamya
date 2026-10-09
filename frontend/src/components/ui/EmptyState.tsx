import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 1.5rem',
        textAlign: 'center',
      }}
    >
      {icon && (
        <div
          style={{
            color: 'var(--color-slate-400)',
            marginBottom: '1rem',
            fontSize: '2.5rem',
            lineHeight: 1,
          }}
        >
          {icon}
        </div>
      )}
      <h4 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}>
        {title}
      </h4>
      {description && (
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: '0.25rem', maxWidth: '24rem' }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div style={{ marginTop: '1.25rem' }}>
          <Button variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

export interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'حدث خطأ غير متوقع أثناء معالجة الطلب',
  onRetry,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div style={{ color: 'var(--color-danger-500)', fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
      <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-danger-700)' }}>
        {message}
      </h4>
      {onRetry && (
        <div style={{ marginTop: '1rem' }}>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            إعادة المحاولة
          </Button>
        </div>
      )}
    </div>
  );
};
