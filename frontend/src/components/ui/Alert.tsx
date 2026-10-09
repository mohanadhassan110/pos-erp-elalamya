import React from 'react';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps {
  type?: AlertType;
  title?: string;
  message?: React.ReactNode;
  errors?: string[];
  onClose?: () => void;
  style?: React.CSSProperties;
}

export const Alert: React.FC<AlertProps> = ({
  type = 'info',
  title,
  message,
  errors,
  onClose,
  style,
}) => {
  const typeStyles: Record<AlertType, { bg: string; border: string; text: string; title: string }> = {
    info: {
      bg: '#f0f9ff',
      border: '#bae6fd',
      text: '#0369a1',
      title: '#0c4a6e',
    },
    success: {
      bg: 'var(--color-success-50)',
      border: 'var(--color-success-200)',
      text: 'var(--color-success-700)',
      title: 'var(--color-success-700)',
    },
    warning: {
      bg: 'var(--color-warning-50)',
      border: 'var(--color-warning-200)',
      text: 'var(--color-warning-700)',
      title: 'var(--color-warning-700)',
    },
    error: {
      bg: 'var(--color-danger-50)',
      border: 'var(--color-danger-200)',
      text: 'var(--color-danger-700)',
      title: 'var(--color-danger-700)',
    },
  };

  const current = typeStyles[type];

  return (
    <div
      style={{
        backgroundColor: current.bg,
        border: `1px solid ${current.border}`,
        borderRadius: 'var(--radius-md)',
        padding: '0.75rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        position: 'relative',
        fontSize: 'var(--font-size-sm)',
        color: current.text,
        ...style,
      }}
      role="alert"
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.5rem',
            left: '0.5rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: current.text,
            lineHeight: 1,
            padding: '0.25rem',
          }}
          aria-label="إغلاق التنبيه"
        >
          ✕
        </button>
      )}

      {title && (
        <strong style={{ fontWeight: 'var(--font-weight-bold)', color: current.title }}>
          {title}
        </strong>
      )}

      {message && <div>{message}</div>}

      {errors && errors.length > 0 && (
        <ul style={{ paddingRight: '1.25rem', marginTop: '0.25rem' }}>
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
