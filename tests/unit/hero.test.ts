import { describe, expect, it } from 'vitest';

import { REGION_ORDER } from '@/lib/constants/regions';
import { encodeStatRecords } from '@/lib/data/compact';
import { createDashboardData, dashboardScale } from '@/lib/data/dashboard-data';
import { buildHeroData } from '@/lib/data/hero';
import { loadSnapshot } from '@/lib/data/snapshot';
import type { SchoolLevel } from '@/lib/schema';
import { TILE_ORDER } from '@/lib/visualization/tile-layout';

// 히어로(전국 개요 + 타일 모자이크)의 수치. 서버(정적 HTML 의 기본 화면)와 클라이언트가
// 같은 순수 함수를 쓴다 — 화면이 받는 것과 같은 경로(인코딩 → 디코딩 → 셀렉터)로 검증한다.

const LEVELS: SchoolLevel[] = ['all', 'elementary', 'middle', 'high', 'other'];
const snapshot = loadSnapshot();
const years = [...snapshot.coverage.years].sort((a, b) => a - b);
const nationwideYears = [...snapshot.coverage.nationwideYears].sort((a, b) => a - b);
const latest = years[years.length - 1]!;

const payload = JSON.parse(
  JSON.stringify({
    years,
    levels: LEVELS,
    regionCodes: [...REGION_ORDER],
    ...encodeStatRecords(snapshot.records, {
      years,
      regionScopes: ['KR', ...REGION_ORDER],
      levels: LEVELS,
    }),
    nationwide: encodeStatRecords(snapshot.nationwide, {
      years: nationwideYears,
      regionScopes: ['KR'],
      levels: LEVELS,
    }),
  }),
);
const data = createDashboardData(payload);

function record(year: number, regionCode: string, level: SchoolLevel) {
  return snapshot.records.find(
    (item) => item.year === year && item.regionCode === regionCode && item.schoolLevel === level,
  );
}

describe('buildHeroData — 기본 필터(최신 연도·전체 학교급·학생 수)', () => {
  const hero = buildHeroData(data, { year: latest, level: 'all', metric: 'count' });
  const national = record(latest, 'KR', 'all')!;

  it('전국 학생 수와 직접 계산한 비율을 준다', () => {
    expect(hero.count).toBe(national.multiculturalStudentCount);
    expect(hero.rate).toBe(national.multiculturalStudentRateComputed);
  });

  it('전년 대비 증감은 같은 학교급의 전년 전국 값과의 차이다', () => {
    const previous = record(latest - 1, 'KR', 'all')!.multiculturalStudentCount!;
    expect(hero.previousDelta).toBe(national.multiculturalStudentCount! - previous);
    expect(hero.previousDeltaPct).toBeCloseTo(
      ((national.multiculturalStudentCount! - previous) / previous) * 100,
      4,
    );
  });

  it('장기 증감의 기준은 시도별 자료의 첫 연도가 아니라 전국 장기 시계열의 첫 연도다', () => {
    const baselineYear = nationwideYears[0]!;
    const baseline = snapshot.nationwide.find(
      (item) => item.year === baselineYear && item.schoolLevel === 'all',
    )!.multiculturalStudentCount!;

    expect(baselineYear).toBeLessThan(years[0]!);
    expect(hero.baselineYear).toBe(baselineYear);
    expect(hero.baselineDelta).toBe(national.multiculturalStudentCount! - baseline);
  });

  it('타일은 배치 순서대로 17개이고 값은 시도별 학생 수다', () => {
    expect(hero.tiles.map((tile) => tile.code)).toEqual(TILE_ORDER);
    for (const tile of hero.tiles) {
      expect(tile.value).toBe(record(latest, tile.code, 'all')!.multiculturalStudentCount);
    }
  });

  it('타일 단계는 지도와 같은 척도의 단계다', () => {
    const scale = dashboardScale(data, 'all', 'count');
    for (const tile of hero.tiles) expect(tile.step).toBe(scale.step(tile.value));
    expect(new Set(hero.tiles.map((tile) => tile.step)).size).toBeGreaterThan(1);
  });
});

describe('buildHeroData — 필터 반영', () => {
  it('비율 지표에서 타일 값은 직접 계산한 비율이고, 결측은 0 이 아니라 null 이다', () => {
    const hero = buildHeroData(data, { year: latest, level: 'all', metric: 'rate' });
    const missing = hero.tiles.filter((tile) => tile.value === null);

    for (const tile of hero.tiles) {
      expect(tile.value).toBe(record(latest, tile.code, 'all')!.multiculturalStudentRateComputed);
    }
    for (const tile of missing) expect(tile.step).toBeNull();
    // 전국 수치(히어로 숫자)는 지표와 무관하게 학생 수와 비율을 모두 준다.
    expect(hero.count).toBe(record(latest, 'KR', 'all')!.multiculturalStudentCount);
  });

  it('학교급을 바꾸면 그 학교급의 전국 값과 기준 연도 값을 쓴다', () => {
    const hero = buildHeroData(data, { year: latest, level: 'elementary', metric: 'count' });
    const baseline = snapshot.nationwide.find(
      (item) => item.year === nationwideYears[0] && item.schoolLevel === 'elementary',
    )!.multiculturalStudentCount!;

    expect(hero.count).toBe(record(latest, 'KR', 'elementary')!.multiculturalStudentCount);
    expect(hero.baselineDelta).toBe(hero.count! - baseline);
  });

  it('전년 자료가 없으면 증감은 0 이 아니라 null 이다', () => {
    const hero = buildHeroData(data, { year: years[0]!, level: 'all', metric: 'count' });

    expect(hero.previousDelta).toBeNull();
    expect(hero.previousDeltaPct).toBeNull();
  });
});
