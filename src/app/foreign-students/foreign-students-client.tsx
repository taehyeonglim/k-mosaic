'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import type { ExtendedFeatureCollection as FeatureCollection } from 'd3-geo';

import { TrendChart } from '@/components/charts/TrendChart';
import { DownloadButtons } from '@/components/dashboard/DownloadButtons';
import { RankingTable, type RankingTableRow } from '@/components/dashboard/RankingTable';
import { SourcePanel, type SourcePanelSource } from '@/components/dashboard/SourcePanel';
import { MapLegend } from '@/components/map/MapLegend';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCardRow } from '@/components/dashboard/MetricCardRow';
import { SelectField } from '@/components/ui/SelectField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ko } from '@/content/ko';
import { fillTemplate, formatYearRange } from '@/content/template';
import { toForeignCsv, type ForeignRankingRow, type ForeignTrendSeries } from '@/lib/data/foreign';
import type { ForeignNationwideStat, ForeignStudentStat } from '@/lib/schema/foreign-student';
import { metricKeySchema, regionCodeSchema, type MetricKey, type RegionCode } from '@/lib/schema';
import { formatCount, formatRate } from '@/lib/visualization/format';
import { createCountScale, createRateScale } from '@/lib/visualization/scale';

const ChoroplethMap = dynamic(
  () => import('@/components/map/ChoroplethMap').then((module) => module.ChoroplethMap),
  {
    ssr: false,
    loading: () => <p className="text-small text-[var(--km-color-text-muted)]">{ko.map.title}</p>,
  },
);

export interface ForeignStudentsPayload {
  geo: FeatureCollection;
  years: number[];
  regionCodes: RegionCode[];
  regionLabels: Record<string, string>;
  regionalRecords: ForeignStudentStat[];
  nationalRecords: ForeignStudentStat[];
  rankings: Record<
    string,
    {
      count: ForeignRankingRow[];
      rate: ForeignRankingRow[];
    }
  >;
  regionalTrend: ForeignTrendSeries[];
  nationwideTrend: ForeignNationwideStat[];
  sources: SourcePanelSource[];
  retrievedAtLabel: string;
  rateFormula: string;
}

interface ForeignStudentsClientProps {
  payload: ForeignStudentsPayload;
}

interface FilterState {
  year: number;
  metric: MetricKey;
  regions: RegionCode[];
  hasTooManyRegions: boolean;
}

interface FilterUpdates {
  year?: number;
  metric?: MetricKey;
  regions?: RegionCode[];
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
  const requestedMetric = metricKeySchema.safeParse(searchParams.get('metric'));
  const metric = requestedMetric.success ? requestedMetric.data : 'count';
  const regionTokens = (searchParams.get('regions') ?? '').split(',').filter(Boolean);
  const parsedRegions = regionTokens.flatMap((token) => {
    const parsed = regionCodeSchema.safeParse(token);
    return parsed.success ? [parsed.data] : [];
  });

  return {
    year,
    metric,
    regions: Array.from(new Set(parsedRegions)).slice(0, 3),
    hasTooManyRegions: parsedRegions.length > 3,
  };
}

function valueForMetric(record: ForeignStudentStat | undefined, metric: MetricKey): number | null {
  if (record === undefined) return null;
  return metric === 'count' ? record.foreignStudentCount : record.foreignStudentRateComputed;
}

function seriesForMetric(
  series: ForeignTrendSeries,
  metric: MetricKey,
): { year: number; value: number | null }[] {
  return series.points.map((point) => ({
    year: point.year,
    value: metric === 'count' ? point.foreignStudentCount : point.foreignStudentRateComputed,
  }));
}

function triggerDownload(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ForeignStudentsClient({ payload }: ForeignStudentsClientProps) {
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

  const currentRecords = useMemo(
    () => payload.regionalRecords.filter((record) => record.year === filters.year),
    [filters.year, payload.regionalRecords],
  );
  const currentByCode = useMemo(
    () => new Map(currentRecords.map((record) => [record.regionCode, record] as const)),
    [currentRecords],
  );
  const currentNational = useMemo(
    () => payload.nationalRecords.find((record) => record.year === filters.year) ?? null,
    [filters.year, payload.nationalRecords],
  );
  const previousNational = useMemo(
    () => payload.nationalRecords.find((record) => record.year === filters.year - 1) ?? null,
    [filters.year, payload.nationalRecords],
  );
  const currentRanking = useMemo(
    () => payload.rankings[String(filters.year)]?.[filters.metric] ?? [],
    [filters.metric, filters.year, payload.rankings],
  );
  const rankingByCode = useMemo(
    () => new Map(currentRanking.map((row) => [row.regionCode, row] as const)),
    [currentRanking],
  );
  const rankingRows = useMemo<RankingTableRow[]>(
    () =>
      payload.regionCodes.map((regionCode) => {
        const record = currentByCode.get(regionCode);
        const ranking = rankingByCode.get(regionCode);
        return {
          rank: ranking?.rank ?? 0,
          regionCode,
          label: payload.regionLabels[regionCode] ?? record?.regionNameKo ?? regionCode,
          value: valueForMetric(record, filters.metric),
          isTied: ranking?.isTied ?? false,
        };
      }),
    [currentByCode, filters.metric, payload.regionCodes, payload.regionLabels, rankingByCode],
  );
  const mapData = useMemo(
    () =>
      payload.regionCodes.map((regionCode) => ({
        regionCode,
        value: valueForMetric(currentByCode.get(regionCode), filters.metric),
      })),
    [currentByCode, filters.metric, payload.regionCodes],
  );
  const mapScale = useMemo(() => {
    const values = payload.regionalRecords.map((record) => valueForMetric(record, filters.metric));
    return filters.metric === 'count'
      ? createCountScale(values, 'light')
      : createRateScale(values, 'light');
  }, [filters.metric, payload.regionalRecords]);
  const mapRanks = useMemo(
    () =>
      Object.fromEntries(
        payload.regionCodes.map((regionCode) => [
          regionCode,
          rankingByCode.get(regionCode)?.rank ?? null,
        ]),
      ),
    [payload.regionCodes, rankingByCode],
  );
  const selectedRegion = filters.regions[filters.regions.length - 1] ?? null;
  const selectedTrend = useMemo(
    () => payload.regionalTrend.filter((series) => filters.regions.includes(series.regionCode)),
    [filters.regions, payload.regionalTrend],
  );
  // 수록 기간 문구는 스냅숏 연도에서 채운다 (시도별: payload.years, 전국 장기: nationwideTrend).
  const regionalRange = useMemo(() => formatYearRange(payload.years), [payload.years]);
  const nationwideRange = useMemo(
    () => formatYearRange(payload.nationwideTrend.map((row) => row.year)),
    [payload.nationwideTrend],
  );
  const duplicateYears = useMemo(
    () =>
      Array.from(
        new Set(
          payload.regionalRecords
            .filter((record) => record.notes.includes(ko.foreignStudents.trend.sourceDuplicateNote))
            .map((record) => record.year),
        ),
      ).sort((left, right) => left - right),
    [payload.regionalRecords],
  );
  const selectedDuplicateYears = useMemo(
    () =>
      Array.from(
        new Set(
          payload.regionalRecords
            .filter(
              (record) =>
                record.regionCode !== 'KR' &&
                filters.regions.includes(record.regionCode) &&
                record.notes.includes(ko.foreignStudents.trend.sourceDuplicateNote),
            )
            .map((record) => record.year),
        ),
      ).sort((left, right) => left - right),
    [filters.regions, payload.regionalRecords],
  );
  const duplicateAnnotations = useMemo(
    () =>
      selectedDuplicateYears.map((year) => ({
        year,
        label: ko.foreignStudents.trend.duplicateMarker,
      })),
    [selectedDuplicateYears],
  );
  const nationwideTrendSeries = useMemo(
    () => [
      {
        regionCode: 'degree-and-training',
        label: ko.foreignStudents.trend.degreeAndTraining,
        points: payload.nationwideTrend.map((record) => ({
          year: record.year,
          value: record.degreeAndTraining,
        })),
      },
      {
        regionCode: 'degree-only',
        label: ko.foreignStudents.trend.degreeOnly,
        points: payload.nationwideTrend.map((record) => ({
          year: record.year,
          value: record.degreeOnly,
        })),
      },
    ],
    [payload.nationwideTrend],
  );
  const countDelta = difference(
    currentNational?.foreignStudentCount ?? null,
    previousNational?.foreignStudentCount ?? null,
  );
  const countDeltaPct = percentageDifference(
    currentNational?.foreignStudentCount ?? null,
    previousNational?.foreignStudentCount ?? null,
  );

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
    triggerDownload(
      toForeignCsv(currentRecords, {
        source: ko.foreignStudents.download.sourceLabel,
        referenceYear: filters.year,
        formula: payload.rateFormula,
      }),
      `k-mosaic-foreign-students-${filters.year}.csv`,
    );
  }

  function downloadAll(): void {
    triggerDownload(
      toForeignCsv(
        [...payload.regionalRecords, ...payload.nationalRecords, ...payload.nationwideTrend],
        {
          source: ko.foreignStudents.download.sourceLabel,
          referenceYear: filters.year,
          formula: payload.rateFormula,
        },
      ),
      'k-mosaic-foreign-students-full.csv',
    );
  }

  function downloadNationwide(): void {
    triggerDownload(
      toForeignCsv(payload.nationwideTrend, {
        source: ko.foreignStudents.download.sourceLabel,
        referenceYear: filters.year,
        formula: payload.rateFormula,
      }),
      'k-mosaic-foreign-students-nationwide.csv',
    );
  }

  return (
    <div className="space-y-8">
      <section id="foreign-overview" aria-label={ko.foreignStudents.overview.title}>
        <Card
          title={ko.foreignStudents.overview.title}
          description={ko.foreignStudents.populationNotice}
        >
          <MetricCardRow
            items={[
              {
                key: 'foreign-student-count',
                label: ko.foreignStudents.overview.studentCount,
                value: currentNational?.foreignStudentCount ?? null,
                unit: 'count',
                delta: countDelta,
                deltaPct: countDeltaPct,
                note: ko.foreignStudents.overview.yoyNote,
              },
              {
                key: 'foreign-student-rate',
                label: `${ko.overview.nationwideValue} · ${ko.foreignStudents.overview.rate}`,
                value: currentNational?.foreignStudentRateComputed ?? null,
                unit: 'percent',
                note: `${ko.foreignStudents.overview.denominatorNote}: ${formatCount(currentNational?.enrolledStudentCount ?? null, ko.missing.value)}`,
              },
            ]}
          />
          <p className="mt-4 text-small text-[var(--km-color-text-muted)]">
            {ko.overview.referenceYear}: {filters.year} · {ko.overview.updatedAt}:{' '}
            {payload.retrievedAtLabel}
          </p>
        </Card>
      </section>

      <section id="foreign-filters" aria-label={ko.foreignStudents.filters.title}>
        <Card title={ko.foreignStudents.filters.title}>
          <div className="grid min-w-0 gap-5 sm:grid-cols-2">
            <SelectField
              id="foreign-filter-year"
              label={ko.foreignStudents.filters.year}
              value={String(filters.year)}
              options={payload.years.map((year) => ({ value: String(year), label: String(year) }))}
              onChange={(value) => updateQuery({ year: Number(value) })}
            />
            <SegmentedControl
              label={ko.foreignStudents.filters.metric}
              options={[
                { value: 'count' as const, label: ko.foreignStudents.filters.metrics.count },
                { value: 'rate' as const, label: ko.foreignStudents.filters.metrics.rate },
              ]}
              value={filters.metric}
              onChange={(metric) => updateQuery({ metric })}
            />
          </div>
          <p className="mt-4 text-small text-[var(--km-color-text-muted)]">
            {ko.foreignStudents.filters.regionNote}
          </p>
          {filters.hasTooManyRegions ? (
            <p className="mt-3 text-small text-destructive" role="alert">
              {ko.errors.tooManyRegions}
            </p>
          ) : null}
        </Card>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <section id="foreign-map" aria-label={ko.foreignStudents.map.title}>
          <Card
            title={ko.foreignStudents.map.title}
            description={ko.foreignStudents.map.description}
          >
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
              metricLabel={ko.foreignStudents.filters.metrics[filters.metric]}
              missingLabel={ko.missing.label}
            />
            <div className="mt-4 space-y-3">
              <MapLegend
                scale={mapScale}
                metricLabel={ko.foreignStudents.filters.metrics[filters.metric]}
                formatValue={(value) =>
                  filters.metric === 'count'
                    ? formatCount(value, ko.missing.value)
                    : formatRate(value, ko.missing.value)
                }
                missingLabel={ko.missing.label}
                kind={mapScale.kind}
              />
              <p className="text-small text-[var(--km-color-text-muted)]">
                {ko.foreignStudents.map.keyboardHint}
              </p>
              <p className="text-small text-[var(--km-color-text-muted)]">
                {ko.foreignStudents.map.scaleNote}
              </p>
              {mapLimitReached && filters.regions.length >= 3 ? (
                <p className="text-small text-destructive" role="alert">
                  {ko.errors.tooManyRegions}
                </p>
              ) : null}
            </div>
          </Card>
        </section>

        <section id="foreign-ranking" aria-label={ko.foreignStudents.ranking.title}>
          <Card title={ko.foreignStudents.ranking.title}>
            <div className="space-y-5">
              <Badge tone="info">{ko.ranking.interpretationNote}</Badge>
              <RankingTable
                metric={filters.metric}
                rows={rankingRows}
                excludedRegions={[]}
                caption={
                  filters.metric === 'count'
                    ? ko.foreignStudents.ranking.countCaption
                    : ko.foreignStudents.ranking.rateCaption
                }
                disclaimer={ko.ranking.missingNote}
              />
            </div>
          </Card>
        </section>
      </div>

      <section id="foreign-trend" aria-label={ko.foreignStudents.trend.title}>
        <Card
          title={ko.foreignStudents.trend.title}
          description={fillTemplate(ko.foreignStudents.trend.coverageNote, {
            regionalStart: regionalRange.start,
            regionalEnd: regionalRange.end,
            nationwideStart: nationwideRange.start,
            nationwideEnd: nationwideRange.end,
          })}
        >
          {duplicateYears.length > 0 ? (
            <div className="mb-6 space-y-3" role="note">
              <Badge tone="caution">{ko.foreignStudents.trend.duplicateYearNotice}</Badge>
              <p className="text-small text-[var(--km-color-text-muted)]">
                {ko.foreignStudents.trend.sourceDuplicateNote}
              </p>
            </div>
          ) : null}
          <div className="grid min-w-0 gap-8 lg:grid-cols-2">
            <section className="min-w-0 space-y-3" aria-labelledby="foreign-nationwide-trend-title">
              <h3 id="foreign-nationwide-trend-title" className="text-base font-medium">
                {fillTemplate(ko.foreignStudents.trend.nationwideTitle, nationwideRange)}
              </h3>
              <TrendChart
                series={nationwideTrendSeries}
                metric="count"
                formatValue={(value) => formatCount(value, ko.missing.value)}
              />
            </section>
            <section className="min-w-0 space-y-3" aria-labelledby="foreign-regional-trend-title">
              <h3 id="foreign-regional-trend-title" className="text-base font-medium">
                {fillTemplate(ko.foreignStudents.trend.regionalTitle, regionalRange)}
              </h3>
              {selectedTrend.length > 0 ? (
                <TrendChart
                  series={selectedTrend.map((series) => ({
                    regionCode: series.regionCode,
                    label: series.regionNameKo,
                    points: seriesForMetric(series, filters.metric),
                  }))}
                  metric={filters.metric}
                  formatValue={(value) =>
                    filters.metric === 'count'
                      ? formatCount(value, ko.missing.value)
                      : formatRate(value, ko.missing.value)
                  }
                  annotations={duplicateAnnotations}
                />
              ) : (
                <EmptyState description={ko.foreignStudents.trend.selectPrompt} />
              )}
            </section>
          </div>
          <div className="mt-4 space-y-1 text-small text-[var(--km-color-text-muted)]">
            <p>{ko.foreignStudents.trend.missingSegment}</p>
          </div>
        </Card>
      </section>

      <section id="foreign-sources" aria-label={ko.foreignStudents.sources.title}>
        <Card title={ko.foreignStudents.sources.title}>
          <SourcePanel
            sources={payload.sources}
            rateFormula={payload.rateFormula}
            notes={[
              fillTemplate(ko.foreignStudents.sources.regionalNote, regionalRange),
              fillTemplate(ko.foreignStudents.sources.nationwideNote, nationwideRange),
              ko.foreignStudents.trend.duplicateYearNotice,
            ]}
          />
        </Card>
      </section>

      <section id="foreign-downloads" aria-label={ko.foreignStudents.download.title}>
        <Card title={ko.foreignStudents.download.title} description={ko.download.provenanceNote}>
          <DownloadButtons
            onDownloadFiltered={downloadFiltered}
            onDownloadAll={downloadAll}
            onDownloadDictionary={downloadNationwide}
            labels={{
              filtered: ko.foreignStudents.download.currentCsv,
              all: ko.foreignStudents.download.allCsv,
              dictionary: ko.foreignStudents.download.nationwideCsv,
            }}
          />
          <p className="mt-3 text-small text-[var(--km-color-text-muted)]">
            {ko.download.utf8BomNote} {ko.download.provenanceNote}
          </p>
        </Card>
      </section>
    </div>
  );
}
