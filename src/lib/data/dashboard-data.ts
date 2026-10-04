import type { MetricKey, SchoolLevel } from '../schema/index';
import { createCountScale, createRateScale, type ColorScale } from '../visualization/scale';
import { decodeStatRecords } from './compact';
import type { DashboardPayload } from './dashboard-payload';
import { createSelectors, type Selectors } from './select';

// 대시보드 payload → 셀렉터. 서버(정적 HTML 의 기본 화면)와 클라이언트가 같은 경로를 쓴다.

export type DashboardDataset = Pick<
  DashboardPayload,
  'years' | 'levels' | 'regionCodes' | 'records' | 'noteSets' | 'nationwide'
>;

export interface DashboardData {
  /** 시도별 자료의 수록 연도 */
  years: readonly number[];
  selectors: Selectors;
  /** 전국 장기 시계열(시도별보다 긴 기간) */
  nationwideSelectors: Selectors;
}

export function createDashboardData(dataset: DashboardDataset): DashboardData {
  return {
    years: dataset.years,
    selectors: createSelectors(
      decodeStatRecords({
        years: dataset.years,
        regionScopes: ['KR', ...dataset.regionCodes],
        levels: dataset.levels,
        records: dataset.records,
        noteSets: dataset.noteSets,
      }),
    ),
    nationwideSelectors: createSelectors(decodeStatRecords(dataset.nationwide)),
  };
}

/**
 * 지도와 타일 모자이크가 함께 쓰는 색 척도.
 * 선택 연도가 아니라 수록 전 연도 값으로 만든다 — 연도를 바꿔도 같은 색이 같은 값을
 * 뜻해야 연도 간 비교가 가능하다 (ko.map.scaleNote).
 */
export function dashboardScale(
  data: DashboardData,
  level: SchoolLevel,
  metric: MetricKey,
): ColorScale {
  const values = data.years.flatMap((year) =>
    data.selectors
      .selectByRegion(year, level)
      .map((view) => (metric === 'count' ? view.count : view.rate)),
  );
  return metric === 'count' ? createCountScale(values) : createRateScale(values);
}
