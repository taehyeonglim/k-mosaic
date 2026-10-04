import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AppFooter } from '@/components/layout/AppFooter';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageShell } from '@/components/layout/PageShell';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { MetricCardRow } from '@/components/dashboard/MetricCardRow';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { ko } from '@/content/ko';
import { fillTemplate, formatYearRange } from '@/content/template';
import { REGION_BY_CODE, REGION_ORDER } from '@/lib/constants/regions';
import {
  selectAvailableYears,
  selectRanking,
  selectRegionDetail,
  selectTrend,
} from '@/lib/data/selectors';
import { formattedDate } from '@/lib/data/source-panel';
import { loadSnapshot } from '@/lib/data/snapshot';
import { regionCodeSchema, type RegionCode } from '@/lib/schema';
import { pageMetadata } from '@/lib/site';
import { formatCount, formatRate } from '@/lib/visualization/format';
import { RegionLevelBreakdown, RegionTrendCharts } from './region-charts';

// 17개 시·도별 정적 페이지 — 지역 단위로 공유·검색될 수 있게 한다 (PRD §6).
// 대시보드와 같은 셀렉터(createSelectors)로 계산하므로 수치가 대시보드와 일치한다.

export const dynamicParams = false;

export function generateStaticParams(): { code: RegionCode }[] {
  return REGION_ORDER.map((code) => ({ code }));
}

function parseCode(raw: string): RegionCode {
  const parsed = regionCodeSchema.safeParse(raw);
  if (!parsed.success) notFound();
  return parsed.data;
}

function latestYear(): number {
  const years = selectAvailableYears();
  return years[years.length - 1]!;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const code = parseCode((await params).code);
  const region = REGION_BY_CODE[code].officialKo;
  const year = latestYear();
  const detail = selectRegionDetail(code, year, 'all');
  return pageMetadata({
    title: fillTemplate(ko.regionPage.metaTitle, { region }),
    description: fillTemplate(
      detail?.rate == null
        ? ko.regionPage.metaDescriptionRateMissing
        : ko.regionPage.metaDescription,
      {
        region,
        year,
        count: formatCount(detail?.count ?? null, ko.missing.value),
        rate: formatRate(detail?.rate ?? null, ko.missing.value),
      },
    ),
    path: `regions/${code}/`,
  });
}

export default async function RegionPage({ params }: { params: Promise<{ code: string }> }) {
  const code = parseCode((await params).code);
  const region = REGION_BY_CODE[code].officialKo;
  const snapshot = loadSnapshot();
  const years = selectAvailableYears();
  const year = latestYear();
  const detail = selectRegionDetail(code, year, 'all');
  if (detail === null) notFound();
  const national = selectTrend(['KR'], 'all', 'rate')[0]?.points.find(
    (point) => point.year === year,
  )?.value;
  const rankRow = selectRanking(year, 'all', 'count').find((row) => row.regionCode === code);
  const countTrend = selectTrend([code], 'all', 'count');
  const rateTrend = selectTrend([code, 'KR'], 'all', 'rate');
  const label = (regionCode: string) =>
    regionCode === 'KR'
      ? ko.common.nationwide
      : REGION_BY_CODE[regionCode as RegionCode].officialKo;
  const toSeries = (series: typeof countTrend) =>
    series.map((item) => ({
      regionCode: item.regionCode,
      label: label(item.regionCode),
      points: item.points,
    }));
  const range = formatYearRange(years);

  return (
    <>
      <AppHeader
        brandName={ko.app.title}
        brandSubtitle={ko.app.subtitle}
        dataYear={year}
        lastUpdated={formattedDate(snapshot.retrievedAt)}
        sourceLabel={ko.nav.sources}
        sourceHref="/sources/"
      />
      <PageShell>
        <div className="space-y-8">
          <nav
            aria-label={ko.regionPage.navigationLabel}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
          >
            <div className="flex flex-wrap gap-2">
              <Link className="btn inline-flex" href="/">
                {ko.regionPage.backToDashboard}
              </Link>
              <Link className="btn inline-flex" href={`/?regions=${code}`}>
                {ko.regionPage.compareInDashboard}
              </Link>
            </div>
            <ThemeToggle />
          </nav>

          <header className="space-y-2">
            <h2 className="text-2xl font-semibold">
              {fillTemplate(ko.regionPage.heading, { region })}
            </h2>
            <p className="text-small text-[var(--km-color-text-muted)]">
              {fillTemplate(ko.regionPage.subtitle, { year, ...range })}
            </p>
          </header>

          <section
            aria-label={fillTemplate(ko.regionPage.summaryTitle, { year })}
            className="space-y-3"
          >
            <MetricCardRow
              items={[
                {
                  key: 'student-count',
                  label: ko.overview.studentCount,
                  value: detail.count,
                  unit: 'count',
                  delta: detail.deltaAbs,
                  deltaPct: detail.deltaPct,
                },
                {
                  key: 'student-rate',
                  label: ko.regionPage.rateLabel,
                  value: detail.rate,
                  unit: 'percent',
                  note: ko.overview.computedRate,
                },
                {
                  key: 'nationwide-difference',
                  label: ko.regionPage.nationwideDifferenceLabel,
                  value: detail.diffFromNational,
                  unit: 'percent',
                  display: 'delta',
                  note: fillTemplate(ko.regionPage.nationwideDifferenceNote, {
                    rate: formatRate(national ?? null, ko.missing.value),
                  }),
                },
              ]}
            />
            <p className="text-small" data-key="region-rank">
              {ko.regionPage.rankLabel}:{' '}
              {rankRow === undefined
                ? ko.missing.label
                : `${rankRow.isTied ? `${ko.regionPage.rankTied} ` : ''}${fillTemplate(ko.regionPage.rankValue, { rank: rankRow.rank })}`}
            </p>
            <p className="text-small text-[var(--km-color-text-muted)]">
              {ko.ranking.interpretationNote}
            </p>
          </section>

          <Card title={ko.regionDetail.schoolLevelComposition}>
            <RegionLevelBreakdown
              items={detail.byLevel.map((level) => ({
                level: level.schoolLevel,
                label: ko.filters.schoolLevels[level.schoolLevel],
                count: level.count,
                rate: level.rate,
              }))}
            />
          </Card>

          <Card title={ko.regionPage.trendTitle} description={ko.trend.missingSegment}>
            <RegionTrendCharts
              countSeries={toSeries(countTrend)}
              rateSeries={toSeries(rateTrend)}
            />
          </Card>

          <Card title={ko.regionPage.tableTitle}>
            <DataTable
              caption={fillTemplate(ko.regionPage.tableCaption, { region })}
              emptyLabel={ko.missing.label}
              columns={[
                { key: 'year', label: ko.filters.year },
                { key: 'count', label: ko.overview.studentCount, numeric: true },
                { key: 'rate', label: ko.regionPage.rateLabel, numeric: true },
              ]}
              rows={years.map((itemYear) => {
                const count = countTrend[0]?.points.find((point) => point.year === itemYear)?.value;
                const rate = rateTrend[0]?.points.find((point) => point.year === itemYear)?.value;
                return {
                  year: String(itemYear),
                  count: formatCount(count ?? null, ko.missing.value),
                  rate: formatRate(rate ?? null, ko.missing.value),
                };
              })}
            />
          </Card>

          <section className="space-y-2 text-small text-[var(--km-color-text-muted)]">
            {detail.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
            <p>{ko.regionDetail.studentTypeUnavailable}</p>
            <p>{ko.ethics.noCausalInterpretation}</p>
          </section>

          <nav aria-label={ko.regionPage.otherRegions} className="space-y-2">
            <h3 className="text-base font-medium">{ko.regionPage.otherRegions}</h3>
            <ul className="flex flex-wrap gap-2">
              {REGION_ORDER.filter((other) => other !== code).map((other) => (
                <li key={other}>
                  <Link className="btn btn-ghost inline-flex" href={`/regions/${other}/`}>
                    {REGION_BY_CODE[other].short}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </PageShell>
      <AppFooter
        geoAttribution={ko.common.geoAttribution}
        dataAttribution={ko.sources.organizationValue}
        ethicsNote={ko.ethics.aggregateOnly}
      />
    </>
  );
}
