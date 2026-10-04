// 연도 처리 순수 함수 — 파이프라인·검증·화면이 공유한다.
//
// 연례 갱신마다 코드를 고치지 않도록 연도는 업스트림 자료에서 파생한다.
// 연도 배열이나 '2025년' 같은 비교를 리터럴로 두지 않는다.

/** 연도가 비지 않고, 중복 없이, 1년 간격으로 이어지는지 단언하고 오름차순으로 돌려준다. */
export function assertContiguousYears(years: readonly number[], label: string): number[] {
  if (years.length === 0) throw new Error(`${label}: 수록 연도가 비어 있습니다.`);
  const sorted = [...years].sort((left, right) => left - right);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    if (current === previous) throw new Error(`${label}: 연도가 중복됩니다 (${current}).`);
    if (current !== previous + 1)
      throw new Error(`${label}: 연도가 연속되지 않습니다 (${previous} 다음 ${current}).`);
  }
  return sorted;
}

/**
 * 공표 비율이 정수로 반올림된 연도. 2025년 공표치는 전남 7.0·충남 6.0처럼 정수로
 * 반올림돼 있어 계산값과 대조할 수 없다 (CLAUDE.md §3.5). 연도를 리터럴로 지정하지 않고
 * 자료의 모양으로 판별해야 2026년 이후에도 같은 처리가 적용된다.
 *
 * '모두 정수'가 아니라 비율로 판별한다 — 2025년 공표치 90개 중 1 미만 값 하나(0.4)는
 * 소수 한 자리가 남아 있다. 평년에는 정수 값이 7~12% 수준이라 80% 기준으로 분리된다.
 */
export const INTEGER_ROUNDED_SHARE = 0.8;

export function integerRoundedYears(
  records: readonly { year: number; published: number | null }[],
): number[] {
  const byYear = new Map<number, number[]>();
  for (const { year, published } of records) {
    if (published === null) continue;
    byYear.set(year, [...(byYear.get(year) ?? []), published]);
  }
  return [...byYear.entries()]
    .filter(
      ([, values]) =>
        values.length > 0 &&
        values.filter(Number.isInteger).length / values.length >= INTEGER_ROUNDED_SHARE,
    )
    .map(([year]) => year)
    .sort((left, right) => left - right);
}

/**
 * 업스트림이 최근 N개년만 제공해 가장 오래된 연도가 빠지면, 이전에 검증된 스냅숏의
 * 그 연도 레코드를 보존한다. 보존 대상은 새 자료의 최소 연도보다 '이전' 연도뿐이다 —
 * 중간 연도가 빠진 것은 이상 신호이므로 보존하지 않고 검증(커버리지 유지)이 막게 둔다.
 */
export function retainHistoricalYears<T extends { year: number }>(
  current: readonly T[],
  previous: readonly T[],
): { records: T[]; retainedYears: number[] } {
  if (current.length === 0) return { records: [...current], retainedYears: [] };
  const firstCurrentYear = Math.min(...current.map((record) => record.year));
  const retained = previous.filter((record) => record.year < firstCurrentYear);
  if (retained.length === 0) return { records: [...current], retainedYears: [] };
  const retainedYears = [...new Set(retained.map((record) => record.year))].sort(
    (left, right) => left - right,
  );
  // Array.prototype.sort 는 안정 정렬이라 같은 연도 안의 순서는 유지된다.
  return {
    records: [...retained, ...current].sort((left, right) => left.year - right.year),
    retainedYears,
  };
}
