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

        <div style={{ position: 'relative', width: '100%' }}>
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            style={{
              width: '100%',
              minHeight: '44px',
              height: '44px',
              padding: '0.5rem 0.875rem',
              paddingLeft: '2rem',
              backgroundColor: disabled ? '#F1F5F9' : '#FFFFFF',
              border: `1px solid ${error ? '#DC2626' : '#CBD5E1'}`,
              borderRadius: 'var(--radius-md, 6px)',
              color: 'var(--text-primary, #0F172A)',
              fontSize: '15px',
              outline: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              transition: 'border-color var(--transition-fast)',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
            className={`al-select ${className}`}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {/* Custom SVG dropdown chevron */}
          <div
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#64748B',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>

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
