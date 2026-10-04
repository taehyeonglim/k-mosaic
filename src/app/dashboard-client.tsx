'use client';

import { useCallback, useMemo, useState } from 'react';

import { TrendChart } from '@/components/charts/TrendChart';
import { DownloadButtons } from '@/components/dashboard/DownloadButtons';
import { useDashboard } from '@/components/dashboard/DashboardDataProvider';
import { FilterBar } from '@/components/dashboard/FilterBar';
import {
  RankingTable,
  type RankingTableMetric,
  type RankingTableRow,
} from '@/components/dashboard/RankingTable';
import { RegionDetailPanel, type RegionDetailData } from '@/components/dashboard/RegionDetailPanel';
import { SourcePanel } from '@/components/dashboard/SourcePanel';
import { RegionMapCard } from '@/components/map/RegionMapCard';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { useUrlQuery } from '@/hooks/use-url-query';
import { ko } from '@/content/ko';
import { triggerDownload } from '@/lib/browser/download';
import { BASE_PATH } from '@/lib/site';
import { readDashboardFilters, toggleRegion } from '@/lib/url-filters';
import { fillTemplate, formatYearRange } from '@/content/template';
import { difference } from '@/lib/data/compare';
import { dashboardScale } from '@/lib/data/dashboard-data';
import { snapshotToCsv, toCsv } from '@/lib/data/csv';
import type { LevelStatView, RankingRow, StatView } from '@/lib/data/types';
import { schoolLevelSchema, type RegionCode, type Snapshot } from '@/lib/schema';
import { formatMetricValue, formatRate } from '@/lib/visualization/format';
import type { SeriesSlot } from '@/lib/visualization/series-style';

async function loadFullSnapshot(): Promise<Snapshot> {
  const snapshotModule = await import('../../data/snapshots/multicultural-students.v1.json');
  return snapshotModule.default as Snapshot;
}

export function DashboardClient() {
  // payload 와 셀렉터는 히어로와 함께 쓴다 (DashboardDataProvider 가 한 번만 디코딩한다).
  const { payload, data } = useDashboard();
  const { selectors, nationwideSelectors } = data;
  const { searchString, updateQuery } = useUrlQuery();
  const [mapLimitReached, setMapLimitReached] = useState(false);
  const filters = useMemo(
    () => readDashboardFilters(new URLSearchParams(searchString), payload.years),
    [payload.years, searchString],
  );

  const currentViews = useMemo(
    () => selectors.selectByRegion(filters.year, filters.level),
    [filters.level, filters.year, selectors],
  );
  const currentNational = useMemo(
    () => selectors.selectNational(filters.year, filters.level),
    [filters.level, filters.year, selectors],
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
  // 지도와 히어로의 타일 모자이크가 같은 척도를 쓴다 (수록 전 연도 기준으로 고정).
  const mapScale = useMemo(
    () => dashboardScale(data, filters.level, filters.metric),
    [data, filters.level, filters.metric],
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
    // 전국 추세는 시도별(2020~)보다 긴 전국 장기 시계열(2016~)로 그린다.
    () => nationwideSelectors.selectTrend(['KR'], filters.level, filters.metric),
    [filters.level, filters.metric, nationwideSelectors],
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
  // 비교 지역의 계열색 자리 — 고른 순서를 따른다. 한 지역만 골랐어도 범주색을 써서,
  // 지역을 더했을 때 먼저 고른 지역의 색이 바뀌지 않게 한다.
  function regionSlot(code: string): SeriesSlot | undefined {
    const index = filters.regions.indexOf(code as RegionCode);
    return index >= 0 && index < 3 ? ((index + 1) as SeriesSlot) : undefined;
  }

  function handleMapSelection(code: string | null): void {
    const next = toggleRegion(filters.regions, code, selectedRegion);
    setMapLimitReached(next.limitReached);
    if (next.regions !== null) updateQuery({ regions: next.regions });
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
    // 데이터 사전은 payload 에 싣지 않고 정적 파일(app/data-dictionary.md)에서 받는다.
    void fetch(`${BASE_PATH}/data-dictionary.md`)
      .then((response) => response.text())
      .then((markdown) =>
        triggerDownload(markdown, 'k-mosaic-data-dictionary.md', 'text/markdown;charset=utf-8'),
      );
  }

  return (
    <div className="space-y-8">
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
        <RegionMapCard
          title={ko.map.title}
          description={ko.map.description}
          geo={payload.geo}
          data={mapData}
          scale={mapScale}
          selectedRegion={selectedRegion}
          onSelectRegion={handleMapSelection}
          formatValue={(value) => formatMetricValue(filters.metric, value, ko.missing.value)}
          regionLabels={payload.regionLabels}
          ranks={mapRanks}
          year={filters.year}
          metricLabel={ko.filters.metrics[filters.metric]}
          missingLabel={ko.map.missingLegend}
          notes={[ko.map.keyboardHint, ko.map.scaleNote]}
          limitWarning={
            mapLimitReached && filters.regions.length >= 3 ? ko.errors.tooManyRegions : null
          }
        />

        {/* 순위는 막대를 곁들인 표 하나로 보여 준다 (막대 차트와 표를 따로 두지 않는다). */}
        <section id="ranking" className="min-w-0" aria-label={ko.ranking.title}>
          <Card title={ko.ranking.title}>
            <div className="space-y-4">
              <Badge tone="info">{ko.ranking.interpretationNote}</Badge>
              <p className="text-small text-[var(--km-color-text-muted)]" role="note">
                {ko.ranking.missingNote}
              </p>
              <RankingTable
                metric={filters.metric}
                rows={rankingRows}
                excludedRegions={[]}
                caption={ko.filters.metrics[filters.metric]}
                highlightRegions={filters.regions}
              />
            </div>
          </Card>
        </section>
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
                  seriesSlot={selectedRegion === null ? undefined : regionSlot(selectedRegion)}
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
                          slot: regionSlot(series.regionCode),
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
            description={fillTemplate(ko.trend.coverageNote, {
              ...formatYearRange(payload.years),
              nationwideStart: formatYearRange(payload.nationwide.years).start,
              nationwideEnd: formatYearRange(payload.nationwide.years).end,
            })}
          >
            {/* 패널이 반쪽 폭이 되는 xl 에서는 두 차트를 위아래로 쌓는다 (좁으면 읽기 어렵다). */}
            <div className="grid min-w-0 gap-8 lg:grid-cols-2 xl:grid-cols-1">
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
                    formatMetricValue(filters.metric, value, ko.missing.value)
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
                      slot: regionSlot(series.regionCode),
                    }))}
                    metric={filters.metric}
                    formatValue={(value) =>
                      formatMetricValue(filters.metric, value, ko.missing.value)
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

      <section id="ranking-change" aria-label={ko.ranking.changeTitle}>
        <Card title={ko.ranking.changeTitle} description={ko.ranking.changeDescription}>
          <div className="grid min-w-0 gap-x-8 gap-y-6 lg:grid-cols-2">
            {(['deltaAbs', 'deltaPct'] as const).map((rankingMetric) => (
              <section className="min-w-0 space-y-2" key={rankingMetric}>
                <h3 className="text-sm font-semibold">
                  {rankingMetric === 'deltaAbs' ? ko.ranking.deltaAbs : ko.ranking.deltaPct}
                </h3>
                <RankingTable
                  metric={rankingMetric}
                  rows={rankingRowsByMetric[rankingMetric]}
                  excludedRegions={[]}
                  caption={rankingMetric === 'deltaAbs' ? ko.ranking.deltaAbs : ko.ranking.deltaPct}
                  highlightRegions={filters.regions}
                />
              </section>
            ))}
          </div>
        </Card>
      </section>

      {/* 용어 안내 (PRD §5.1 필수 문안) — 히어로의 '다문화학생이란?' 링크가 여기로 온다. */}
      <section id="about-term" className="scroll-mt-6" aria-label={ko.ethics.termTitle}>
        <Card title={ko.ethics.termTitle} description={ko.ethics.definition}>
          <div className="space-y-3 text-sm leading-6 text-[var(--km-color-text-muted)]">
            <p>{ko.ethics.limitation}</p>
            <p>{ko.ethics.perspective}</p>
            <p>{ko.ethics.noCausalInterpretation}</p>
          </div>
        </Card>
      </section>

      <section id="sources" aria-label={ko.sources.title}>
        <Card>
          <SourcePanel
            sources={payload.sources}
            rateFormula={payload.rateFormula}
            notes={[
              ...(payload.ratePrecisionNote !== null ? [payload.ratePrecisionNote] : []),
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
              <Icon name="download" />
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
