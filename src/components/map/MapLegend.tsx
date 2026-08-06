import type { ColorScale } from '@/lib/visualization/scale';

export interface MapLegendProps {
  scale: ColorScale;
  metricLabel: string;
  formatValue(v: number | null): string;
  missingLabel: string;
  kind: 'quantile' | 'sequential';
}

interface LegendSegment {
  lower: number;
  upper: number;
  sample: number;
}

function segmentsFor(scale: ColorScale, kind: MapLegendProps['kind']): LegendSegment[] {
  const boundaries = scale.breaks();
  if (boundaries.length < 2) {
    return [];
  }

  if (kind === 'quantile') {
    return Array.from({ length: boundaries.length - 1 }, (_, index) => {
      const first = boundaries[index];
      const second = boundaries[index + 1];
      return first === undefined || second === undefined
        ? null
        : {
            lower: Math.min(first, second),
            upper: Math.max(first, second),
            sample: (first + second) / 2,
          };
    }).filter((segment): segment is LegendSegment => segment !== null);
  }

  const first = boundaries[0];
  const last = boundaries[boundaries.length - 1];
  if (first === undefined || last === undefined) {
    return [];
  }
  const lower = Math.min(first, last);
  const upper = Math.max(first, last);

  return Array.from({ length: 7 }, (_, index) => {
    const start = lower + ((upper - lower) * index) / 7;
    const end = lower + ((upper - lower) * (index + 1)) / 7;
    return {
      lower: start,
      upper: end,
      sample: (start + end) / 2,
    };
  });
}

export function MapLegend({ scale, metricLabel, formatValue, missingLabel, kind }: MapLegendProps) {
  const segments = segmentsFor(scale, kind);

  return (
    <div className="space-y-2" aria-label={metricLabel}>
      <div className="font-medium">{metricLabel}</div>
      <ol
        className="grid min-w-0 grid-cols-[repeat(7,minmax(0,1fr))_auto] items-start gap-y-2"
        aria-label={metricLabel}
      >
        {segments.map((segment, index) => (
          <li className="min-w-0" key={`${segment.lower}-${segment.upper}-${index}`}>
            <span
              className={`block h-3 border border-[var(--km-color-border)] ${index === 0 ? 'rounded-l-sm' : '-ml-px'} ${index === segments.length - 1 ? 'rounded-r-sm' : ''}`}
              style={{ backgroundColor: scale.color(segment.sample) }}
              aria-hidden="true"
            />
            <span className="mt-1 block break-all text-center text-small leading-tight tabular-nums">
              {formatValue(segment.lower)}
              <span>–</span>
              {formatValue(segment.upper)}
            </span>
          </li>
        ))}
        <li
          className="ml-3 flex min-w-max items-center gap-1.5 self-start"
          style={{ gridColumn: `${segments.length + 1}` }}
        >
          <span
            className="inline-block h-4 w-4 shrink-0 rounded-sm border"
            style={{
              backgroundColor: scale.missingColor,
              backgroundImage:
                'repeating-linear-gradient(135deg, transparent 0 4px, currentColor 4px 6px)',
              color: 'var(--km-color-missing-stroke, currentColor)',
            }}
            aria-hidden="true"
          />
          <span className="text-small">{missingLabel}</span>
        </li>
      </ol>
    </div>
  );
}
