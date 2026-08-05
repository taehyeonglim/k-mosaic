import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import { ko } from '@/content/ko';
import type { ReactNode } from 'react';

export interface ChartDataTableColumn {
  key: string;
  label: string;
  numeric?: boolean;
}

export interface ChartDataTableRow {
  id: string | number;
  [key: string]: ReactNode;
}

export interface ChartDataTableProps {
  caption: string;
  columns: readonly ChartDataTableColumn[];
  rows: readonly ChartDataTableRow[];
  visuallyHidden?: boolean;
}

export function ChartDataTable({
  caption,
  columns,
  rows,
  visuallyHidden = false,
}: ChartDataTableProps) {
  const primitiveColumns: DataTableColumn[] = columns.map((column) => ({
    key: column.key,
    label: column.label,
    numeric: column.numeric,
  }));
  const table = (
    <DataTable
      caption={caption}
      columns={primitiveColumns}
      rows={[...rows]}
      emptyLabel={ko.missing.noResults}
    />
  );

  return visuallyHidden ? <VisuallyHidden>{table}</VisuallyHidden> : table;
}
