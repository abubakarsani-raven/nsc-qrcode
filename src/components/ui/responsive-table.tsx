'use client';

import { ReactNode } from 'react';
import { Card, CardBody } from './card';

type Column<T> = {
  key: keyof T;
  label: string;
  render?: (value: unknown, row: T) => ReactNode;
  width?: string;
  className?: string;
  hideOnMobile?: boolean;
};

type ResponsiveTableProps<T extends { id?: string | number }> = {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  loading?: boolean;
};

/**
 * Responsive table that shows as cards on mobile, table on desktop
 */
export function ResponsiveTable<T extends { id?: string | number }>({
  columns,
  data,
  onRowClick,
  emptyState = <p className="text-center py-8 text-neutral-500">No data</p>,
  loading = false,
}: ResponsiveTableProps<T>) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-neutral-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <>{emptyState}</>;
  }

  const desktopColumns = columns.filter(c => !c.hideOnMobile);
  const primaryColumn = columns.find(c => c.key === 'name') || columns[0];

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block rounded-lg border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              {desktopColumns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-6 py-3 text-left text-sm font-semibold text-neutral-700"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={row.id || idx}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-neutral-200 ${
                  onRowClick ? 'cursor-pointer hover:bg-neutral-50 transition-colors' : ''
                }`}
              >
                {desktopColumns.map((col) => (
                  <td key={String(col.key)} className={`px-6 py-4 text-sm ${col.className || ''}`}>
                    {col.render
                      ? col.render(row[col.key], row)
                      : String(row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {data.map((row, idx) => (
          <Card
            key={row.id || idx}
            onClick={() => onRowClick?.(row)}
            hoverable={!!onRowClick}
          >
            <CardBody className="space-y-3">
              {/* Primary field - prominent */}
              <div>
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  {primaryColumn.label}
                </p>
                <p className="text-lg font-semibold text-neutral-900 mt-1">
                  {primaryColumn.render
                    ? primaryColumn.render(row[primaryColumn.key], row)
                    : String(row[primaryColumn.key] ?? '-')}
                </p>
              </div>

              {/* Other fields - grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                {columns
                  .filter((c) => c.key !== primaryColumn.key)
                  .map((col) => (
                    <div key={String(col.key)}>
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                        {col.label}
                      </p>
                      <p className="text-sm text-neutral-700 mt-1 truncate">
                        {col.render
                          ? col.render(row[col.key], row)
                          : String(row[col.key] ?? '-')}
                      </p>
                    </div>
                  ))}
              </div>

              {/* Action hint */}
              {onRowClick && (
                <p className="text-xs text-neutral-400 pt-2">Tap to view details →</p>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
