import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  /** Cell renderer; receives the row. */
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyLabel?: string;
  /** Optional per-row actions rendered in a trailing column. */
  actions?: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  emptyLabel = "No results",
  actions,
}: DataTableProps<T>) {
  const colSpan = columns.length + (actions ? 1 : 0);

  return (
    <div className="overflow-x-auto rounded-box border border-base-content/10">
      <table className="table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.header} className={col.className}>
                {col.header}
              </th>
            ))}
            {actions && <th className="text-end">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={colSpan} className="text-center text-base-content/60 py-8">
                <span className="loading loading-spinner loading-sm" /> Loading…
              </td>
            </tr>
          )}
          {!loading && error && (
            <tr>
              <td colSpan={colSpan} className="text-center text-error py-8">
                {error}
              </td>
            </tr>
          )}
          {!loading && !error && rows.length === 0 && (
            <tr>
              <td colSpan={colSpan} className="text-center text-base-content/60 py-8">
                {emptyLabel}
              </td>
            </tr>
          )}
          {!loading &&
            !error &&
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((col) => (
                  <td key={col.header} className={col.className}>
                    {col.cell(row)}
                  </td>
                ))}
                {actions && <td className="text-end whitespace-nowrap">{actions(row)}</td>}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
