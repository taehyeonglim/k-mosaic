import { DeltaValue } from '@/components/ui/DeltaValue';
import { MetricValue } from '@/components/ui/MetricValue';
import { ko } from '@/content/ko';

export interface MetricCardItem {
  key: string;
  label: string;
  value: number | null;
  unit: 'count' | 'percent';
  delta?: number | null;
  deltaPct?: number | null;
  note?: string;
  display?: 'metric' | 'delta';
}

export interface MetricCardRowProps {
  items: MetricCardItem[];
}

export function MetricCardRow({ items }: MetricCardRowProps) {
  return (
    <section className="viz-grid" aria-label={items.map((item) => item.label).join(', ')}>
      {items.map((item) => (
        <article className="card viz-stat" data-key={item.key} data-unit={item.unit} key={item.key}>
          <p className="text-small text-[var(--km-color-text-muted)]">{item.label}</p>
          <div className="viz-stat-value">
            {item.display === 'delta' ? (
              <DeltaValue
                delta={item.delta !== undefined ? item.delta : item.value}
                deltaPct={item.deltaPct !== undefined ? item.deltaPct : null}
                unit={item.unit}
              />
            ) : (
              <MetricValue
                value={item.value}
                unit={item.unit}
                size="lg"
                missingLabel={ko.missing.ariaLabel}
              />
            )}
          </div>
          {item.display !== 'delta' && (item.delta !== undefined || item.deltaPct !== undefined) ? (
            <p className="text-small">
              <DeltaValue
                delta={item.delta !== undefined ? item.delta : null}
                deltaPct={item.deltaPct !== undefined ? item.deltaPct : null}
                unit={item.unit}
              />
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
