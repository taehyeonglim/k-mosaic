import { ko } from '../../content/ko';
import { REGION_BY_CODE, REGION_ORDER } from '../constants/regions';
import type {
  MetricKey,
  RankingMetric,
  RegionCode,
  RegionScope,
  SchoolLevel,
} from '../schema/index';
import { percentageDifference, rankWithTies, round4 } from './compare';
import type { LevelStatView, RankingRow, RegionDetail, StatView, TrendSeries } from './types';

// 다문화학생 셀렉터 — 데이터를 인자로 받는 순수 팩토리.
//
// 서버(정적 생성)와 클라이언트(대시보드)가 같은 구현을 쓴다. 예전에는 클라이언트가 셀렉터를
// 다시 구현해서, 테스트는 화면이 쓰지 않는 코드만 검증하고 있었다.
// 이 모듈은 스냅숏 JSON 을 import 하지 않는다 — 클라이언트 번들에 스냅숏이 섞이지 않게.

/** 셀렉터가 읽는 최소 레코드. 스냅숏 레코드와 화면 payload 를 모두 이 형태로 바꿔 넣는다. */
export interface StatRecord {
  year: number;
  regionCode: RegionScope;
  schoolLevel: SchoolLevel;
  count: number | null;
  totalStudents: number | null;
  rate: number | null;
  notes: readonly string[];
}

export interface Selectors {
  years: readonly number[];
  selectView(year: number, regionCode: RegionScope, level: SchoolLevel): StatView;
  selectNational(year: number, level: SchoolLevel): StatView | null;
  selectByRegion(year: number, level: SchoolLevel): StatView[];
  selectRanking(year: number, level: SchoolLevel, metric: RankingMetric): RankingRow[];
  selectTrend(codes: readonly RegionScope[], level: SchoolLevel, metric: MetricKey): TrendSeries[];
  selectRegionDetail(code: RegionCode, year: number, level: SchoolLevel): RegionDetail | null;
}

const DETAIL_LEVELS = ['elementary', 'middle', 'high', 'other'] as const;

export function regionNameKo(regionCode: RegionScope): string {
  return regionCode === 'KR' ? ko.common.nationwide : REGION_BY_CODE[regionCode].officialKo;
}

function key(year: number, regionCode: RegionScope, level: SchoolLevel): string {
  return `${year}|${regionCode}|${level}`;
}

export function createSelectors(records: Iterable<StatRecord>): Selectors {
  const index = new Map<string, StatRecord>();
  for (const record of records)
    index.set(key(record.year, record.regionCode, record.schoolLevel), record);
  const years = [...new Set([...index.values()].map((record) => record.year))].sort(
    (left, right) => left - right,
  );
  const at = (year: number, regionCode: RegionScope, level: SchoolLevel) =>
    index.get(key(year, regionCode, level));

  function selectView(year: number, regionCode: RegionScope, level: SchoolLevel): StatView {
    const record = at(year, regionCode, level);
    return {
      regionCode,
      regionNameKo: regionNameKo(regionCode),
      count: record?.count ?? null,
      totalStudents: record?.totalStudents ?? null,
      rate: record?.rate ?? null,
      isMissing: record === undefined || record.count === null || record.rate === null,
    };
  }

  function valueForMetric(
    year: number,
    regionCode: RegionCode,
    level: SchoolLevel,
    metric: RankingMetric,
  ): number | null {
    const current = at(year, regionCode, level);
    if (current === undefined) return null;
    if (metric === 'count') return current.count;
    if (metric === 'rate') return current.rate;
    const previous = at(year - 1, regionCode, level);
    if (previous === undefined || current.count === null || previous.count === null) return null;
    if (metric === 'deltaAbs') return current.count - previous.count;
    return percentageDifference(current.count, previous.count);
  }

  function selectRanking(year: number, level: SchoolLevel, metric: RankingMetric): RankingRow[] {
    const candidates = REGION_ORDER.flatMap((regionCode) => {
      const value = valueForMetric(year, regionCode, level, metric);
      return value === null ? [] : [{ regionCode, value }];
    });
    return rankWithTies(candidates).map((entry) => ({
      ...entry,
      regionNameKo: regionNameKo(entry.regionCode),
    }));
  }

  function selectTrend(
    codes: readonly RegionScope[],
    level: SchoolLevel,
    metric: MetricKey,
  ): TrendSeries[] {
    return codes.map((regionCode) => ({
      regionCode,
      regionNameKo: regionNameKo(regionCode),
      points: years.map((year) => {
        const record = at(year, regionCode, level);
        return {
          year,
          value: record === undefined ? null : metric === 'count' ? record.count : record.rate,
        };
      }),
    }));
  }

  return {
    years,
    selectView,
    selectNational(year, level) {
      return at(year, 'KR', level) === undefined ? null : selectView(year, 'KR', level);
    },
    selectByRegion(year, level) {
      return REGION_ORDER.map((regionCode) => selectView(year, regionCode, level));
    },
    selectRanking,
    selectTrend,
    selectRegionDetail(code, year, level) {
      const current = at(year, code, level);
      if (current === undefined) return null;
      const national = at(year, 'KR', level);
      const previous = at(year - 1, code, level);
      const deltaAbs =
        current.count !== null && previous !== undefined && previous.count !== null
          ? current.count - previous.count
          : null;
      // 상세 패널의 증가율은 기존 계산식(증감 ÷ 전년 × 100)을 그대로 쓴다 — 표시값 불변.
      const deltaPct =
        deltaAbs !== null &&
        previous !== undefined &&
        previous.count !== null &&
        previous.count !== 0
          ? round4((deltaAbs / previous.count) * 100)
          : null;
      const byLevel: LevelStatView[] = DETAIL_LEVELS.map((schoolLevel) => ({
        ...selectView(year, code, schoolLevel),
        schoolLevel,
      }));
      return {
        regionCode: code,
        nameKo: regionNameKo(code),
        count: current.count,
        rate: current.rate,
        rank:
          selectRanking(year, level, 'count').find((row) => row.regionCode === code)?.rank ?? null,
        diffFromNational:
          current.rate !== null && national !== undefined && national.rate !== null
            ? round4(current.rate - national.rate)
            : null,
        deltaAbs,
        deltaPct,
        byLevel,
        trend: selectTrend([code], level, 'count')[0]?.points ?? [],
        notes: [...current.notes],
      };
    },
  };
}
