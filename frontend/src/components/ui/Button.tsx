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
      opacity: disabled || isLoading ? 0.65 : 1,
      transition: 'background-color var(--transition-fast), border-color var(--transition-fast)',
      border: '1px solid transparent',
      whiteSpace: 'nowrap',
      lineHeight: 1,
      ...style,
    };

    const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
      sm: {
        padding: '0.375rem 0.625rem',
        fontSize: 'var(--font-size-xs)',
        height: '1.875rem',
      },
      md: {
        padding: '0.5rem 0.875rem',
        fontSize: 'var(--font-size-base)',
        height: '2.25rem',
      },
      lg: {
        padding: '0.625rem 1.125rem',
        fontSize: 'var(--font-size-lg)',
        height: '2.625rem',
      },
    };

    const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--color-primary-600)',
        color: '#ffffff',
        borderColor: 'var(--color-primary-700)',
      },
      secondary: {
        backgroundColor: 'var(--color-slate-100)',
        color: 'var(--color-slate-800)',
        borderColor: 'var(--color-slate-300)',
      },
      danger: {
        backgroundColor: 'var(--color-danger-600)',
        color: '#ffffff',
        borderColor: 'var(--color-danger-700)',
      },
      outline: {
        backgroundColor: 'transparent',
        color: 'var(--color-primary-600)',
        borderColor: 'var(--color-primary-500)',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--color-slate-700)',
        borderColor: 'transparent',
      },
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        style={{
          ...baseStyle,
          ...sizeStyles[size],
          ...variantStyles[variant],
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
