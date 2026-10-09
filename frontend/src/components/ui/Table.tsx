import React from 'react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  align?: 'right' | 'center' | 'left';
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  emptyMessage?: string;
  dense?: boolean;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'لا توجد بيانات متاحة حالياً',
  dense = true,
}: TableProps<T>) {
  const cellPadding = dense ? '0.5rem 0.75rem' : '0.875rem 1rem';

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'right',
          fontSize: 'var(--font-size-base)',
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--bg-surface-subtle)',
              borderBottom: '2px solid var(--border-subtle)',
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: cellPadding,
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  textAlign: col.align || 'right',
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '2.5rem',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={keyExtractor(row)}
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: index % 2 === 1 ? 'var(--color-slate-50)' : 'transparent',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: cellPadding,
                      color: 'var(--text-primary)',
                      textAlign: col.align || 'right',
                    }}
                  >
                    {col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
