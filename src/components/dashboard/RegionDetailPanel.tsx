import Link from 'next/link';

import { ko } from '@/content/ko';
import type { SeriesSlot } from '@/lib/visualization/series-style';
import { TrendChart } from '@/components/charts/TrendChart';
import { formatCount, formatDelta, formatRate } from '@/lib/visualization/format';
import {
  SchoolLevelBreakdown,
  type SchoolLevelBreakdownItem,
} from '@/components/charts/SchoolLevelBreakdown';
import { MetricValue } from '@/components/ui/MetricValue';

export interface RegionDetailData {
  regionCode: string;
  label: string;
  year: number;
  currentCount: number | null;
  currentRate: number | null;
  nationwideValue: {
    count: number | null;
    rate: number | null;
  };
  nationwideRank: number | null;
  nationwideDifference: {
    count: number | null;
    rate: number | null;
  };
  yearChange: {
    count: number | null;
    rate: number | null;
  };
  schoolLevels: SchoolLevelBreakdownItem[];
  trend?: { year: number; value: number | null }[];
  notes?: string[];
}

export interface RegionDetailPanelProps {
  detail: RegionDetailData;
  onClose(): void;
  nationalLabel: string;
  /** 비교 시계열에서 이 지역이 쓰는 계열색 자리 — 같은 화면의 다른 차트와 색을 맞춘다. */
  seriesSlot?: SeriesSlot;
}

function formatCountDelta(value: number | null): string {
  const formatted = formatDelta(value, ko.missing.value);
  return value === null ? formatted : `${formatted}명`;
}

function formatRateDelta(value: number | null): string {
  const formatted = formatDelta(value, ko.missing.value);
  return value === null ? formatted : `${formatted}%`;
}

export function RegionDetailPanel({
  detail,
  onClose,
  nationalLabel,
  seriesSlot,
}: RegionDetailPanelProps) {
  return (
    <aside className="space-y-5" aria-labelledby="region-detail-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-small text-[var(--km-color-text-muted)]">{detail.year}</p>
          <h2 id="region-detail-title" className="text-xl font-medium">
            {detail.label}
          </h2>
          {/* 지역별 정적 페이지 — 공유·검색용 (basePath 를 붙이도록 next/link 사용) */}
          <Link className="text-small underline" href={`/regions/${detail.regionCode}/`}>
            {ko.regionPage.openRegionPage}
          </Link>
        </div>
        <button type="button" className="btn btn-ghost" aria-label={detail.label} onClick={onClose}>
          ×
        </button>
      </div>

      {/* 타일 3개 — 4열 격자(.viz-grid)에 넣으면 칸이 좁아 숫자가 넘친다. */}
      <dl className="grid min-w-0 gap-3 sm:grid-cols-3">
        <div className="card viz-stat">
          <dt className="text-small text-[var(--km-color-text-muted)]">
            {ko.regionDetail.currentCount}
          </dt>
          <dd className="viz-stat-value">
            <MetricValue
              value={detail.currentCount}
              unit="count"
              size="md"
              missingLabel={ko.missing.ariaLabel}
            />
          </dd>
        </div>
        <div className="card viz-stat">
          <dt className="text-small text-[var(--km-color-text-muted)]">
            {ko.regionDetail.currentRate}
          </dt>
          <dd className="viz-stat-value">
            <MetricValue
              value={detail.currentRate}
              unit="percent"
              size="md"
              missingLabel={ko.missing.ariaLabel}
            />
          </dd>
        </div>
        <div className="card viz-stat">
          <dt className="text-small text-[var(--km-color-text-muted)]">
            {ko.regionDetail.nationwideRank}
          </dt>
          <dd className="viz-stat-value tabular-nums">
            {detail.nationwideRank === null ? (
              <span aria-label={ko.missing.ariaLabel}>{ko.missing.value}</span>
            ) : (
              detail.nationwideRank
            )}
          </dd>
        </div>
      </dl>

      <dl className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <dt>{nationalLabel}</dt>
          <dd className="tabular-nums">
            {formatCount(detail.nationwideValue.count, ko.missing.value)} ·{' '}
            {formatRate(detail.nationwideValue.rate, ko.missing.value)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <dt>{ko.regionDetail.nationwideDifference}</dt>
          <dd className="tabular-nums">
            {formatCountDelta(detail.nationwideDifference.count)} ·{' '}
            {formatRateDelta(detail.nationwideDifference.rate)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <dt>{ko.regionDetail.yearChange}</dt>
          <dd className="tabular-nums">
            {formatCountDelta(detail.yearChange.count)} · {formatRateDelta(detail.yearChange.rate)}
          </dd>
        </div>
      </dl>

      <section className="space-y-2" aria-labelledby="school-level-breakdown-title">
        <h3 id="school-level-breakdown-title" className="font-medium">
          {ko.regionDetail.schoolLevelComposition}
        </h3>
        <SchoolLevelBreakdown
          items={detail.schoolLevels}
          formatCount={(value) => formatCount(value, ko.missing.value)}
          formatRate={(value) => formatRate(value, ko.missing.value)}
        />
      </section>

      {detail.trend && detail.trend.length > 0 ? (
        <section className="space-y-2" aria-labelledby="region-detail-trend-title">
          <h3 id="region-detail-trend-title" className="font-medium">
            {ko.trend.title}
          </h3>
          <TrendChart
            series={[
              {
                regionCode: detail.regionCode,
                label: detail.label,
                points: detail.trend,
                slot: seriesSlot,
              },
            ]}
            metric="count"
            formatValue={(value) => formatCount(value, ko.missing.value)}
          />
        </section>
      ) : null}

      {detail.notes && detail.notes.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5">
          {detail.notes.map((note, index) => (
            <li key={`${index}-${note}`}>{note}</li>
          ))}
        </ul>
      ) : null}

      <p className="text-small text-[var(--km-color-text-muted)]">
        {ko.regionDetail.studentTypeUnavailable}
      </p>
    </aside>
  );
}
