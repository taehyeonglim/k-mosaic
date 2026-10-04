import Link from 'next/link';

import { Icon } from '@/components/ui/Icon';
import { ko } from '@/content/ko';
import { fillTemplate } from '@/content/template';
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
  notes?: string[];
}

export interface RegionDetailPanelProps {
  detail: RegionDetailData;
  onClose(): void;
  nationalLabel: string;
}

function formatCountDelta(value: number | null): string {
  const formatted = formatDelta(value, ko.missing.value);
  return value === null ? formatted : `${formatted}명`;
}

function formatRateDelta(value: number | null): string {
  const formatted = formatDelta(value, ko.missing.value);
  return value === null ? formatted : `${formatted}%`;
}

const ROW = 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5';

/**
 * 선택한 지역의 상세 — 왼쪽에 핵심 수치와 전국 값과의 비교, 오른쪽에 학교급별 구성.
 * 추세 차트는 두지 않는다: 바로 아래 시계열 패널의 '선택 지역 추세'가 같은 선을 그린다.
 */
export function RegionDetailPanel({ detail, onClose, nationalLabel }: RegionDetailPanelProps) {
  return (
    <aside className="space-y-5" aria-labelledby="region-detail-title">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-small text-text-muted">{detail.year}</p>
          <h2 id="region-detail-title" className="text-xl font-bold tracking-tight">
            {detail.label}
          </h2>
          {/* 지역별 정적 페이지 — 공유·검색용 (basePath 를 붙이도록 next/link 사용) */}
          <Link
            className="inline-flex items-center gap-1 text-small font-medium text-accent-strong underline decoration-transparent underline-offset-4 transition-colors duration-150 hover:decoration-current motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            href={`/regions/${detail.regionCode}/`}
          >
            {ko.regionPage.openRegionPage}
            <Icon name="arrow-right" size={14} />
          </Link>
        </div>
        <button
          type="button"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-text-muted transition-colors duration-150 hover:bg-surface-muted hover:text-text motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-label={fillTemplate(ko.regionDetail.close, { region: detail.label })}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="grid min-w-0 gap-x-10 gap-y-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <dl className="grid min-w-0 gap-3 sm:grid-cols-3">
            <div className="card viz-stat">
              <dt className="text-small text-text-muted">{ko.regionDetail.currentCount}</dt>
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
              <dt className="text-small text-text-muted">{ko.regionDetail.currentRate}</dt>
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
              <dt className="text-small text-text-muted">{ko.regionDetail.nationwideRank}</dt>
              <dd className="viz-stat-value text-2xl leading-tight sm:text-3xl">
                {detail.nationwideRank === null ? (
                  <span aria-label={ko.missing.ariaLabel}>{ko.missing.value}</span>
                ) : (
                  detail.nationwideRank
                )}
              </dd>
            </div>
          </dl>

          <dl className="divide-y divide-border text-sm">
            <div className={ROW}>
              <dt className="text-text-muted">{nationalLabel}</dt>
              <dd className="font-medium tabular-nums">
                {formatCount(detail.nationwideValue.count, ko.missing.value)} ·{' '}
                {formatRate(detail.nationwideValue.rate, ko.missing.value)}
              </dd>
            </div>
            <div className={ROW}>
              <dt className="text-text-muted">{ko.regionDetail.nationwideDifference}</dt>
              <dd className="font-medium tabular-nums">
                {formatCountDelta(detail.nationwideDifference.count)} ·{' '}
                {formatRateDelta(detail.nationwideDifference.rate)}
              </dd>
            </div>
            <div className={ROW}>
              <dt className="text-text-muted">{ko.regionDetail.yearChange}</dt>
              <dd className="font-medium tabular-nums">
                {formatCountDelta(detail.yearChange.count)} ·{' '}
                {formatRateDelta(detail.yearChange.rate)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="min-w-0 space-y-4">
          <section className="space-y-2" aria-labelledby="school-level-breakdown-title">
            <h3 id="school-level-breakdown-title" className="text-sm font-semibold">
              {ko.regionDetail.schoolLevelComposition}
            </h3>
            <SchoolLevelBreakdown
              items={detail.schoolLevels}
              formatCount={(value) => formatCount(value, ko.missing.value)}
              formatRate={(value) => formatRate(value, ko.missing.value)}
            />
          </section>

          {detail.notes && detail.notes.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-small text-text-muted">
              {detail.notes.map((note, index) => (
                <li key={`${index}-${note}`}>{note}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
