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
import { fillTemplate, formatYearRange } from '@/content/template';
import { snapshotToCsv, toCsv } from '@/lib/data/csv';
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
  type RegionScope,
  type SchoolLevel,
  type Snapshot,
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
  records: CompactRecord[];
  noteSets: string[][];
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
  dictionary: string;
}

export type CompactRecord = readonly [
  yearIndex: number,
  regionIndex: number,
  levelIndex: number,
  count: number | null,
  totalStudents: number | null,
  rate: number | null,
  notesIndex: number,
];

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

interface CompactIndex {
  years: ReadonlyMap<number, number>;
  regions: ReadonlyMap<RegionScope, number>;
  levels: ReadonlyMap<SchoolLevel, number>;
  records: ReadonlyMap<string, CompactRecord>;
  noteSets: readonly string[][];
}

interface DashboardSelectors {
  selectView(year: number, regionCode: RegionScope, level: SchoolLevel): StatView;
  selectNational(year: number, level: SchoolLevel): StatView | null;
  selectByRegion(year: number, level: SchoolLevel): StatView[];
  selectRanking(year: number, level: SchoolLevel, metric: RankingTableMetric): RankingRow[];
  selectTrend(codes: RegionScope[], level: SchoolLevel, metric: MetricKey): TrendSeries[];
  selectRegionDetail(code: RegionCode, year: number, level: SchoolLevel): RegionDetail | null;
}

function compactRecordKey(yearIndex: number, regionIndex: number, levelIndex: number): string {
  return `${yearIndex}|${regionIndex}|${levelIndex}`;
}

function createCompactIndex(payload: DashboardPayload): CompactIndex {
  const dataRegionCodes: RegionScope[] = ['KR', ...payload.regionCodes];
  return {
    years: new Map(payload.years.map((year, index) => [year, index] as const)),
    regions: new Map(dataRegionCodes.map((regionCode, index) => [regionCode, index] as const)),
    levels: new Map(payload.levels.map((level, index) => [level, index] as const)),
    records: new Map(
      payload.records.map(
        (record) => [compactRecordKey(record[0], record[1], record[2]), record] as const,
      ),
    ),
    noteSets: payload.noteSets,
  };
}

function recordAt(
  index: CompactIndex,
  year: number,
  regionCode: RegionScope,
  level: SchoolLevel,
): CompactRecord | undefined {
  const yearIndex = index.years.get(year);
  const regionIndex = index.regions.get(regionCode);
  const levelIndex = index.levels.get(level);
  if (yearIndex === undefined || regionIndex === undefined || levelIndex === undefined) {
    return undefined;
  }
  return index.records.get(compactRecordKey(yearIndex, regionIndex, levelIndex));
}

function regionNameKo(regionCode: RegionScope, regionLabels: Record<string, string>): string {
  return regionCode === 'KR' ? '전국' : (regionLabels[regionCode] ?? regionCode);
}

function emptyView(regionCode: RegionScope, regionLabels: Record<string, string>): StatView {
  return {
    regionCode,
    regionNameKo: regionNameKo(regionCode, regionLabels),
    count: null,
    totalStudents: null,
    rate: null,
    isMissing: true,
  };
}

function toView(
  record: CompactRecord | undefined,
  regionCode: RegionScope,
  regionLabels: Record<string, string>,
): StatView {
  if (record === undefined) return emptyView(regionCode, regionLabels);
  return {
    regionCode,
    regionNameKo: regionNameKo(regionCode, regionLabels),
    count: record[3],
    totalStudents: record[4],
    rate: record[5],
    isMissing: record[3] === null || record[5] === null,
  };
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function createDashboardSelectors(
  payload: DashboardPayload,
  index: CompactIndex,
): DashboardSelectors {
  function selectView(year: number, regionCode: RegionScope, level: SchoolLevel): StatView {
    return toView(recordAt(index, year, regionCode, level), regionCode, payload.regionLabels);
  }

  function selectNational(year: number, level: SchoolLevel): StatView | null {
    const record = recordAt(index, year, 'KR', level);
    return record === undefined ? null : toView(record, 'KR', payload.regionLabels);
  }

  function selectByRegion(year: number, level: SchoolLevel): StatView[] {
    return payload.regionCodes.map((regionCode) => selectView(year, regionCode, level));
  }

  function valueForMetric(
    year: number,
    regionCode: RegionCode,
    level: SchoolLevel,
    metric: RankingTableMetric,
  ): number | null {
    const current = recordAt(index, year, regionCode, level);
    if (current === undefined) return null;
    if (metric === 'count') return current[3];
    if (metric === 'rate') return current[5];
    const previous = recordAt(index, year - 1, regionCode, level);
    if (previous === undefined || current[3] === null || previous[3] === null) return null;
    if (metric === 'deltaAbs') return current[3] - previous[3];
    if (previous[3] === 0) return null;
    return (current[3] / previous[3] - 1) * 100;
  }

  function selectRanking(
    year: number,
    level: SchoolLevel,
    metric: RankingTableMetric,
  ): RankingRow[] {
    const candidates = payload.regionCodes
      .flatMap((regionCode) => {
        const value = valueForMetric(year, regionCode, level, metric);
        return value === null ? [] : [{ regionCode, value: round4(value) }];
      })
      .sort(
        (left, right) =>
          right.value - left.value || left.regionCode.localeCompare(right.regionCode),
      );

    return candidates.map((candidate, index) => {
      const previous = candidates[index - 1];
      const next = candidates[index + 1];
      const isTied = previous?.value === candidate.value || next?.value === candidate.value;
      return {
        rank: candidates.findIndex((entry) => entry.value === candidate.value) + 1,
        regionCode: candidate.regionCode,
        regionNameKo: regionNameKo(candidate.regionCode, payload.regionLabels),
        value: candidate.value,
        isTied,
      };
    });
  }

  function selectTrend(codes: RegionScope[], level: SchoolLevel, metric: MetricKey): TrendSeries[] {
    return codes.map((regionCode) => ({
      regionCode,
      regionNameKo: regionNameKo(regionCode, payload.regionLabels),
      points: payload.years.map((year) => {
        const record = recordAt(index, year, regionCode, level);
        return {
          year,
          value: record === undefined ? null : metric === 'count' ? record[3] : record[5],
        };
      }),
    }));
  }

  function selectRegionDetail(
    code: RegionCode,
    year: number,
    level: SchoolLevel,
  ): RegionDetail | null {
    const current = recordAt(index, year, code, level);
    if (current === undefined) return null;
    const national = recordAt(index, year, 'KR', level);
    const previous = recordAt(index, year - 1, code, level);
    const rankRow = selectRanking(year, level, 'count').find((row) => row.regionCode === code);
    const deltaAbs =
      current[3] !== null && previous !== undefined && previous[3] !== null
        ? current[3] - previous[3]
        : null;
    const deltaPct =
      deltaAbs !== null && previous !== undefined && previous[3] !== null && previous[3] !== 0
        ? round4((deltaAbs / previous[3]) * 100)
        : null;
    const byLevel: LevelStatView[] = (['elementary', 'middle', 'high', 'other'] as const).map(
      (schoolLevel) => ({
        ...toView(recordAt(index, year, code, schoolLevel), code, payload.regionLabels),
        schoolLevel,
      }),
    );
    const trend = selectTrend([code], level, 'count')[0]?.points ?? [];
    return {
      regionCode: code,
      nameKo: regionNameKo(code, payload.regionLabels),
      count: current[3],
      rate: current[5],
      rank: rankRow?.rank ?? null,
      diffFromNational:
        current[5] !== null && national !== undefined && national[5] !== null
          ? round4(current[5] - national[5])
          : null,
      deltaAbs,
      deltaPct,
      byLevel,
      trend,
      notes: [...(index.noteSets[current[6]] ?? [])],
    };
  }

  return {
    selectView,
    selectNational,
    selectByRegion,
    selectRanking,
    selectTrend,
    selectRegionDetail,
  };
}

async function loadFullSnapshot(): Promise<Snapshot> {
  const snapshotModule = await import('../../data/snapshots/multicultural-students.v1.json');
  return snapshotModule.default as Snapshot;
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

  const compactIndex = useMemo(() => createCompactIndex(payload), [payload]);
  const selectors = useMemo(
    () => createDashboardSelectors(payload, compactIndex),
    [compactIndex, payload],
  );
  const currentViews = useMemo(
    () => selectors.selectByRegion(filters.year, filters.level),
    [filters.level, filters.year, selectors],
  );
  const currentNational = useMemo(
    () => selectors.selectNational(filters.year, filters.level),
    [filters.level, filters.year, selectors],
  );
  const previousNational = useMemo(
    () => selectors.selectNational(filters.year - 1, filters.level),
    [filters.level, filters.year, selectors],
  );
  const firstYear = payload.years[0] ?? filters.year;
  const firstNational = useMemo(
    () => selectors.selectNational(firstYear, filters.level),
    [firstYear, filters.level, selectors],
  );
  const currentRanking = useMemo(
    () => selectors.selectRanking(filters.year, filters.level, filters.metric),
    [filters.level, filters.metric, filters.year, selectors],
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
  // 척도는 선택 연도가 아니라 수록 전 연도 값으로 만든다 — 연도를 바꿔도 같은 색이
  // 같은 값을 뜻해야 연도 간 비교가 가능하다 (ko.map.scaleNote).
  const scaleValues = useMemo(
    () =>
      payload.years.flatMap((year) =>
        selectors.selectByRegion(year, filters.level).map(metricValue),
      ),
    [filters.level, metricValue, payload.years, selectors],
  );
  const mapScale = useMemo(
    () =>
      filters.metric === 'count'
        ? createCountScale(scaleValues, 'light')
        : createRateScale(scaleValues, 'light'),
    [filters.metric, scaleValues],
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
        const rows = selectors.selectRanking(filters.year, filters.level, rankingMetric);
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
  }, [currentViews, filters.level, filters.year, selectors]);
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
        : selectors.selectRegionDetail(selectedRegion, filters.year, filters.level),
    [filters.level, filters.year, selectedRegion, selectors],
  );
  const selectedPrevious = useMemo(
    () =>
      selectedRegion === null
        ? null
        : (selectors
            .selectByRegion(filters.year - 1, filters.level)
            .find((view) => view.regionCode === selectedRegion) ?? null),
    [filters.level, filters.year, selectedRegion, selectors],
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
    () => selectors.selectTrend(['KR', ...payload.regionCodes], filters.level, filters.metric),
    [filters.level, filters.metric, payload.regionCodes, selectors],
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
    void loadFullSnapshot().then((snapshot) => {
      triggerDownload(snapshotToCsv(snapshot), 'k-mosaic-full.csv', 'text/csv;charset=utf-8');
    });
  }

  function downloadAllJson(): void {
    void loadFullSnapshot().then((snapshot) => {
      triggerDownload(
        JSON.stringify(snapshot, null, 2),
        'multicultural-students.v1.json',
        'application/json;charset=utf-8',
      );
    });
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
                delta: countDelta,
                deltaPct: countDeltaPct,
                display: 'delta',
              },
              {
                key: 'first-year',
                label: ko.overview.firstYear,
                value: firstYearDelta,
                unit: 'count',
                delta: firstYearDelta,
                display: 'delta',
                note: `${firstYear} ${ko.overview.referenceYear}`,
              },
            ]}
          />
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

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
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
            <p className="text-small text-[var(--km-color-text-muted)]" role="note">
              {ko.ranking.missingNote}
            </p>
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
            />
            <div className="grid min-w-0 gap-5">
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
                  />
                </section>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <section id="region-detail" className="min-w-0" aria-label={ko.regionDetail.title}>
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
              <EmptyState description={ko.regionDetail.selectPrompt} />
            )}
          </Card>
        </section>

        <section id="trend" className="min-w-0" aria-label={ko.trend.title}>
          <Card
            title={ko.trend.title}
            description={fillTemplate(ko.trend.coverageNote, formatYearRange(payload.years))}
          >
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
                  <EmptyState description={ko.regionDetail.selectPrompt} />
                )}
              </section>
            </div>
            <div className="mt-4 space-y-1 text-small text-[var(--km-color-text-muted)]">
              <p>{ko.trend.missingSegment}</p>
              <p>{ko.trend.maxRegionsNote}</p>
            </div>
          </Card>
        </section>
      </div>

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
