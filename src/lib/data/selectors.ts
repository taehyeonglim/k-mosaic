import { REGION_BY_CODE, REGION_ORDER } from '../constants/regions';
import { TABLE_IDS_BY_DATASET, type SourceDataset } from '../constants/sources';
import type {
  MetricKey,
  RankingMetric,
  RegionCode,
  RegionScope,
  SchoolLevel,
  SourceMeta,
} from '../schema/index';
import { snapshotIndex, snapshotKey, sourceMeta } from './snapshot';
import type {
  LevelStatView,
  RankingRow,
  RegionDetail,
  StatView,
  TrendPoint,
  TrendSeries,
} from './types';

const SCHOOL_LEVELS: SchoolLevel[] = ['elementary', 'middle', 'high', 'other'];

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function statAt(year: number, regionCode: RegionScope, schoolLevel: SchoolLevel) {
  return snapshotIndex.get(snapshotKey(year, regionCode, schoolLevel));
}

function emptyView(regionCode: RegionScope): StatView {
  return {
    regionCode,
    regionNameKo: regionCode === 'KR' ? '전국' : REGION_BY_CODE[regionCode].officialKo,
    count: null,
    totalStudents: null,
    rate: null,
    isMissing: true,
  };
}

function toView(stat: ReturnType<typeof statAt>, regionCode: RegionScope): StatView {
  if (stat === undefined) return emptyView(regionCode);
  return {
    regionCode: stat.regionCode,
    regionNameKo: stat.regionNameKo,
    count: stat.multiculturalStudentCount,
    totalStudents: stat.totalStudentCount,
    rate: stat.multiculturalStudentRateComputed,
    isMissing:
      stat.multiculturalStudentCount === null || stat.multiculturalStudentRateComputed === null,
  };
}

function valueForMetric(
  year: number,
  regionCode: RegionCode,
  schoolLevel: SchoolLevel,
  metric: RankingMetric,
): number | null {
  const current = statAt(year, regionCode, schoolLevel);
  if (current === undefined) return null;
  if (metric === 'count') return current.multiculturalStudentCount;
  if (metric === 'rate') return current.multiculturalStudentRateComputed;
  const previous = statAt(year - 1, regionCode, schoolLevel);
  if (
    previous === undefined ||
    current.multiculturalStudentCount === null ||
    previous.multiculturalStudentCount === null
  )
    return null;
  if (metric === 'deltaAbs')
    return current.multiculturalStudentCount - previous.multiculturalStudentCount;
  if (previous.multiculturalStudentCount === 0) return null;
  return (current.multiculturalStudentCount / previous.multiculturalStudentCount - 1) * 100;
}

export function selectNational(year: number, level: SchoolLevel): StatView | null {
  const stat = statAt(year, 'KR', level);
  return stat === undefined ? null : toView(stat, 'KR');
}

export function selectByRegion(year: number, level: SchoolLevel): StatView[] {
  return REGION_ORDER.map((regionCode) => toView(statAt(year, regionCode, level), regionCode));
}

export function selectRanking(
  year: number,
  level: SchoolLevel,
  metric: RankingMetric,
): RankingRow[] {
  const candidates = REGION_ORDER.flatMap((regionCode) => {
    const value = valueForMetric(year, regionCode, level, metric);
    return value === null ? [] : [{ regionCode, value: round4(value) }];
  }).sort(
    (left, right) => right.value - left.value || left.regionCode.localeCompare(right.regionCode),
  );

  return candidates.map((candidate, index) => {
    const previous = candidates[index - 1];
    const next = candidates[index + 1];
    const isTied = previous?.value === candidate.value || next?.value === candidate.value;
    return {
      rank: candidates.findIndex((entry) => entry.value === candidate.value) + 1,
      regionCode: candidate.regionCode,
      regionNameKo: REGION_BY_CODE[candidate.regionCode].officialKo,
      value: candidate.value,
      isTied,
    };
  });
}

export function selectTrend(
  codes: RegionScope[],
  level: SchoolLevel,
  metric: MetricKey,
): TrendSeries[] {
  const years = selectAvailableYears();
  return codes.map((regionCode) => ({
    regionCode,
    regionNameKo: regionCode === 'KR' ? '전국' : REGION_BY_CODE[regionCode].officialKo,
    points: years.map((year): TrendPoint => {
      const stat = statAt(year, regionCode, level);
      return {
        year,
        value:
          stat === undefined
            ? null
            : metric === 'count'
              ? stat.multiculturalStudentCount
              : stat.multiculturalStudentRateComputed,
      };
    }),
  }));
}

export function selectRegionDetail(
  code: RegionCode,
  year: number,
  level: SchoolLevel,
): RegionDetail | null {
  const current = statAt(year, code, level);
  if (current === undefined) return null;
  const national = statAt(year, 'KR', level);
  const previous = statAt(year - 1, code, level);
  const rankRow = selectRanking(year, level, 'count').find((row) => row.regionCode === code);
  const deltaAbs =
    current.multiculturalStudentCount !== null &&
    previous !== undefined &&
    previous.multiculturalStudentCount !== null
      ? current.multiculturalStudentCount - previous.multiculturalStudentCount
      : null;
  const deltaPct =
    deltaAbs !== null &&
    previous !== undefined &&
    previous.multiculturalStudentCount !== null &&
    previous.multiculturalStudentCount !== 0
      ? round4((deltaAbs / previous.multiculturalStudentCount) * 100)
      : null;
  const byLevel: LevelStatView[] = SCHOOL_LEVELS.map((schoolLevel) => ({
    ...toView(statAt(year, code, schoolLevel), code),
    schoolLevel,
  }));
  const trend = selectTrend([code], level, 'count')[0]?.points ?? [];
  return {
    regionCode: code,
    nameKo: current.regionNameKo,
    count: current.multiculturalStudentCount,
    rate: current.multiculturalStudentRateComputed,
    rank: rankRow?.rank ?? null,
    diffFromNational:
      current.multiculturalStudentRateComputed !== null &&
      national?.multiculturalStudentRateComputed !== null &&
      national !== undefined
        ? round4(
            current.multiculturalStudentRateComputed - national.multiculturalStudentRateComputed,
          )
        : null,
    deltaAbs,
    deltaPct,
    byLevel,
    trend,
    notes: [...current.notes],
  };
}

export function selectAvailableYears(): number[] {
  return [...new Set([...snapshotIndex.values()].map((record) => record.year))].sort(
    (left, right) => left - right,
  );
}

/** 데이터셋의 출처만 통계표 목록 순서대로 반환한다 — 다른 데이터셋의 표가 섞이지 않게 한다. */
export function selectSourceMeta(dataset: SourceDataset): SourceMeta[] {
  const tableIds = TABLE_IDS_BY_DATASET[dataset];
  return sourceMeta
    .filter((entry) => tableIds.includes(entry.tableId))
    .sort((left, right) => tableIds.indexOf(left.tableId) - tableIds.indexOf(right.tableId))
    .map((entry) => ({ ...entry }));
}
