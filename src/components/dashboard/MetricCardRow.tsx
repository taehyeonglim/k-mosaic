import { formatCount, formatDelta, formatRate } from '@/lib/visualization/format';
import { ko } from '@/content/ko';

export interface MetricCardItem {
  key: string;
  label: string;
  value: number | null;
  unit: 'count' | 'percent';
  delta?: number | null;
  deltaPct?: number | null;
  note?: string;
}

export interface MetricCardRowProps {
  items: MetricCardItem[];
}

function formatMetricValue(item: MetricCardItem): string {
  return item.unit === 'count'
    ? formatCount(item.value, ko.missing.value)
    : formatRate(item.value, ko.missing.value);
}

function formatPercentDelta(value: number | null): string {
  const formatted = formatDelta(value, ko.missing.value);
  return value === null ? formatted : `${formatted}%`;
}

function formatAbsoluteDelta(value: number | null, unit: MetricCardItem['unit']): string {
  const formatted = formatDelta(value, ko.missing.value);
  return value === null ? formatted : `${formatted}${unit === 'count' ? '명' : '%'}`;
}

export function MetricCardRow({ items }: MetricCardRowProps) {
  return (
    <section className="viz-grid" aria-label={items.map((item) => item.label).join(', ')}>
      {items.map((item) => (
        <article className="card viz-stat" data-key={item.key} data-unit={item.unit} key={item.key}>
          <p className="text-small text-[var(--km-color-text-muted)]">{item.label}</p>
          <p className="viz-stat-value tabular-nums">{formatMetricValue(item)}</p>
          {item.delta !== undefined || item.deltaPct !== undefined ? (
            <p className="tabular-nums">
              {item.delta !== undefined ? formatAbsoluteDelta(item.delta, item.unit) : null}
              {item.delta !== undefined && item.deltaPct !== undefined ? ' · ' : null}
              {item.deltaPct !== undefined ? formatPercentDelta(item.deltaPct) : null}
            </p>
          ) : null}
          {item.note ? (
            <p className="text-small text-[var(--km-color-text-muted)]">{item.note}</p>
          ) : null}
        </article>
      ))}
    </section>
  );
}
