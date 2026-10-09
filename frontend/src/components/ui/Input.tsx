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
              height: '2.25rem',
              padding: '0.375rem 0.75rem',
              paddingRight: rightIcon ? '2.25rem' : '0.75rem',
              paddingLeft: leftIcon ? '2.25rem' : '0.75rem',
              backgroundColor: disabled ? 'var(--bg-surface-subtle)' : 'var(--bg-surface)',
              border: `1px solid ${error ? 'var(--color-danger-500)' : 'var(--border-default)'}`,
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-base)',
              direction: 'inherit',
              outline: 'none',
              transition: 'border-color var(--transition-fast)',
            }}
            className={className}
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
