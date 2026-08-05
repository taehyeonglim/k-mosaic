import ko from '@/content/ko';
import type { ReactNode } from 'react';

export interface DeltaValueProps {
  delta: number | null;
  deltaPct: number | null;
  unit: 'count' | 'percent';
}
const countUnit = String.fromCodePoint(0xba85);

function formatSignedValue(value: number, unit: DeltaValueProps['unit']) {
  if (unit === 'count') {
    return `${new Intl.NumberFormat('ko-KR', {
      maximumFractionDigits: 0,
      signDisplay: 'always',
    }).format(value)}${countUnit}`;
  }

  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    signDisplay: 'always',
    style: 'unit',
    unit: 'percent',
    unitDisplay: 'short',
  }).format(value);
}

function formatSignedPercent(value: number) {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    signDisplay: 'always',
    style: 'unit',
    unit: 'percent',
    unitDisplay: 'short',
  }).format(value);
}

function getDirection(delta: number) {
  if (delta > 0) return '↑';
  if (delta < 0) return '↓';
  return '→';
}

export function DeltaValue({ delta, deltaPct, unit }: DeltaValueProps): ReactNode {
  if (delta === null && deltaPct === null) {
    return (
      <span
        aria-label={ko.missing.ariaLabel}
        className="tabular-nums text-text-muted"
        data-missing="true"
      >
        —
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 items-baseline gap-1.5 tabular-nums text-text">
      {delta === null ? (
        <span aria-label={ko.missing.ariaLabel} data-missing="true">
          —
        </span>
      ) : (
        <span className="inline-flex items-baseline gap-1">
          <span aria-hidden="true" className="font-semibold">
            {getDirection(delta)}
          </span>
          <span>{formatSignedValue(delta, unit)}</span>
        </span>
      )}
      {deltaPct === null ? null : (
        <span className="text-sm text-text-muted">({formatSignedPercent(deltaPct)})</span>
      )}
    </span>
  );
}
