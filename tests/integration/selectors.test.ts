import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { REGION_ORDER } from '@/lib/constants/regions';
import {
  selectAvailableYears,
  selectByRegion,
  selectNational,
  selectRanking,
} from '@/lib/data/selectors';

function snapshotCoverageYears(): number[] {
  const snapshot = JSON.parse(
    readFileSync(
      new URL('../../data/snapshots/multicultural-students.v1.json', import.meta.url),
      'utf8',
    ),
  ) as { coverage: { years: number[] } };
  return snapshot.coverage.years;
}

describe('실제 스냅숏 selector 통합', () => {
  it('selectNational(2022, all)은 외부 교차검증 기준 168645명이다', () => {
    expect(selectNational(2022, 'all')?.count).toBe(168645);
  });

  it('selectNational(2025, all)은 202208명이다', () => {
    expect(selectNational(2025, 'all')?.count).toBe(202208);
  });

  it('selectByRegion(2025, all)은 17개 시도를 반환한다', () => {
    const rows = selectByRegion(2025, 'all');
    expect(rows).toHaveLength(17);
    expect(rows.map((row) => row.regionCode)).toEqual([...REGION_ORDER]);
  });

  it('selectRanking(2025, all, count)의 1위는 경기 41이다', () => {
    expect(selectRanking(2025, 'all', 'count')[0]?.regionCode).toBe('41');
  });

  it('결측이 없는 학교급 합계는 전 연도·전 지역에서 all과 일치한다', () => {
    const levels = ['elementary', 'middle', 'high', 'other'] as const;
    const years = selectAvailableYears();

    for (const year of years) {
      for (const regionCode of ['KR', ...REGION_ORDER] as const) {
        const all =
          regionCode === 'KR'
            ? selectNational(year, 'all')
            : selectByRegion(year, 'all').find((row) => row.regionCode === regionCode);
        const parts = levels.map((level) =>
          regionCode === 'KR'
            ? selectNational(year, level)
            : selectByRegion(year, level).find((row) => row.regionCode === regionCode),
        );

        expect(all).not.toBeNull();
        expect(parts.every((part) => part !== undefined)).toBe(true);
        if (
          all !== null &&
          all !== undefined &&
          parts.every((part) => part !== null && part !== undefined && part.count !== null) &&
          all.count !== null
        ) {
          expect(parts.reduce((sum, part) => sum + (part?.count ?? 0), 0)).toBe(all.count);
        }
      }
    }
  });

  it('selectAvailableYears는 스냅숏 수록 연도를 연속·오름차순으로 반환한다', () => {
    const years = selectAvailableYears();
    // 연례 갱신으로 최신 연도가 늘어도 유효하도록 스냅숏 coverage 와 대조한다.
    expect(years).toEqual([...snapshotCoverageYears()].sort((left, right) => left - right));
    expect(years.every((year, index) => index === 0 || year === years[index - 1]! + 1)).toBe(true);
    // 외부 교차검증 기준 연도(2022)는 반드시 포함된다.
    expect(years).toContain(2022);
  });

  it('실제 결측 레코드는 0이 아니라 null을 가진다', () => {
    const missing = selectByRegion(2024, 'other').find((row) => row.regionCode === '29');
    expect(missing?.isMissing).toBe(true);
    expect(missing?.count).toBeNull();
    expect(missing?.count).not.toBe(0);
    expect(missing?.rate).toBeNull();
  });
});
