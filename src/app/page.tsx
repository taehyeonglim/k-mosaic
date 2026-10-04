import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtendedFeatureCollection as FeatureCollection } from 'd3-geo';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Suspense } from 'react';

import geoJson from '../../public/geo/sido.geo.json';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageShell } from '@/components/layout/PageShell';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Skeleton } from '@/components/ui/Skeleton';
import { ko } from '@/content/ko';
import { formatRatePrecisionNote } from '@/content/template';
import {
  selectAvailableYears,
  selectIntegerRoundedYears,
  selectSourceMeta,
} from '@/lib/data/selectors';
import { loadSnapshot } from '@/lib/data/snapshot';
import { REGION_BY_CODE, REGION_ORDER } from '@/lib/constants/regions';
import type { RegionScope, SchoolLevel } from '@/lib/schema';
import {
  DashboardClient,
  type CompactRecord,
  type DashboardPayload,
} from './dashboard-client';

const GEO_ATTRIBUTION =
  '행정경계: 통계청 통계지리정보서비스(SGIS) — 공공누리 제1유형 · 가공: vuski/admdongkor — CC BY 4.0';

function formattedDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}

function sourcePanelSources() {
  return selectSourceMeta('multicultural').map((source) => ({
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
  const dataRegionCodes: RegionScope[] = ['KR', ...REGION_ORDER];
  const noteSets: string[][] = [];
  const noteIndexes = new Map<string, number>();
  const records: CompactRecord[] = snapshot.records.map((record) => {
    const yearIndex = years.indexOf(record.year);
    const regionIndex = dataRegionCodes.indexOf(record.regionCode);
    const levelIndex = levels.indexOf(record.schoolLevel);
    if (yearIndex < 0 || regionIndex < 0 || levelIndex < 0) {
      throw new Error('화면용 데이터 차원 인덱스를 만들 수 없습니다.');
    }
    const noteKey = JSON.stringify(record.notes);
    let noteIndex = noteIndexes.get(noteKey);
    if (noteIndex === undefined) {
      noteIndex = noteSets.length;
      noteIndexes.set(noteKey, noteIndex);
      noteSets.push([...record.notes]);
    }
    return [
      yearIndex,
      regionIndex,
      levelIndex,
      record.multiculturalStudentCount,
      record.totalStudentCount,
      record.multiculturalStudentRateComputed,
      noteIndex,
    ];
  });

  return {
    geo: geoJson as FeatureCollection,
    years,
    levels,
    regionCodes: [...REGION_ORDER],
    regionLabels: Object.fromEntries(
      REGION_ORDER.map((code) => [code, REGION_BY_CODE[code].officialKo]),
    ),
    records,
    noteSets,
    sources: sourcePanelSources(),
    retrievedAtLabel: formattedDate(snapshot.retrievedAt),
    rateFormula: ko.sources.formulaValue,
    ratePrecisionNote: formatRatePrecisionNote(
      ko.sources.ratePrecisionNote,
      selectIntegerRoundedYears(),
    ),
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
          <nav
            aria-label={ko.foreignStudents.navigationLabel}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
          >
            <Link
              className="btn inline-flex"
              href="/foreign-students/"
            >
              {ko.foreignStudents.mainLink}
            </Link>
            <ThemeToggle />
          </nav>
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
