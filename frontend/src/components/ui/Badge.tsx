import React from 'react';

export type BadgeVariant = 'primary' | 'success' | 'danger' | 'warning' | 'neutral' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  style,
  className = '',
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
    primary: {
      backgroundColor: 'var(--color-primary-50)',
      color: 'var(--color-primary-800)',
      border: '1px solid var(--color-primary-200)',
    },
    success: {
      backgroundColor: 'var(--color-success-50)',
      color: 'var(--color-success-700)',
      border: '1px solid var(--color-success-200)',
    },
    danger: {
      backgroundColor: 'var(--color-danger-50)',
      color: 'var(--color-danger-700)',
      border: '1px solid var(--color-danger-200)',
    },
    warning: {
      backgroundColor: 'var(--color-warning-50)',
      color: 'var(--color-warning-700)',
      border: '1px solid var(--color-warning-200)',
    },
    neutral: {
      backgroundColor: 'var(--color-slate-100)',
      color: 'var(--color-slate-700)',
      border: '1px solid var(--color-slate-300)',
    },
    info: {
      backgroundColor: '#f0f9ff',
      color: '#0369a1',
      border: '1px solid #bae6fd',
    },
  };

  const sizeStyles = {
    sm: {
      padding: '0.125rem 0.375rem',
      fontSize: 'var(--font-size-xs)',
      borderRadius: 'var(--radius-sm)',
    },
    md: {
      padding: '0.25rem 0.5rem',
      fontSize: 'var(--font-size-sm)',
      borderRadius: 'var(--radius-md)',
    },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontWeight: 'var(--font-weight-medium)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      className={className}
      {...props}
    >
      {children}
    </span>
  );
};
