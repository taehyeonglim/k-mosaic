import { describe, expect, it } from 'vitest';

import {
  assertContiguousYears,
  integerRoundedYears,
  retainHistoricalYears,
} from '@/lib/data/years';

describe('연도 순서 단언', () => {
  it('연속된 연도를 오름차순으로 돌려준다', () => {
    expect(assertContiguousYears([2026, 2024, 2025], '테스트')).toEqual([2024, 2025, 2026]);
  });

  it('비어 있거나 중복·공백이 있으면 막는다', () => {
    expect(() => assertContiguousYears([], '테스트')).toThrow('테스트');
    expect(() => assertContiguousYears([2024, 2024], '테스트')).toThrow('중복');
    expect(() => assertContiguousYears([2022, 2024], '테스트')).toThrow('연속');
  });
});

describe('정수 반올림 공표 연도 검출', () => {
  const rows = (year: number, values: (number | null)[]) =>
    values.map((published) => ({ year, published }));

  it('공표값 대부분이 x.0 인 연도를 고른다 — 1 미만 값의 소수 한 자리는 허용한다', () => {
    const records = [
      ...rows(2024, [3.8, 2.0, 4.7, 1.1, 0.9, null]),
      // 실제 2025년: 90개 중 0.4 하나만 소수
      ...rows(2025, [4, 7, 1, 3, 5, 6, 2, 8, 4, 0.4, null]),
      ...rows(2026, [5, 8]),
    ];
    expect(integerRoundedYears(records)).toEqual([2025, 2026]);
  });

  it('공표값이 하나도 없는 연도는 고르지 않는다', () => {
    expect(integerRoundedYears(rows(2025, [null, null]))).toEqual([]);
  });
});

describe('과거 연도 보존 병합', () => {
  const record = (year: number, id: string) => ({ year, id });

  it('업스트림 6년 창이 밀려 빠진 과거 연도를 이전 스냅숏에서 보존한다', () => {
    const previous = [2020, 2021, 2022].map((year) => record(year, `old-${year}`));
    const current = [2021, 2022, 2023].map((year) => record(year, `new-${year}`));

    const merged = retainHistoricalYears(current, previous);

    expect(merged.retainedYears).toEqual([2020]);
    expect(merged.records.map((item) => item.id)).toEqual([
      'old-2020',
      'new-2021',
      'new-2022',
      'new-2023',
    ]);
  });

  it('새 자료가 있는 연도는 새 자료를 쓴다 (업스트림 정정 반영)', () => {
    const merged = retainHistoricalYears([record(2021, 'new')], [record(2021, 'old')]);
    expect(merged.records).toEqual([record(2021, 'new')]);
    expect(merged.retainedYears).toEqual([]);
  });

  it('중간 연도가 빠진 것은 보존하지 않는다 — 이상 신호이므로 검증(V8)이 막게 둔다', () => {
    const previous = [2021, 2022, 2023].map((year) => record(year, 'old'));
    const current = [2021, 2023].map((year) => record(year, 'new'));

    expect(retainHistoricalYears(current, previous).retainedYears).toEqual([]);
  });

  it('보존할 것이 없으면 입력 배열 순서를 그대로 유지한다', () => {
    const current = [record(2023, 'a'), record(2022, 'b')];
    expect(retainHistoricalYears(current, []).records).toEqual(current);
  });
});
