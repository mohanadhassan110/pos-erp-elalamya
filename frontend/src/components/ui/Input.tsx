import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      disabled,
      required,
      id,
      className = '',
      style,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', ...style }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              color: error ? 'var(--color-danger-600)' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            {label}
            {required && <span style={{ color: 'var(--color-danger-500)' }}>*</span>}
          </label>
        )}

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {rightIcon && (
            <span
              style={{
                position: 'absolute',
                right: '0.625rem',
                display: 'inline-flex',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              {rightIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            style={{
              width: '100%',
              minHeight: '44px',
              height: '44px',
              padding: '0.5rem 0.875rem',
              paddingRight: rightIcon ? '2.5rem' : '0.875rem',
              paddingLeft: leftIcon ? '2.5rem' : '0.875rem',
              backgroundColor: disabled ? '#F1F5F9' : '#FFFFFF',
              border: `1px solid ${error ? '#DC2626' : '#CBD5E1'}`,
              borderRadius: 'var(--radius-md, 6px)',
              color: 'var(--text-primary, #0F172A)',
              fontSize: '15px',
              direction: 'inherit',
              outline: 'none',
              transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
            }}
            className={`al-input ${className}`}
            {...props}
          />

          {leftIcon && (
            <span
              style={{
                position: 'absolute',
                left: '0.625rem',
                display: 'inline-flex',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            >
              {leftIcon}
            </span>
          )}
        </div>

        {error && (
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-danger-600)',
              fontWeight: 'var(--font-weight-medium)',
            }}
            role="alert"
          >
            {error}
          </span>
        )}

        {!error && helperText && (
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--text-muted)',
            }}
          >
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
