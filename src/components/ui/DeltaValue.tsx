import ko from '@/content/ko';
import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

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

// 방향은 장식이다 — 부호(+/−)가 값에 이미 들어 있다. 증가·감소에 색을 입히지 않는다.
function getDirection(delta: number): IconName {
  if (delta > 0) return 'arrow-up';
  if (delta < 0) return 'arrow-down';
  return 'arrow-right';
}

export function DeltaValue({ delta, deltaPct, unit }: DeltaValueProps): ReactNode {
  if (delta === null && deltaPct === null) {
    return (
      <span aria-label={ko.missing.ariaLabel} className="text-text-muted" data-missing="true">
        —
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-text">
      {delta === null ? (
        <span aria-label={ko.missing.ariaLabel} data-missing="true">
          —
        </span>
      ) : (
        <span className="inline-flex items-center gap-[0.2em]">
          <Icon name={getDirection(delta)} size="0.78em" strokeWidth={2.6} />
          <span>{formatSignedValue(delta, unit)}</span>
        </span>
      )}
      {deltaPct === null ? null : (
        <span className="text-sm font-medium text-text-muted">
          ({formatSignedPercent(deltaPct)})
        </span>
      )}
    </span>
  );
}
