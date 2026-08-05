'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import type { ExtendedFeatureCollection as FeatureCollection } from 'd3-geo';

import { RankingBarChart } from '@/components/charts/RankingBarChart';
import { TrendChart } from '@/components/charts/TrendChart';
import { DownloadButtons } from '@/components/dashboard/DownloadButtons';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { MetricCardRow } from '@/components/dashboard/MetricCardRow';
import {
  RankingTable,
  type RankingTableMetric,
  type RankingTableRow,
} from '@/components/dashboard/RankingTable';
import { RegionDetailPanel, type RegionDetailData } from '@/components/dashboard/RegionDetailPanel';
import { SourcePanel } from '@/components/dashboard/SourcePanel';
import { MapLegend } from '@/components/map/MapLegend';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ko } from '@/content/ko';
import { toCsv } from '@/lib/data/csv';
import type {
  LevelStatView,
  RankingRow,
  RegionDetail,
  StatView,
  TrendSeries,
} from '@/lib/data/types';
import {
  metricKeySchema,
  regionCodeSchema,
  schoolLevelSchema,
  type MetricKey,
  type RegionCode,
  type SchoolLevel,
} from '@/lib/schema';
import { formatCount, formatRate } from '@/lib/visualization/format';
import { createCountScale, createRateScale } from '@/lib/visualization/scale';

const ChoroplethMap = dynamic(
  () => import('@/components/map/ChoroplethMap').then((module) => module.ChoroplethMap),
  {
    ssr: false,
    loading: () => <p className="text-small text-[var(--km-color-text-muted)]">{ko.map.title}</p>,
  },
);

export interface DashboardPayload {
  geo: FeatureCollection;
  years: number[];
  levels: SchoolLevel[];
  regionCodes: RegionCode[];
  regionLabels: Record<string, string>;
  national: Record<string, StatView | null>;
  regional: Record<string, StatView[]>;
  rankings: Record<string, RankingRow[]>;
  trends: Record<string, TrendSeries[]>;
  details: Record<string, RegionDetail | null>;
  sources: {
    role: string;
    provider: string;
    organization: string;
    statisticsName: string;
    tableId: string;
    tableName: string;
    sourceUrl: string;
    retrievedAt: string;
    referenceDate: string | null;
    isProvisional: boolean | null;
  }[];
  retrievedAtLabel: string;
  rateFormula: string;
  fullCsv: string;
  fullJson: string;
  dictionary: string;
}

interface DashboardClientProps {
  payload: DashboardPayload;
}

interface FilterState {
  year: number;
  level: SchoolLevel;
  metric: MetricKey;
  regions: RegionCode[];
  hasTooManyRegions: boolean;
}

interface FilterUpdates {
  year?: number;
  level?: SchoolLevel;
  metric?: MetricKey;
  regions?: RegionCode[];
}

function viewKey(year: number, level: SchoolLevel): string {
  return `${year}|${level}`;
}

function rankingKey(year: number, level: SchoolLevel, metric: RankingTableMetric): string {
  return `${year}|${level}|${metric}`;
}

function trendKey(level: SchoolLevel, metric: MetricKey): string {
  return `${level}|${metric}`;
}

function detailKey(year: number, level: SchoolLevel, regionCode: RegionCode): string {
  return `${year}|${level}|${regionCode}`;
}

function difference(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : current - previous;
}

function percentageDifference(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current / previous - 1) * 100;
}

function readFilters(searchParams: URLSearchParams, years: number[]): FilterState {
  const defaultYear = years[years.length - 1] ?? years[0] ?? 0;
  const requestedYear = Number(searchParams.get('year'));
  const year =
    Number.isInteger(requestedYear) && years.includes(requestedYear) ? requestedYear : defaultYear;
  const requestedLevel = schoolLevelSchema.safeParse(searchParams.get('level'));
  const level = requestedLevel.success ? requestedLevel.data : 'all';
  const requestedMetric = metricKeySchema.safeParse(searchParams.get('metric'));
  const metric = requestedMetric.success ? requestedMetric.data : 'count';
  const regionTokens = (searchParams.get('regions') ?? '').split(',').filter(Boolean);
  const parsedRegions = regionTokens.flatMap((token) => {
    const parsed = regionCodeSchema.safeParse(token);
    return parsed.success ? [parsed.data] : [];
  });
  const regions = Array.from(new Set(parsedRegions)).slice(0, 3);

  return {
    year,
    level,
    metric,
    regions,
    hasTooManyRegions: parsedRegions.length > 3,
  };
}

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DashboardClient({ payload }: DashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams.toString();
  const [mapLimitReached, setMapLimitReached] = useState(false);
  const filters = useMemo(
    () => readFilters(new URLSearchParams(searchString), payload.years),
    [payload.years, searchString],
  );

  const updateQuery = useCallback(
    (updates: FilterUpdates) => {
      const next = new URLSearchParams(searchString);
      if (updates.year !== undefined) next.set('year', String(updates.year));
      if (updates.level !== undefined) next.set('level', updates.level);
      if (updates.metric !== undefined) next.set('metric', updates.metric);
      if (updates.regions !== undefined) {
        if (updates.regions.length === 0) next.delete('regions');
        else next.set('regions', updates.regions.join(','));
      }
      const query = next.toString();
      router.push(query.length > 0 ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchString],
  );

  const currentViews = useMemo(
    () => payload.regional[viewKey(filters.year, filters.level)] ?? [],
    [filters.level, filters.year, payload.regional],
  );
  const currentNational = useMemo(
    () => payload.national[viewKey(filters.year, filters.level)] ?? null,
    [filters.level, filters.year, payload.national],
  );
  const previousNational = useMemo(
    () => payload.national[viewKey(filters.year - 1, filters.level)] ?? null,
    [filters.level, filters.year, payload.national],
  );
  const firstYear = payload.years[0] ?? filters.year;
  const firstNational = useMemo(
    () => payload.national[viewKey(firstYear, filters.level)] ?? null,
    [firstYear, filters.level, payload.national],
  );
  const currentRanking = useMemo(
    () => payload.rankings[rankingKey(filters.year, filters.level, filters.metric)] ?? [],
    [filters.level, filters.metric, filters.year, payload.rankings],
  );
  const rankingByCode = useMemo<Map<string, RankingRow>>(
    () => new Map(currentRanking.map((row): [string, RankingRow] => [row.regionCode, row])),
    [currentRanking],
  );
  const metricValue = useCallback(
    (view: StatView): number | null => (filters.metric === 'count' ? view.count : view.rate),
    [filters.metric],
  );
  const mapData = useMemo(
    () => currentViews.map((view) => ({ regionCode: view.regionCode, value: metricValue(view) })),
    [currentViews, metricValue],
  );
  const mapScale = useMemo(
    () =>
      filters.metric === 'count'
        ? createCountScale(
            mapData.map((item) => item.value),
            'light',
          )
        : createRateScale(
            mapData.map((item) => item.value),
            'light',
          ),
    [filters.metric, mapData],
  );
  const mapRanks = useMemo(
    () =>
      Object.fromEntries(
        payload.regionCodes.map((code) => [code, rankingByCode.get(code)?.rank ?? null]),
      ),
    [payload.regionCodes, rankingByCode],
  );
  const rankingRowsByMetric = useMemo<Record<RankingTableMetric, RankingTableRow[]>>(() => {
    const metrics: RankingTableMetric[] = ['count', 'rate', 'deltaAbs', 'deltaPct'];
    return Object.fromEntries(
      metrics.map((rankingMetric) => {
        const rows = payload.rankings[rankingKey(filters.year, filters.level, rankingMetric)] ?? [];
        const rowsByCode = new Map(rows.map((row): [string, RankingRow] => [row.regionCode, row]));
        return [
          rankingMetric,
          currentViews.map((view) => ({
            rank: rowsByCode.get(view.regionCode)?.rank ?? 0,
            regionCode: view.regionCode,
            label: view.regionNameKo,
            value: rowsByCode.get(view.regionCode)?.value ?? null,
            isTied: rowsByCode.get(view.regionCode)?.isTied ?? false,
          })),
        ];
      }),
    ) as Record<RankingTableMetric, RankingTableRow[]>;
  }, [currentViews, filters.level, filters.year, payload.rankings]);
  const rankingRows = useMemo(
    () => rankingRowsByMetric[filters.metric],
    [filters.metric, rankingRowsByMetric],
  );
  const rankingChartRows = useMemo(
    () => rankingRows.filter((row) => row.value !== null),
    [rankingRows],
  );
  const selectedRegion = filters.regions[filters.regions.length - 1] ?? null;
  const selectedDetail = useMemo(
    () =>
      selectedRegion === null
        ? null
        : (payload.details[detailKey(filters.year, filters.level, selectedRegion)] ?? null),
    [filters.level, filters.year, payload.details, selectedRegion],
  );
  const selectedPrevious = useMemo(
    () =>
      selectedRegion === null
        ? null
        : ((payload.regional[viewKey(filters.year - 1, filters.level)] ?? []).find(
            (view) => view.regionCode === selectedRegion,
          ) ?? null),
    [filters.level, filters.year, payload.regional, selectedRegion],
  );
  const selectedDetailData = useMemo<RegionDetailData | null>(() => {
    if (selectedDetail === null) return null;
    const currentView = currentViews.find((view) => view.regionCode === selectedDetail.regionCode);
    const nationalCount = currentNational?.count ?? null;
    const nationalRate = currentNational?.rate ?? null;
    const currentCount = currentView?.count ?? selectedDetail.count;
    const currentRate = currentView?.rate ?? selectedDetail.rate;
    const schoolLevels = selectedDetail.byLevel.map((item: LevelStatView) => ({
      level: item.schoolLevel,
      label: ko.filters.schoolLevels[item.schoolLevel],
      count: item.count,
      rate: item.rate,
    }));
    return {
      regionCode: selectedDetail.regionCode,
      label: selectedDetail.nameKo,
      year: filters.year,
      currentCount,
      currentRate,
      nationwideValue: { count: nationalCount, rate: nationalRate },
      nationwideRank: rankingByCode.get(selectedDetail.regionCode)?.rank ?? null,
      nationwideDifference: {
        count: difference(currentCount, nationalCount),
        rate: selectedDetail.diffFromNational,
      },
      yearChange: {
        count: selectedDetail.deltaAbs,
        rate: difference(currentRate, selectedPrevious?.rate ?? null),
      },
      schoolLevels,
      trend: selectedDetail.trend,
      notes: selectedDetail.notes,
    };
  }, [
    currentNational,
    currentViews,
    filters.year,
    rankingByCode,
    selectedDetail,
    selectedPrevious,
  ]);
  const trendSeries = useMemo(
    () => payload.trends[trendKey(filters.level, filters.metric)] ?? [],
    [filters.level, filters.metric, payload.trends],
  );
  const nationwideTrend = useMemo(
    () => trendSeries.filter((series) => series.regionCode === 'KR'),
    [trendSeries],
  );
  const selectedTrend = useMemo(
    () =>
      filters.regions.flatMap((code) => trendSeries.filter((series) => series.regionCode === code)),
    [filters.regions, trendSeries],
  );
  const levelOptions = useMemo(
    () => payload.levels.map((level) => ({ value: level, label: ko.filters.schoolLevels[level] })),
    [payload.levels],
  );
  const regionOptions = useMemo(
    () =>
      payload.regionCodes.map((code) => ({
        value: code,
        label: payload.regionLabels[code] ?? code,
      })),
    [payload.regionCodes, payload.regionLabels],
  );
  const countDelta = difference(currentNational?.count ?? null, previousNational?.count ?? null);
  const countDeltaPct = percentageDifference(
    currentNational?.count ?? null,
    previousNational?.count ?? null,
  );
  const firstYearDelta = difference(currentNational?.count ?? null, firstNational?.count ?? null);

  function handleMapSelection(code: string | null): void {
    if (code === null) {
      if (selectedRegion !== null) {
        updateQuery({ regions: filters.regions.filter((region) => region !== selectedRegion) });
      }
      return;
    }
    const parsed = regionCodeSchema.safeParse(code);
    if (!parsed.success) return;
    if (filters.regions.includes(parsed.data)) {
      updateQuery({ regions: filters.regions.filter((region) => region !== parsed.data) });
      return;
    }
    if (filters.regions.length >= 3) {
      setMapLimitReached(true);
      return;
    }
    setMapLimitReached(false);
    updateQuery({ regions: [...filters.regions, parsed.data] });
  }

  function downloadFiltered(): void {
    const csv = toCsv(currentViews, {
      source: ko.sources.tableNameValue,
      year: filters.year,
      formula: payload.rateFormula,
    });
    triggerDownload(csv, `k-mosaic-${filters.year}-${filters.level}.csv`, 'text/csv;charset=utf-8');
  }

  function downloadAllCsv(): void {
    triggerDownload(payload.fullCsv, 'k-mosaic-full.csv', 'text/csv;charset=utf-8');
  }

  function downloadAllJson(): void {
    triggerDownload(
      payload.fullJson,
      'multicultural-students.v1.json',
      'application/json;charset=utf-8',
    );
  }

  function downloadDictionary(): void {
    triggerDownload(
      payload.dictionary,
      'k-mosaic-data-dictionary.md',
      'text/markdown;charset=utf-8',
    );
  }

  return (
    <div className="space-y-8">
      <section id="overview" aria-label={ko.overview.title}>
        <Card title={ko.overview.title} description={ko.app.tagline}>
          <MetricCardRow
            items={[
              {
                key: 'student-count',
                label: ko.overview.studentCount,
                value: currentNational?.count ?? null,
                unit: 'count',
              },
              {
                key: 'student-rate',
                label: `${ko.overview.nationwideValue} · ${ko.overview.rate}`,
                value: currentNational?.rate ?? null,
                unit: 'percent',
                note: ko.overview.computedRate,
              },
              {
                key: 'previous-year',
                label: ko.overview.previousYear,
                value: countDelta,
                unit: 'count',
                deltaPct: countDeltaPct,
              },
              {
                key: 'first-year',
                label: ko.overview.firstYear,
                value: firstYearDelta,
                unit: 'count',
                note: `${firstYear} ${ko.overview.referenceYear}`,
              },
            ]}
          />
          <p className="mt-4 text-small text-[var(--km-color-text-muted)]">
            {ko.overview.referenceYear}: {filters.year} · {ko.overview.updatedAt}:{' '}
            {payload.retrievedAtLabel}
          </p>
        </Card>
      </section>

      <Card title={ko.ethics.termTitle} description={ko.ethics.definition}>
        <div className="space-y-3 text-sm leading-6 text-[var(--km-color-text-muted)]">
          <p>{ko.ethics.limitation}</p>
          <p>{ko.ethics.perspective}</p>
          <p>{ko.ethics.noCausalInterpretation}</p>
        </div>
      </Card>

      <section id="filters" aria-label={ko.filters.title}>
        <Card>
          <FilterBar
            years={payload.years}
            year={filters.year}
            onYearChange={(year) => updateQuery({ year })}
            levels={levelOptions}
            level={filters.level}
            onLevelChange={(level) => {
              const parsed = schoolLevelSchema.safeParse(level);
              if (parsed.success) updateQuery({ level: parsed.data });
            }}
            metric={filters.metric}
            onMetricChange={(metric) => updateQuery({ metric })}
            selectedRegions={filters.regions}
            onRegionsChange={(regions) => updateQuery({ regions: regions as RegionCode[] })}
            regions={regionOptions}
            studentTypeNotice={ko.filters.studentTypeUnavailable}
          />
          {filters.hasTooManyRegions ? (
            <p className="mt-3 text-small text-destructive" role="alert">
              {ko.errors.tooManyRegions}
            </p>
          ) : null}
        </Card>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <Card title={ko.map.title} description={ko.map.description}>
          <ChoroplethMap
            geo={payload.geo}
            data={mapData}
            scale={mapScale}
            selectedRegion={selectedRegion}
            onSelectRegion={handleMapSelection}
            formatValue={(value) =>
              filters.metric === 'count'
                ? formatCount(value, ko.missing.value)
                : formatRate(value, ko.missing.value)
            }
            regionLabels={payload.regionLabels}
            ranks={mapRanks}
            year={filters.year}
            metricLabel={ko.filters.metrics[filters.metric]}
            missingLabel={ko.map.missingLegend}
          />
          <div className="mt-4 space-y-3">
            <MapLegend
              scale={mapScale}
              metricLabel={ko.filters.metrics[filters.metric]}
              formatValue={(value) =>
                filters.metric === 'count'
                  ? formatCount(value, ko.missing.value)
                  : formatRate(value, ko.missing.value)
              }
              missingLabel={ko.map.missingLegend}
              kind={mapScale.kind}
            />
            <p className="text-small text-[var(--km-color-text-muted)]">{ko.map.keyboardHint}</p>
            <p className="text-small text-[var(--km-color-text-muted)]">{ko.map.scaleNote}</p>
            {mapLimitReached && filters.regions.length >= 3 ? (
              <p className="text-small text-destructive" role="alert">
                {ko.errors.tooManyRegions}
              </p>
            ) : null}
          </div>
        </Card>

        <Card title={ko.ranking.title}>
          <div className="space-y-5">
            <Badge tone="info">{ko.ranking.interpretationNote}</Badge>
            <RankingBarChart
              rows={rankingChartRows}
              formatValue={(value) =>
                filters.metric === 'count'
                  ? formatCount(value, ko.missing.value)
                  : formatRate(value, ko.missing.value)
              }
              highlightRegion={selectedRegion ?? undefined}
            />
            <RankingTable
              metric={filters.metric}
              rows={rankingRows}
              excludedRegions={[]}
              caption={ko.filters.metrics[filters.metric]}
              disclaimer={ko.ranking.missingNote}
            />
            <div className="grid min-w-0 gap-5 xl:grid-cols-2">
              {(['deltaAbs', 'deltaPct'] as const).map((rankingMetric) => (
                <section className="min-w-0 space-y-3" key={rankingMetric}>
                  <h3 className="text-base font-medium">
                    {rankingMetric === 'deltaAbs' ? ko.ranking.deltaAbs : ko.ranking.deltaPct}
                  </h3>
                  <RankingTable
                    metric={rankingMetric}
                    rows={rankingRowsByMetric[rankingMetric]}
                    excludedRegions={[]}
                    caption={
                      rankingMetric === 'deltaAbs' ? ko.ranking.deltaAbs : ko.ranking.deltaPct
                    }
                    disclaimer={ko.ranking.missingNote}
                  />
                </section>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <section id="region-detail" aria-label={ko.regionDetail.title}>
        <Card title={ko.regionDetail.title}>
          {selectedDetailData ? (
            <div className="space-y-5">
              <RegionDetailPanel
                detail={
                  filters.metric === 'count'
                    ? selectedDetailData
                    : { ...selectedDetailData, trend: [] }
                }
                onClose={() =>
                  updateQuery({
                    regions:
                      selectedRegion === null
                        ? filters.regions
                        : filters.regions.filter((region) => region !== selectedRegion),
                  })
                }
                nationalLabel={ko.overview.nationwideValue}
              />
              {filters.metric === 'rate' && selectedRegion !== null ? (
                <section className="space-y-2" aria-label={ko.filters.metrics.rate}>
                  <h3 className="font-medium">
                    {ko.trend.title} · {ko.filters.metrics.rate}
                  </h3>
                  <TrendChart
                    series={selectedTrend
                      .filter((series) => series.regionCode === selectedRegion)
                      .map((series) => ({
                        regionCode: series.regionCode,
                        label: series.regionNameKo,
                        points: series.points,
                      }))}
                    metric="rate"
                    formatValue={(value) => formatRate(value, ko.missing.value)}
                  />
                </section>
              ) : null}
            </div>
          ) : (
            <EmptyState title={ko.regionDetail.title} description={ko.regionDetail.selectPrompt} />
          )}
        </Card>
      </section>

      <section id="trend" aria-label={ko.trend.title}>
        <Card title={ko.trend.title} description={ko.trend.coverageNote}>
          <div className="grid min-w-0 gap-8 lg:grid-cols-2">
            <section className="min-w-0 space-y-3" aria-labelledby="national-trend-title">
              <h3 id="national-trend-title" className="text-base font-medium">
                {ko.trend.nationwide}
              </h3>
              <TrendChart
                series={nationwideTrend.map((series) => ({
                  regionCode: series.regionCode,
                  label: series.regionNameKo,
                  points: series.points,
                }))}
                metric={filters.metric}
                formatValue={(value) =>
                  filters.metric === 'count'
                    ? formatCount(value, ko.missing.value)
                    : formatRate(value, ko.missing.value)
                }
              />
            </section>
            <section className="min-w-0 space-y-3" aria-labelledby="selected-trend-title">
              <h3 id="selected-trend-title" className="text-base font-medium">
                {ko.trend.selectedRegions}
              </h3>
              {selectedTrend.length > 0 ? (
                <TrendChart
                  series={selectedTrend.map((series) => ({
                    regionCode: series.regionCode,
                    label: series.regionNameKo,
                    points: series.points,
                  }))}
                  metric={filters.metric}
                  formatValue={(value) =>
                    filters.metric === 'count'
                      ? formatCount(value, ko.missing.value)
                      : formatRate(value, ko.missing.value)
                  }
                />
              ) : (
                <EmptyState
                  title={ko.trend.selectedRegions}
                  description={ko.regionDetail.selectPrompt}
                />
              )}
            </section>
          </div>
          <div className="mt-4 space-y-1 text-small text-[var(--km-color-text-muted)]">
            <p>{ko.trend.missingSegment}</p>
            <p>{ko.trend.maxRegionsNote}</p>
          </div>
        </Card>
      </section>

      <section id="sources" aria-label={ko.sources.title}>
        <Card>
          <SourcePanel
            sources={payload.sources}
            rateFormula={payload.rateFormula}
            notes={[
              ko.sources.ratePrecisionNote,
              ko.sources.schoolLevelNote,
              ko.sources.sourceStatusNote,
            ]}
          />
        </Card>
      </section>

      <section id="downloads" aria-label={ko.download.title}>
        <Card title={ko.download.title}>
          <DownloadButtons
            onDownloadFiltered={downloadFiltered}
            onDownloadAll={downloadAllCsv}
            onDownloadDictionary={downloadDictionary}
            labels={{
              filtered: ko.download.currentFilterCsv,
              all: ko.download.fullCsv,
              dictionary: ko.download.dictionary,
            }}
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="btn" onClick={downloadAllJson}>
              {ko.download.fullJson}
            </button>
          </div>
          <p className="mt-3 text-small text-[var(--km-color-text-muted)]">
            {ko.download.utf8BomNote} {ko.download.provenanceNote}
          </p>
        </Card>
      </section>
    </div>
  );
}
