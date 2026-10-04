import type { Metadata } from 'next';
import Link from 'next/link';
import type { ExtendedFeatureCollection as FeatureCollection } from 'd3-geo';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

import geoJson from '../../../public/geo/sido.geo.json';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { ko } from '@/content/ko';
import { pageMetadata } from '@/lib/site';
import {
  loadForeignSnapshot,
  selectForeignAvailableYears,
  selectForeignByRegion,
  selectForeignNational,
  selectForeignNationwideTrend,
  selectForeignRanking,
  selectForeignTrend,
} from '@/lib/data/foreign';
import { selectSourceMeta } from '@/lib/data/selectors';
import { REGION_BY_CODE, REGION_ORDER } from '@/lib/constants/regions';
import type { SourcePanelSource } from '@/components/dashboard/SourcePanel';
import { ForeignStudentsClient, type ForeignStudentsPayload } from './foreign-students-client';

export const metadata: Metadata = pageMetadata({
  title: ko.foreignStudents.metaTitle,
  description: ko.foreignStudents.metaDescription,
  path: 'foreign-students/',
});

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}

function sourcePanelSources(): SourcePanelSource[] {
  return selectSourceMeta('foreign').map((source) => ({
    role:
      source.tableId === 'DT_1963003_010_S'
        ? ko.foreignStudents.sources.regionalRole
        : ko.foreignStudents.sources.nationwideRole,
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

function buildPayload(): ForeignStudentsPayload {
  const snapshot = loadForeignSnapshot();
  const years = selectForeignAvailableYears();
  const regionalRecords = years.flatMap((year) => selectForeignByRegion(year));
  const nationalRecords = years.flatMap((year) => {
    const record = selectForeignNational(year);
    return record === null ? [] : [record];
  });

  return {
    geo: geoJson as FeatureCollection,
    years,
    regionCodes: [...REGION_ORDER],
    regionLabels: Object.fromEntries(
      REGION_ORDER.map((code) => [code, REGION_BY_CODE[code].officialKo]),
    ),
    regionalRecords,
    nationalRecords,
    rankings: Object.fromEntries(
      years.map((year) => [
        String(year),
        {
          count: selectForeignRanking(year, 'count'),
          rate: selectForeignRanking(year, 'rate'),
        },
      ]),
    ),
    regionalTrend: selectForeignTrend([...REGION_ORDER]),
    nationwideTrend: selectForeignNationwideTrend(),
    sources: sourcePanelSources(),
    retrievedAtLabel: formattedDate(snapshot.retrievedAt),
    rateFormula: ko.foreignStudents.sources.formulaValue,
  };
}

function ForeignStudentsFallback(): ReactNode {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton count={3} height="5rem" />
      <Skeleton count={2} height="24rem" />
      <p className="text-small text-[var(--km-color-text-muted)]">{ko.errors.dataLoad}</p>
    </div>
  );
}

export default function ForeignStudentsPage() {
  const payload = buildPayload();
  const latestYear = payload.years[payload.years.length - 1] ?? 0;

  return (
    <>
      <AppHeader
        brandName={ko.app.title}
        brandSubtitle={ko.foreignStudents.appSubtitle}
        dataYear={latestYear}
        current="foreignStudents"
        lastUpdated={payload.retrievedAtLabel}
      />
      <PageShell>
        <div className="space-y-8">
          <PageHeader
            title={ko.foreignStudents.metaTitle}
            description={ko.foreignStudents.metaDescription}
          />

          {/* 모집단 안내 — 다문화학생(초·중등)과 다른 학생 집단임을 페이지 맨 위에서 밝힌다. */}
          <section
            aria-labelledby="foreign-population-notice-title"
            className="space-y-2 rounded-[var(--km-radius-lg)] border border-quality-note/45 bg-quality-note/10 p-4 sm:p-5"
          >
            <h3 id="foreign-population-notice-title" className="text-sm font-semibold">
              {ko.foreignStudents.populationNoticeLabel}
            </h3>
            <p className="max-w-4xl text-sm leading-6">{ko.foreignStudents.populationNotice}</p>
            {/* 해시 전용 href 도 next/link 가 처리한다 (basePath 유지). */}
            <Link
              className="inline-flex text-sm font-medium text-text underline decoration-border-strong underline-offset-4 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              href="#foreign-sources"
            >
              {ko.foreignStudents.sourceLink}
            </Link>
          </section>

          <Suspense fallback={<ForeignStudentsFallback />}>
            <ForeignStudentsClient payload={payload} />
          </Suspense>
        </div>
      </PageShell>
      <AppFooter
        geoAttribution={ko.common.geoAttribution}
        dataAttribution={ko.sources.organizationValue}
        ethicsNote={ko.foreignStudents.ethicsNote}
      />
    </>
  );
}
