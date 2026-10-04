import { legendSegments, type ColorScale } from '@/lib/visualization/scale';

export interface MapLegendProps {
  scale: ColorScale;
  metricLabel: string;
  formatValue(v: number | null): string;
  missingLabel: string;
}

const TICK_CLASS =
  'absolute top-full mt-1 whitespace-nowrap text-[0.6875rem] leading-none tabular-nums text-text-muted';

/**
 * 단계 범례 — 7단계 색 띠와 경계 눈금, 결측 표시.
 *
 * 구간마다 범위 글자를 다 적으면 좁은 화면에서 서로 겹친다. 화면에는 경계 눈금만 두고
 * (좁으면 양 끝만), 구간별 범위는 화면낭독기용으로 목록 항목 안에 남긴다.
 */
export function MapLegend({ scale, metricLabel, formatValue, missingLabel }: MapLegendProps) {
  const segments = legendSegments(scale);
  const lastIndex = segments.length - 1;

  return (
    <div className="space-y-1.5">
      <p className="text-small font-semibold text-text">{metricLabel}</p>
      <ol
        aria-label={metricLabel}
        className="grid grid-cols-[repeat(7,minmax(0,1fr))_auto] items-start pb-5"
      >
        {segments.map((segment, index) => (
          <li className="relative min-w-0" data-legend-step={segment.step} key={segment.step}>
            <span
              aria-hidden="true"
              className={`block h-3 ${index === 0 ? 'rounded-l-[0.25rem]' : 'border-l border-surface'} ${index === lastIndex ? 'rounded-r-[0.25rem]' : ''}`}
              style={{ backgroundColor: segment.color }}
            />
            <span className="sr-only">
              {formatValue(segment.lower)}–{formatValue(segment.upper)}
            </span>
            <span
              aria-hidden="true"
              className={`${TICK_CLASS} left-0 ${index === 0 ? '' : 'hidden -translate-x-1/2 sm:block'}`}
              data-legend-tick=""
            >
              {formatValue(segment.lower)}
            </span>
            {index === lastIndex ? (
              <span aria-hidden="true" className={`${TICK_CLASS} right-0`} data-legend-tick="">
                {formatValue(segment.upper)}
              </span>
            ) : null}
          </li>
        ))}
        <li className="col-start-8 ml-4 flex min-w-max items-center gap-1.5 self-start">
          <span
            aria-hidden="true"
            className="inline-block size-3 shrink-0 rounded-[0.1875rem]"
            style={{
              backgroundColor: scale.missingColor,
              backgroundImage:
                'repeating-linear-gradient(135deg, transparent 0 3px, currentColor 3px 4.5px)',
              color: 'var(--km-color-missing-stroke, currentColor)',
            }}
          />
          <span className="text-[0.6875rem] leading-3 text-text-muted">{missingLabel}</span>
        </li>
      </ol>
    </div>
  );
}
