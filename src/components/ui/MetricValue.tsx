import type { ReactNode } from 'react';

export interface MetricValueProps {
  value: number | null;
  unit: 'count' | 'percent';
  size: 'lg' | 'md' | 'sm';
  missingLabel: string;
}

const sizeClassNames = {
  lg: 'text-4xl font-semibold leading-none sm:text-5xl',
  md: 'text-2xl font-semibold leading-tight sm:text-3xl',
  sm: 'text-base font-semibold leading-6 sm:text-lg',
} satisfies Record<MetricValueProps['size'], string>;
const countUnit = String.fromCodePoint(0xba85);

function formatMetricValue(value: number, unit: MetricValueProps['unit']) {
  if (unit === 'count') {
    return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value)}${countUnit}`;
  }

  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: 'unit',
    unit: 'percent',
    unitDisplay: 'short',
  }).format(value);
}

export function MetricValue({ value, unit, size, missingLabel }: MetricValueProps): ReactNode {
  const className = `tabular-nums ${sizeClassNames[size]}`;

  if (value === null) {
    return (
      <span aria-label={missingLabel} className={className} data-missing="true">
        —
      </span>
    );
  }

  return <span className={className}>{formatMetricValue(value, unit)}</span>;
}
