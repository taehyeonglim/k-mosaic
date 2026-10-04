import { TABLE_IDS_BY_DATASET, type SourceDataset } from '../constants/sources';
import type {
  MetricKey,
  RankingMetric,
  RegionCode,
  RegionScope,
  SchoolLevel,
  SourceMeta,
} from '../schema/index';
import { toStatRecord } from './compact';
import { createSelectors, type Selectors } from './select';
import { loadSnapshot, snapshotIndex, sourceMeta } from './snapshot';
import type { RankingRow, RegionDetail, StatView, TrendSeries } from './types';
import { integerRoundedYears } from './years';

// 서버(정적 생성)용 셀렉터 — 커밋된 스냅숏으로 만든 createSelectors 인스턴스를 감싼다.
// 화면(클라이언트)도 같은 createSelectors 를 쓰므로, 이 함수들의 테스트가 실제 렌더 경로를 검증한다.

let snapshotSelectors: Selectors | null = null;

function selectors(): Selectors {
  snapshotSelectors ??= createSelectors([...snapshotIndex.values()].map(toStatRecord));
  return snapshotSelectors;
}

export function selectNational(year: number, level: SchoolLevel): StatView | null {
  return selectors().selectNational(year, level);
}

export function selectByRegion(year: number, level: SchoolLevel): StatView[] {
  return selectors().selectByRegion(year, level);
}

export function selectRanking(
  year: number,
  level: SchoolLevel,
  metric: RankingMetric,
): RankingRow[] {
  return selectors().selectRanking(year, level, metric);
}

export function selectTrend(
  codes: RegionScope[],
  level: SchoolLevel,
  metric: MetricKey,
): TrendSeries[] {
  return selectors().selectTrend(codes, level, metric);
}

export function selectRegionDetail(
  code: RegionCode,
  year: number,
  level: SchoolLevel,
): RegionDetail | null {
  return selectors().selectRegionDetail(code, year, level);
}

let nationwideSelectors: Selectors | null = null;

/** 전국 학교급별 장기 시계열(2016~)의 추세 — 시도별 수록 연도보다 길다. */
export function selectNationwideTrend(level: SchoolLevel, metric: MetricKey): TrendSeries[] {
  nationwideSelectors ??= createSelectors(loadSnapshot().nationwide.map(toStatRecord));
  return nationwideSelectors.selectTrend(['KR'], level, metric);
}

export function selectAvailableYears(): number[] {
  return [...selectors().years];
}

/** 공표 비율이 정수로 반올림돼 계산값으로만 표시하는 연도 (CLAUDE.md §3.5). */
export function selectIntegerRoundedYears(): number[] {
  return integerRoundedYears(
    [...snapshotIndex.values()].map((record) => ({
      year: record.year,
      published: record.multiculturalStudentRatePublished,
    })),
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
