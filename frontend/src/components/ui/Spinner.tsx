import React from 'react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  style?: React.CSSProperties;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = 'var(--color-primary-600)',
  style,
}) => {
  const sizeMap = {
    sm: '1rem',
    md: '1.5rem',
    lg: '2.25rem',
  };

  return (
    <div
      style={{
        display: 'inline-block',
        width: sizeMap[size],
        height: sizeMap[size],
        border: `3px solid ${color}`,
        borderRightColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        ...style,
      }}
      role="status"
      aria-label="جاري التحميل..."
    />
  );
};

export interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1.25rem',
  borderRadius = 'var(--radius-sm)',
  style,
}) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: 'var(--color-slate-200)',
        animation: 'pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
};
