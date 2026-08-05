import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtendedFeatureCollection as FeatureCollection } from 'd3-geo';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

import geoJson from '../../public/geo/sido.geo.json';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageShell } from '@/components/layout/PageShell';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Skeleton } from '@/components/ui/Skeleton';
import { ko } from '@/content/ko';
import {
  selectAvailableYears,
  selectByRegion,
  selectNational,
  selectRanking,
  selectRegionDetail,
  selectSourceMeta,
  selectTrend,
} from '@/lib/data/selectors';
import { loadSnapshot } from '@/lib/data/snapshot';
import { REGION_BY_CODE, REGION_ORDER } from '@/lib/constants/regions';
import type { MetricKey, RankingMetric, RegionCode, SchoolLevel } from '@/lib/schema';
import { DashboardClient, type DashboardPayload } from './dashboard-client';

const GEO_ATTRIBUTION =
  '행정경계: 통계청 통계지리정보서비스(SGIS) — 공공누리 제1유형 · 가공: vuski/admdongkor — CC BY 4.0';

function viewKey(year: number, level: SchoolLevel): string {
  return `${year}|${level}`;
}

function rankingKey(year: number, level: SchoolLevel, metric: RankingMetric): string {
  return `${year}|${level}|${metric}`;
}

function trendKey(level: SchoolLevel, metric: MetricKey): string {
  return `${level}|${metric}`;
}

function detailKey(year: number, level: SchoolLevel, regionCode: RegionCode): string {
  return `${year}|${level}|${regionCode}`;
}

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}

function sourcePanelSources() {
  return selectSourceMeta().map((source) => ({
    role:
      source.role === 'numerator' ? ko.sources.numeratorProvider : ko.sources.denominatorProvider,
    provider: source.provider,
    organization: source.organization,
    statisticsName: source.statisticsName,
    tableId: source.tableId,
    tableName: source.tableName,
    sourceUrl: source.sourceUrl,
    retrievedAt: formattedDate(source.retrievedAt),
    referenceDate: source.referenceDate,
    isProvisional: source.isProvisional,
  }));
}

function buildPayload(snapshot: ReturnType<typeof loadSnapshot>): DashboardPayload {
  const years = selectAvailableYears();
  const levels: SchoolLevel[] = ['all', 'elementary', 'middle', 'high', 'other'];
  const metrics: MetricKey[] = ['count', 'rate'];
  const rankingMetrics: RankingMetric[] = ['count', 'rate', 'deltaAbs', 'deltaPct'];
  const national: DashboardPayload['national'] = {};
  const regional: DashboardPayload['regional'] = {};
  const rankings: DashboardPayload['rankings'] = {};
  const trends: DashboardPayload['trends'] = {};
  const details: DashboardPayload['details'] = {};

  years.forEach((year) => {
    levels.forEach((level) => {
      national[viewKey(year, level)] = selectNational(year, level);
      regional[viewKey(year, level)] = selectByRegion(year, level);
      rankingMetrics.forEach((metric) => {
        rankings[rankingKey(year, level, metric)] = selectRanking(year, level, metric);
      });
      REGION_ORDER.forEach((regionCode) => {
        details[detailKey(year, level, regionCode)] = selectRegionDetail(regionCode, year, level);
      });
    });
  });

  levels.forEach((level) => {
    metrics.forEach((metric) => {
      trends[trendKey(level, metric)] = selectTrend(['KR', ...REGION_ORDER], level, metric);
    });
  });

  return {
    geo: geoJson as FeatureCollection,
    years,
    levels,
    regionCodes: [...REGION_ORDER],
    regionLabels: Object.fromEntries(
      REGION_ORDER.map((code) => [code, REGION_BY_CODE[code].officialKo]),
    ),
    national,
    regional,
    rankings,
    trends,
    details,
    sources: sourcePanelSources(),
    retrievedAtLabel: formattedDate(snapshot.retrievedAt),
    rateFormula: ko.sources.formulaValue,
    fullCsv: readFileSync(
      join(process.cwd(), 'data/snapshots/multicultural-students.v1.csv'),
      'utf8',
    ),
    fullJson: JSON.stringify(snapshot, null, 2),
    dictionary: readFileSync(join(process.cwd(), 'docs/data-dictionary-draft.md'), 'utf8'),
  };
}

function DashboardFallback(): ReactNode {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton count={4} height="5rem" />
      <Skeleton count={2} height="24rem" />
      <p className="text-small text-[var(--km-color-text-muted)]">{ko.errors.dataLoad}</p>
    </div>
  );
}

export default function Page() {
  const snapshot = loadSnapshot();
  const payload = buildPayload(snapshot);
  const latestYear = payload.years[payload.years.length - 1] ?? 0;

  return (
    <>
      <AppHeader
        brandName={ko.app.title}
        brandSubtitle={ko.app.subtitle}
        dataYear={latestYear}
        lastUpdated={payload.retrievedAtLabel}
        sourceLabel={ko.nav.sources}
        sourceHref="/sources/"
      />
      <PageShell>
        <div className="space-y-4">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <Suspense fallback={<DashboardFallback />}>
            <DashboardClient payload={payload} />
          </Suspense>
        </div>
      </PageShell>
      <AppFooter
        geoAttribution={GEO_ATTRIBUTION}
        dataAttribution={ko.sources.organizationValue}
        ethicsNote={ko.ethics.aggregateOnly}
      />
    </>
  );
}
