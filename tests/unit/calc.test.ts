import { afterEach, describe, expect, it } from 'vitest';

import { REGION_ORDER } from '@/lib/constants/regions';
import { selectByRegion, selectNational, selectRanking } from '@/lib/data/selectors';
import { snapshotIndex, snapshotKey } from '@/lib/data/snapshot';
import type { MulticulturalStudentStat, RegionScope } from '@/lib/schema';
import { formatCount, formatRate } from '@/lib/visualization/format';

const originalSnapshotEntries = [...snapshotIndex.entries()];

function makeStat({
  year,
  regionCode,
  count,
  totalStudents,
  rate,
}: {
  year: number;
  regionCode: RegionScope;
  count: number | null;
  totalStudents: number | null;
  rate: number | null;
}): MulticulturalStudentStat {
  return {
    year,
    regionCode,
    regionNameKo: regionCode === 'KR' ? '전국' : '테스트 지역',
    regionNameEn: regionCode === 'KR' ? 'Korea (nationwide)' : 'Test region',
    schoolLevel: 'all',
    studentType: 'total',
    multiculturalStudentCount: count,
    totalStudentCount: totalStudents,
    multiculturalStudentRateComputed: rate,
    multiculturalStudentRatePublished: null,
    notes: [],
  };
}

function installStats(records: MulticulturalStudentStat[]): void {
  snapshotIndex.clear();
  for (const record of records) {
    snapshotIndex.set(snapshotKey(record.year, record.regionCode, record.schoolLevel), record);
  }
}

function restoreSnapshotIndex(): void {
  snapshotIndex.clear();
  for (const [key, record] of originalSnapshotEntries) snapshotIndex.set(key, record);
}

afterEach(() => {
  restoreSnapshotIndex();
});

describe('비율·증감·순위·포맷', () => {
  it('정상 비율은 저장된 소수 4자리 정밀도를 유지한다', () => {
    expect(selectNational(2020, 'all')?.rate).toBe(2.7517);
  });

  it('분자 null, 분모 null, 분모 0의 비율은 모두 null이다', () => {
    installStats([
      makeStat({ year: 2030, regionCode: 'KR', count: null, totalStudents: 100, rate: null }),
      makeStat({ year: 2031, regionCode: 'KR', count: 10, totalStudents: null, rate: null }),
      makeStat({ year: 2032, regionCode: 'KR', count: 10, totalStudents: 0, rate: null }),
    ]);

    expect(selectNational(2030, 'all')?.rate).toBeNull();
    expect(selectNational(2031, 'all')?.rate).toBeNull();
    expect(selectNational(2032, 'all')?.rate).toBeNull();
  });

  it('전년 값이 null인 증가율은 순위에서 제외된다', () => {
    const records = REGION_ORDER.flatMap((regionCode, index) => [
      makeStat({
        year: 2024,
        regionCode,
        count: regionCode === '26' ? null : 100 + index,
        totalStudents: 1000,
        rate: 1,
      }),
      makeStat({
        year: 2025,
        regionCode,
        count: 200 + index,
        totalStudents: 1000,
        rate: 2,
      }),
    ]);
    installStats(records);

    const ranking = selectRanking(2025, 'all', 'deltaPct');
    expect(ranking).toHaveLength(16);
    expect(ranking.some((row) => row.regionCode === '26')).toBe(false);
  });

  it('동률에는 공동 순위를 부여하고 다음 순위를 건너뛴다', () => {
    const counts = Object.fromEntries(
      REGION_ORDER.map((regionCode, index) => [regionCode, 70 - index]),
    ) as Record<(typeof REGION_ORDER)[number], number>;
    counts['11'] = 100;
    counts['26'] = 90;
    counts['27'] = 90;
    counts['28'] = 80;
    installStats(
      REGION_ORDER.map((regionCode) =>
        makeStat({
          year: 2030,
          regionCode,
          count: counts[regionCode],
          totalStudents: 1000,
          rate: 1,
        }),
      ),
    );

    const ranking = selectRanking(2030, 'all', 'count');
    expect(ranking.slice(0, 4).map((row) => row.rank)).toEqual([1, 2, 2, 4]);
    expect(ranking.slice(0, 4).map((row) => row.regionCode)).toEqual(['11', '26', '27', '28']);
    expect(ranking[1]?.isTied).toBe(true);
    expect(ranking[2]?.isTied).toBe(true);
  });

  it('동률 내 표시 순서는 regionCode 오름차순으로 고정된다', () => {
    const counts = Object.fromEntries(
      REGION_ORDER.map((regionCode) => [
        regionCode,
        regionCode === '11' || regionCode === '50' ? 100 : 1,
      ]),
    ) as Record<(typeof REGION_ORDER)[number], number>;
    installStats(
      REGION_ORDER.map((regionCode) =>
        makeStat({
          year: 2030,
          regionCode,
          count: counts[regionCode],
          totalStudents: 1000,
          rate: 1,
        }),
      ),
    );

    expect(
      selectRanking(2030, 'all', 'count')
        .slice(0, 2)
        .map((row) => row.regionCode),
    ).toEqual(['11', '50']);
  });

  it('결측 지역은 순위에서 제외되고 최하위에 배치되지 않는다', () => {
    const records = REGION_ORDER.map((regionCode, index) =>
      makeStat({
        year: 2030,
        regionCode,
        count: regionCode === '50' ? null : 100 - index,
        totalStudents: 1000,
        rate: regionCode === '50' ? null : 1,
      }),
    );
    installStats(records);

    const ranking = selectRanking(2030, 'all', 'count');
    expect(ranking).toHaveLength(16);
    expect(ranking.some((row) => row.regionCode === '50')).toBe(false);
    expect(ranking.at(-1)?.regionCode).toBe('48');
  });

  it('formatCount와 formatRate는 null을 0이 아닌 결측 표기로 표시한다', () => {
    expect(formatCount(null, '—')).toBe('—');
    expect(formatRate(null, '—')).toBe('—');
    expect(formatCount(null, '—')).not.toContain('0');
    expect(formatRate(null, '—')).not.toContain('0');
  });

  it('실제 결측 분자와 분모는 selector 결과에서도 null로 유지된다', () => {
    const missingNumerator = selectByRegion(2024, 'other').find((row) => row.regionCode === '29');
    const missingDenominator = selectByRegion(2025, 'all').find((row) => row.regionCode === '36');

    expect(missingNumerator?.count).toBeNull();
    expect(missingNumerator?.rate).toBeNull();
    expect(missingDenominator?.totalStudents).toBeNull();
    expect(missingDenominator?.rate).toBeNull();
  });
});
