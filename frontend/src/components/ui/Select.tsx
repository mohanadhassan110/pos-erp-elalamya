import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, id, disabled, required, style, className = '', ...props }, ref) => {
    const selectId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%', ...style }}>
        {label && (
          <label
            htmlFor={selectId}
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              color: error ? 'var(--color-danger-600)' : 'var(--text-secondary)',
            }}
          >
            {label}
            {required && <span style={{ color: 'var(--color-danger-500)', marginRight: '0.25rem' }}>*</span>}
          </label>
        )}

        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          required={required}
          style={{
            width: '100%',
            height: '2.25rem',
            padding: '0.375rem 0.75rem',
            backgroundColor: disabled ? 'var(--bg-surface-subtle)' : 'var(--bg-surface)',
            border: `1px solid ${error ? 'var(--color-danger-500)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-base)',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          className={className}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {error && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-danger-600)' }} role="alert">
            {error}
          </span>
        )}

        {!error && helperText && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{helperText}</span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
