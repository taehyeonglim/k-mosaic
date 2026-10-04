import { InlineBar } from '@/components/charts/InlineBar';
import { ko } from '@/content/ko';
import { barDomain } from '@/lib/visualization/bar';
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
  /** 선택한(비교 중인) 지역 — 해당 행을 강조 보라로 표시한다. */
  highlightRegions?: readonly string[];
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
  highlightRegions = [],
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
  // 막대는 0 기준선에서 출발한다. 증감처럼 음수가 섞이면 기준선이 트랙 안쪽으로 들어온다.
  const domain = barDomain(rankedRows.map((row) => row.value));
  const noDataTitleId = `ranking-no-data-title-${metric}`;

  return (
    <section className="space-y-3" aria-label={metricLabel(metric)}>
      {disclaimer ? (
        <p className="text-small text-text-muted" role="note">
          {disclaimer}
        </p>
      ) : null}
      <div className="table-responsive">
        <table className="table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-9 text-end">
                {ko.ranking.rank}
              </th>
              <th scope="col">{ko.ranking.region}</th>
              <th scope="col" className="w-[58%] text-end">
                {ko.ranking.value}
              </th>
            </tr>
          </thead>
          <tbody>
            {rankedRows.map((row) => {
              const isSelected = highlightRegions.includes(row.regionCode);
              return (
                <tr
                  key={row.regionCode}
                  data-selected={isSelected || undefined}
                  data-tied={row.isTied || undefined}
                >
                  {/* 순위는 우열이 아니므로 상위권을 굵게 강조하지 않는다. */}
                  <td className="text-end tabular-nums text-text-muted">{row.rank}</td>
                  <td className={isSelected ? 'font-semibold' : undefined}>
                    <span className="inline-flex items-baseline gap-1.5">
                      {isSelected ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="size-2 shrink-0 rounded-[0.1875rem] bg-accent2"
                          />
                          <span className="sr-only">{ko.ranking.selectedMark}</span>
                        </>
                      ) : null}
                      {row.label}
                    </span>
                  </td>
                  <td>
                    {/* 한 가지 색 — 값의 크기는 길이가 전한다. 선택한 지역만 강조 보라. */}
                    <InlineBar
                      value={row.value}
                      domain={domain}
                      label={formatRankingValue(row.value, metric)}
                      selected={isSelected}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {missingRows.length > 0 ? (
        <section aria-labelledby={noDataTitleId} className="space-y-2">
          <h3 id={noDataTitleId} className="text-sm font-semibold">
            {ko.ranking.noData}
          </h3>
          <ul className="text-sm">
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
