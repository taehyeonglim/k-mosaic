import type { ReactNode } from 'react';

export interface MetricValueProps {
  value: number | null;
  unit: 'count' | 'percent';
  size: 'lg' | 'md' | 'sm';
  missingLabel: string;
}

// 단독으로 놓이는 큰 숫자는 비례폭이다. tabular-nums 는 표·축 눈금에만 쓴다.
const sizeClassNames = {
  lg: 'text-4xl font-bold leading-none tracking-tight sm:text-5xl',
  md: 'text-2xl font-bold leading-tight tracking-tight sm:text-3xl',
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
  // 숫자는 자릿수 중간에서 줄을 바꾸지 않는다.
  const className = `whitespace-nowrap ${sizeClassNames[size]}`;

  if (value === null) {
    return (
      <span aria-label={missingLabel} className={className} data-missing="true">
        —
      </span>
    );
  }

  return <span className={className}>{formatMetricValue(value, unit)}</span>;
}
