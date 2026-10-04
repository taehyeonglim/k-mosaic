// 비교·순위 계산 공용 함수 — 다문화학생·외국인 유학생, 서버·클라이언트가 함께 쓴다.
// 예전에는 동점 순위 계산이 세 곳(서버 셀렉터·대시보드·외국인 셀렉터)에 따로 있었다.

/** 저장 정밀도(소수 4자리)로 반올림한다. 표시 반올림(1자리)은 format.ts 가 한다. */
export function round4(value: number): number {
  return Number(value.toFixed(4));
}

export function difference(current: number | null, previous: number | null): number | null {
  return current === null || previous === null ? null : current - previous;
}

/** 증가율(%). 전년 값이 없거나 0이면 계산하지 않는다 (null). */
export function percentageDifference(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current / previous - 1) * 100;
}

export interface RankCandidate<Code extends string> {
  regionCode: Code;
  value: number;
}

export interface RankedEntry<Code extends string> extends RankCandidate<Code> {
  rank: number;
  isTied: boolean;
}

/**
 * 값 내림차순 순위. 같은 값은 공동 순위를 주고 다음 순위를 건너뛴다(1, 2, 2, 4).
 * 같은 값끼리는 지역 코드순으로 놓는다. 값은 소수 4자리로 반올림한 뒤 비교한다.
 * 결측(null)은 순위에서 빼고 넘긴다 — 결측은 별도로 표시한다 (0으로 순위 매기지 않음).
 */
export function rankWithTies<Code extends string>(
  candidates: readonly RankCandidate<Code>[],
): RankedEntry<Code>[] {
  const sorted = candidates
    .map((candidate) => ({ ...candidate, value: round4(candidate.value) }))
    .sort(
      (left, right) => right.value - left.value || left.regionCode.localeCompare(right.regionCode),
    );
  return sorted.map((candidate, index) => ({
    ...candidate,
    rank: sorted.findIndex((entry) => entry.value === candidate.value) + 1,
    isTied:
      sorted[index - 1]?.value === candidate.value || sorted[index + 1]?.value === candidate.value,
  }));
}
