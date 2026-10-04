'use client';

import { useMemo, useState } from 'react';
import type { ExtendedFeatureCollection as FeatureCollection } from 'd3-geo';

import { TrendChart } from '@/components/charts/TrendChart';
import { DownloadButtons } from '@/components/dashboard/DownloadButtons';
import { RankingTable, type RankingTableRow } from '@/components/dashboard/RankingTable';
import { SourcePanel, type SourcePanelSource } from '@/components/dashboard/SourcePanel';
import { RegionMapCard } from '@/components/map/RegionMapCard';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricCardRow } from '@/components/dashboard/MetricCardRow';
import { SelectField } from '@/components/ui/SelectField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useUrlQuery } from '@/hooks/use-url-query';
import { ko } from '@/content/ko';
import { triggerDownload } from '@/lib/browser/download';
import { readRegions, readYear, toggleRegion } from '@/lib/url-filters';
import { fillTemplate, formatYearRange } from '@/content/template';
import { difference, percentageDifference } from '@/lib/data/compare';
import { markedYearPairs } from '@/lib/data/foreign-duplicates';
import type { ForeignRankingRow, ForeignTrendSeries } from '@/lib/data/foreign';
import { toForeignCsv } from '@/lib/data/foreign-csv';
import type { ForeignNationwideStat, ForeignStudentStat } from '@/lib/schema/foreign-student';
import { metricKeySchema, type MetricKey, type RegionCode } from '@/lib/schema';
import { formatCount, formatMetricValue } from '@/lib/visualization/format';
import { createCountScale, createRateScale } from '@/lib/visualization/scale';
import type { SeriesSlot } from '@/lib/visualization/series-style';

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

function readFilters(searchParams: URLSearchParams, years: number[]): FilterState {
  const requestedMetric = metricKeySchema.safeParse(searchParams.get('metric'));
  return {
    year: readYear(searchParams, years),
    metric: requestedMetric.success ? requestedMetric.data : 'count',
    ...readRegions(searchParams),
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

export function ForeignStudentsClient({ payload }: ForeignStudentsClientProps) {
  const { searchString, updateQuery } = useUrlQuery();
  const [mapLimitReached, setMapLimitReached] = useState(false);
  const filters = useMemo(
    () => readFilters(new URLSearchParams(searchString), payload.years),
    [payload.years, searchString],
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
    return filters.metric === 'count' ? createCountScale(values) : createRateScale(values);
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
  // 동일 연도 구간은 스냅숏의 타입 표식(sourceDuplicateOf)으로 찾는다 — 주석 문구 비교 금지.
  const duplicatePairs = useMemo(
    () => markedYearPairs(payload.regionalRecords),
    [payload.regionalRecords],
  );
  const duplicateNotices = useMemo(
    () =>
      duplicatePairs.map(([earlier, later]) =>
        fillTemplate(ko.foreignStudents.trend.duplicateYearNotice, { earlier, later }),
      ),
    [duplicatePairs],
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
                record.sourceDuplicateOf !== null,
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
    const next = toggleRegion(filters.regions, code, selectedRegion);
    setMapLimitReached(next.limitReached);
    if (next.regions !== null) updateQuery({ regions: next.regions });
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
        {/* 모집단 안내는 페이지 맨 위에 한 번만 둔다 (여기서 되풀이하지 않는다). */}
        <Card title={ko.foreignStudents.overview.title}>
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
          <div className="flex min-w-0 flex-wrap items-end gap-x-5 gap-y-4">
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
          <RegionMapCard
            title={ko.foreignStudents.map.title}
            description={ko.foreignStudents.map.description}
            geo={payload.geo}
            data={mapData}
            scale={mapScale}
            selectedRegion={selectedRegion}
            onSelectRegion={handleMapSelection}
            formatValue={(value) => formatMetricValue(filters.metric, value, ko.missing.value)}
            regionLabels={payload.regionLabels}
            ranks={mapRanks}
            year={filters.year}
            metricLabel={ko.foreignStudents.filters.metrics[filters.metric]}
            missingLabel={ko.missing.label}
            notes={[ko.foreignStudents.map.keyboardHint, ko.foreignStudents.map.scaleNote]}
            limitWarning={
              mapLimitReached && filters.regions.length >= 3 ? ko.errors.tooManyRegions : null
            }
          />
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
                highlightRegions={filters.regions}
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
          {duplicatePairs.length > 0 ? (
            <div className="mb-6 space-y-3" role="note">
              {duplicatePairs.map(([earlier, later], index) => (
                <div className="space-y-2" key={`${earlier}-${later}`}>
                  <Badge tone="caution">{duplicateNotices[index]}</Badge>
                  <p className="text-small text-[var(--km-color-text-muted)]">
                    {fillTemplate(ko.foreignStudents.trend.sourceDuplicateNote, { year: earlier })}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:items-end">
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
                  // 계열색 자리는 고른 순서를 따른다 — 지역을 더해도 먼저 고른 지역의 색이 유지된다.
                  series={selectedTrend.map((series) => ({
                    regionCode: series.regionCode,
                    label: series.regionNameKo,
                    points: seriesForMetric(series, filters.metric),
                    slot: (filters.regions.indexOf(series.regionCode) + 1) as SeriesSlot,
                  }))}
                  metric={filters.metric}
                  formatValue={(value) =>
                    formatMetricValue(filters.metric, value, ko.missing.value)
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
          {/* 패널 제목이 이미 '외국인 유학생 출처 및 계산식'이다 — 안쪽 제목을 되풀이하지 않는다. */}
          <SourcePanel
            heading={false}
            sources={payload.sources}
            rateFormula={payload.rateFormula}
            notes={[
              fillTemplate(ko.foreignStudents.sources.regionalNote, regionalRange),
              fillTemplate(ko.foreignStudents.sources.nationwideNote, nationwideRange),
              ...duplicateNotices,
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
