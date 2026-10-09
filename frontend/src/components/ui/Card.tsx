import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  dense?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  actions,
  footer,
  dense = false,
  style,
  className = '',
  ...props
}) => {
  const padding = dense ? '0.75rem 1rem' : '1.25rem 1.5rem';

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
      className={className}
      {...props}
    >
      {(title || actions) && (
        <div
          style={{
            padding,
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            {typeof title === 'string' ? (
              <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)' }}>{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{actions}</div>}
        </div>
      )}

      <div style={{ padding, flex: 1 }}>{children}</div>

      {footer && (
        <div
          style={{
            padding: dense ? '0.5rem 1rem' : '0.75rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-surface-subtle)',
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
};
