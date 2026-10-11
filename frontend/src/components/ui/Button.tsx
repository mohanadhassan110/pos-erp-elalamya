import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      icon,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      fontFamily: 'inherit',
      fontWeight: 'var(--font-weight-semibold)',
      borderRadius: 'var(--radius-md)',
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      transition: 'all var(--transition-fast)',
      border: '1px solid transparent',
      whiteSpace: 'nowrap',
      lineHeight: 1,
      userSelect: 'none',
      ...style,
    };

    const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
      sm: {
        padding: '0.375rem 0.75rem',
        fontSize: 'var(--font-size-xs, 12px)',
        minHeight: '36px',
        height: '36px',
      },
      md: {
        padding: '0.5rem 1rem',
        fontSize: 'var(--font-size-base, 14px)',
        minHeight: '44px',
        height: '44px',
      },
      lg: {
        padding: '0.75rem 1.5rem',
        fontSize: 'var(--font-size-lg, 16px)',
        minHeight: '56px',
        height: '56px',
        fontWeight: 'var(--font-weight-bold, 700)',
      },
    };

    const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
      primary: {
        backgroundColor: '#0B1220',
        color: '#FFFFFF',
        borderColor: '#0B1220',
      },
      secondary: {
        backgroundColor: '#FFFFFF',
        color: '#0B1220',
        borderColor: '#CBD5E1',
      },
      danger: {
        backgroundColor: '#DC2626',
        color: '#FFFFFF',
        borderColor: '#B91C1C',
      },
      outline: {
        backgroundColor: 'transparent',
        color: '#0B1220',
        borderColor: '#0B1220',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '#334155',
        borderColor: 'transparent',
      },
    };

    const disabledStyle: React.CSSProperties = (disabled || isLoading)
      ? {
          backgroundColor: '#E2E8F0',
          color: '#64748B',
          borderColor: '#CBD5E1',
          cursor: 'not-allowed',
          opacity: 1,
        }
      : {};

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        style={{
          ...baseStyle,
          ...sizeStyles[size],
          ...variantStyles[variant],
          ...disabledStyle,
        }}
        className={className}
        {...props}
      >
        {isLoading ? (
          <span
            style={{
              display: 'inline-block',
              width: '1rem',
              height: '1rem',
              border: '2px solid currentColor',
              borderRightColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }}
            aria-hidden="true"
          />
        ) : (
          icon && <span style={{ display: 'inline-flex' }}>{icon}</span>
        )}
        <span>{children}</span>
      </button>
    );
  }
);

Button.displayName = 'Button';
