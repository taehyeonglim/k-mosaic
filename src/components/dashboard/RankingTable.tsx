import { ko } from '@/content/ko';
import { formatCount, formatDelta, formatRate } from '@/lib/visualization/format';

export type RankingTableMetric = 'count' | 'rate' | 'deltaAbs' | 'deltaPct';

export interface RankingTableRow {
  rank: number;
  regionCode: string;
  label: string;
  value: number | null;
  isTied: boolean;
}

export interface RankingTableProps {
  metric: RankingTableMetric;
  rows: RankingTableRow[];
  excludedRegions: { regionCode: string; label: string }[];
  caption: string;
  disclaimer?: string;
}

function formatRankingValue(value: number | null, metric: RankingTableMetric): string {
  if (metric === 'count') {
    return formatCount(value, ko.missing.value);
  }
  if (metric === 'rate') {
    return formatRate(value, ko.missing.value);
  }
  const formatted = formatDelta(value, ko.missing.value);
  return value === null ? formatted : `${formatted}${metric === 'deltaPct' ? '%' : '명'}`;
}

function metricLabel(metric: RankingTableMetric): string {
  return {
    count: ko.ranking.count,
    rate: ko.ranking.rate,
    deltaAbs: ko.ranking.deltaAbs,
    deltaPct: ko.ranking.deltaPct,
  }[metric];
}

export function RankingTable({
  metric,
  rows,
  excludedRegions,
  caption,
  disclaimer,
}: RankingTableProps) {
  const rankedRows = rows
    .filter((row) => row.value !== null)
    .slice()
    .sort(
      (first, second) =>
        first.rank - second.rank || first.regionCode.localeCompare(second.regionCode),
    );
  const missingByCode = new Map<string, { regionCode: string; label: string }>();
  excludedRegions.forEach((region) => missingByCode.set(region.regionCode, region));
  rows
    .filter((row) => row.value === null)
    .forEach((row) =>
      missingByCode.set(row.regionCode, { regionCode: row.regionCode, label: row.label }),
    );
  const missingRows = Array.from(missingByCode.values()).sort((first, second) =>
    first.regionCode.localeCompare(second.regionCode),
  );
  const maxAbsValue = rankedRows.reduce(
    (maximum, row) => Math.max(maximum, Math.abs(row.value ?? 0)),
    0,
  );
  const noDataTitleId = `ranking-no-data-title-${metric}`;

  return (
    <section className="space-y-3" aria-label={metricLabel(metric)}>
      {disclaimer ? <p role="note">{disclaimer}</p> : null}
      <div className="table-responsive">
        <table className="table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="text-end">
                {ko.ranking.rank}
              </th>
              <th scope="col">{ko.ranking.region}</th>
              <th scope="col" className="text-end">
                {ko.ranking.value}
              </th>
            </tr>
          </thead>
          <tbody>
            {rankedRows.map((row) => (
              <tr key={row.regionCode} data-tied={row.isTied || undefined}>
                <td
                  className={`text-end tabular-nums ${row.rank >= 1 && row.rank <= 3 ? 'font-semibold' : ''}`}
                >
                  {row.rank}
                </td>
                <td>{row.label}</td>
                <td className="text-end tabular-nums">
                  <span className="block">{formatRankingValue(row.value, metric)}</span>
                  <span
                    aria-hidden="true"
                    className="mt-1 block h-1 overflow-hidden rounded-full bg-[var(--km-color-border)]/45"
                  >
                    <span
                      className="block h-full rounded-full bg-[var(--km-map-count-5)]"
                      style={{
                        width:
                          maxAbsValue === 0
                            ? '0%'
                            : `${Math.min((Math.abs(row.value ?? 0) / maxAbsValue) * 100, 100)}%`,
                      }}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {missingRows.length > 0 ? (
        <section aria-labelledby={noDataTitleId} className="space-y-2">
          <h3 id={noDataTitleId} className="font-medium">
            {ko.ranking.noData}
          </h3>
          <ul>
            {missingRows.map((region) => (
              <li className="flex items-baseline justify-between gap-4" key={region.regionCode}>
                <span>{region.label}</span>
                <span className="tabular-nums">{ko.missing.value}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
