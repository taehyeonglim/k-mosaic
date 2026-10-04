import { ko } from '@/content/ko';
import { barDomain, barGeometry } from '@/lib/visualization/bar';
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
  const baseline = barGeometry(0, domain).offset;
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
              const bar = barGeometry(row.value ?? 0, domain);
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
                    <span className="flex items-center gap-3">
                      <span aria-hidden="true" className="relative h-2.5 min-w-6 flex-1">
                        {domain.min < 0 ? (
                          <span
                            className="absolute inset-y-[-0.1875rem] w-px bg-border-strong"
                            style={{ left: `${baseline}%` }}
                          />
                        ) : null}
                        {/* 한 가지 색 — 값의 크기는 길이가 전한다. 선택한 지역만 강조 보라.
                            값 쪽 끝만 둥글게, 기준선 쪽은 각지게. */}
                        <span
                          className={`absolute inset-y-0 ${isSelected ? 'bg-accent2' : 'bg-ramp-5'} ${
                            bar.direction === 'negative' ? 'rounded-l-[4px]' : 'rounded-r-[4px]'
                          }`}
                          data-direction={bar.direction}
                          data-ranking-bar=""
                          style={{ left: `${bar.offset}%`, width: `${bar.length}%` }}
                        />
                      </span>
                      <span
                        className="w-[4.75rem] shrink-0 text-end tabular-nums sm:w-[5.25rem]"
                        data-ranking-value=""
                      >
                        {formatRankingValue(row.value, metric)}
                      </span>
                    </span>
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
