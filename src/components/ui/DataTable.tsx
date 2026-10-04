import type { ReactNode } from 'react';

export interface DataTableColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export interface DataTableProps {
  caption: string;
  columns: DataTableColumn[];
  rows: Record<string, ReactNode>[];
  emptyLabel: string;
}

export function DataTable({ caption, columns, rows, emptyLabel }: DataTableProps) {
  return (
    <table className="w-full table-fixed border-collapse text-sm text-text">
      <caption className="mb-2 text-left text-small text-text-muted">{caption}</caption>
      <thead>
        <tr className="border-b border-border-strong/60">
          {columns.map((column) => (
            <th
              className={`break-words px-3 py-2 text-small font-medium text-text-muted ${column.numeric ? 'text-right' : 'text-left'}`}
              key={column.key}
              scope="col"
            >
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              className="px-3 py-8 text-center text-text-muted"
              colSpan={Math.max(columns.length, 1)}
            >
              {emptyLabel}
            </td>
          </tr>
        ) : (
          rows.map((row, rowIndex) => (
            <tr
              className="border-b border-border last:border-b-0 hover:bg-surface-muted"
              key={rowIndex}
            >
              {columns.map((column) => (
                <td
                  className={`break-words px-3 py-2.5 align-top ${column.numeric ? 'text-right tabular-nums' : 'text-left'}`}
                  key={column.key}
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
