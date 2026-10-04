import { REGION_BY_CODE } from '../constants/regions';
import type { MetricKey, RegionCode, SchoolLevel } from '../schema/index';
import type { RampStep } from '../visualization/scale';
import { TILE_ORDER } from '../visualization/tile-layout';
import { difference, percentageDifference } from './compare';
import { dashboardScale, type DashboardData } from './dashboard-data';

// 히어로(전국 개요 + 타일 모자이크)의 수치 — 순수 함수.
// 서버는 기본 필터로 정적 HTML 에 넣을 화면을 만들고, 클라이언트는 URL 필터로 다시 계산한다.

export interface HeroFilters {
  year: number;
  level: SchoolLevel;
  metric: MetricKey;
}

export interface HeroTile {
  code: RegionCode;
  short: string;
  officialKo: string;
  /** 현재 지표의 값. 결측은 null (0 이 아니다). */
  value: number | null;
  /** 지도와 같은 척도의 단계. 결측은 null. */
  step: RampStep | null;
}

export interface HeroData extends HeroFilters {
  count: number | null;
  rate: number | null;
  previousDelta: number | null;
  previousDeltaPct: number | null;
  /** 장기 증감의 기준 — 전국 장기 시계열의 첫 연도 */
  baselineYear: number | null;
  baselineDelta: number | null;
  /** 타일 배치 순서(행 우선) */
  tiles: HeroTile[];
}

export function buildHeroData(data: DashboardData, filters: HeroFilters): HeroData {
  const { year, level, metric } = filters;
  const national = data.selectors.selectNational(year, level);
  const previous = data.selectors.selectNational(year - 1, level);
  const baselineYear = data.nationwideSelectors.years[0] ?? null;
  const baseline =
    baselineYear === null ? null : data.nationwideSelectors.selectNational(baselineYear, level);
  const count = national?.count ?? null;

  const scale = dashboardScale(data, level, metric);
  const views = new Map(
    data.selectors.selectByRegion(year, level).map((view) => [view.regionCode, view]),
  );

  return {
    year,
    level,
    metric,
    count,
    rate: national?.rate ?? null,
    previousDelta: difference(count, previous?.count ?? null),
    previousDeltaPct: percentageDifference(count, previous?.count ?? null),
    baselineYear,
    baselineDelta: difference(count, baseline?.count ?? null),
    tiles: TILE_ORDER.map((code) => {
      const view = views.get(code);
      const value = (metric === 'count' ? view?.count : view?.rate) ?? null;
      return {
        code,
        short: REGION_BY_CODE[code].short,
        officialKo: REGION_BY_CODE[code].officialKo,
        value,
        step: scale.step(value),
      };
    }),
  };
}
