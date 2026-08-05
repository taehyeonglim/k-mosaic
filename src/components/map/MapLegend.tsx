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
      const lower = boundaries[index];
      const upper = boundaries[index + 1];
      return lower === undefined || upper === undefined
        ? null
        : {
            lower,
            upper,
            sample: lower === upper ? lower : (lower + upper) / 2,
          };
    }).filter((segment): segment is LegendSegment => segment !== null);
  }

  const lower = boundaries[0];
  const upper = boundaries[boundaries.length - 1];
  if (lower === undefined || upper === undefined) {
    return [];
  }

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
      <ol className="flex flex-wrap gap-x-3 gap-y-2" aria-label={metricLabel}>
        {segments.map((segment, index) => (
          <li
            className="flex items-center gap-1.5"
            key={`${segment.lower}-${segment.upper}-${index}`}
          >
            <span
              className="inline-block h-4 w-4 shrink-0 rounded-sm border border-[var(--km-color-border)]"
              style={{ backgroundColor: scale.color(segment.sample) }}
              aria-hidden="true"
            />
            <span className="text-small tabular-nums">
              {formatValue(segment.lower)}
              <span aria-hidden="true">–</span>
              {formatValue(segment.upper)}
            </span>
          </li>
        ))}
        <li className="flex items-center gap-1.5">
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
