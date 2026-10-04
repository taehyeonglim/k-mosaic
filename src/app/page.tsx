import type { ExtendedFeatureCollection as FeatureCollection } from 'd3-geo';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

import geoJson from '../../public/geo/sido.geo.json';
import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { ko } from '@/content/ko';
import { formatRatePrecisionNote } from '@/content/template';
import { selectAvailableYears, selectIntegerRoundedYears } from '@/lib/data/selectors';
import { formattedDate, multiculturalSourcePanelSources } from '@/lib/data/source-panel';
import { loadSnapshot } from '@/lib/data/snapshot';
import { REGION_BY_CODE, REGION_ORDER } from '@/lib/constants/regions';
import type { SchoolLevel } from '@/lib/schema';
import { encodeStatRecords } from '@/lib/data/compact';
import { DashboardClient, type DashboardPayload } from './dashboard-client';

function buildPayload(snapshot: ReturnType<typeof loadSnapshot>): DashboardPayload {
  const years = selectAvailableYears();
  const levels: SchoolLevel[] = ['all', 'elementary', 'middle', 'high', 'other'];
  // 클라이언트는 decodeStatRecords 로 같은 레코드를 복원해 같은 셀렉터(createSelectors)를 쓴다.
  const { records, noteSets } = encodeStatRecords(snapshot.records, {
    years,
    regionScopes: ['KR', ...REGION_ORDER],
    levels,
  });

  const nationwide = encodeStatRecords(snapshot.nationwide, {
    years: snapshot.coverage.nationwideYears,
    regionScopes: ['KR'],
    levels,
  });

  return {
    geo: geoJson as FeatureCollection,
    nationwide,
    years,
    levels,
    regionCodes: [...REGION_ORDER],
    regionLabels: Object.fromEntries(
      REGION_ORDER.map((code) => [code, REGION_BY_CODE[code].officialKo]),
    ),
    records,
    noteSets,
    sources: multiculturalSourcePanelSources(),
    retrievedAtLabel: formattedDate(snapshot.retrievedAt),
    rateFormula: ko.sources.formulaValue,
    ratePrecisionNote: formatRatePrecisionNote(
      ko.sources.ratePrecisionNote,
      selectIntegerRoundedYears(),
    ),
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
        current="multicultural"
        lastUpdated={payload.retrievedAtLabel}
      />
      <PageShell>
        <Suspense fallback={<DashboardFallback />}>
          <DashboardClient payload={payload} />
        </Suspense>
      </PageShell>
      <AppFooter
        geoAttribution={ko.common.geoAttribution}
        dataAttribution={ko.sources.organizationValue}
        ethicsNote={ko.ethics.aggregateOnly}
      />
    </>
  );
}
