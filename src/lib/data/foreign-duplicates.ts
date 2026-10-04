import { REGION_ORDER } from '../constants/regions';
import type { ForeignStudentStat } from '../schema/foreign-student';

// 인접한 두 해의 시도별 값이 '전부' 같은 구간 — 출처가 같은 값을 다시 제공한 것으로 보이며
// 실제 변화가 없었다는 뜻이 아니다 (DL-009). 2026-10 기준 2022=2023 구간이 있다.
//
// 표식은 문자열 주석이 아니라 타입 있는 필드(sourceDuplicateOf)로 단다. 화면이 주석 문구를
// 글자 그대로 비교하면 문구를 고치는 순간 표시가 사라지고, 연도도 문구에 고정된다.

export type YearPair = readonly [earlier: number, later: number];

const CODES = ['KR', ...REGION_ORDER] as const;

function sameValues(left: ForeignStudentStat, right: ForeignStudentStat): boolean {
  return (
    left.foreignStudentCount === right.foreignStudentCount &&
    left.enrolledStudentCount === right.enrolledStudentCount &&
    left.foreignStudentRateComputed === right.foreignStudentRateComputed
  );
}

/** 전국과 17개 시도의 값이 모두 같은 인접 연도 쌍. 입력을 바꾸지 않는다. */
export function findIdenticalAdjacentYears(records: readonly ForeignStudentStat[]): YearPair[] {
  const byYear = new Map<number, Map<string, ForeignStudentStat>>();
  for (const record of records) {
    const rows = byYear.get(record.year) ?? new Map<string, ForeignStudentStat>();
    rows.set(record.regionCode, record);
    byYear.set(record.year, rows);
  }
  const years = [...byYear.keys()].sort((left, right) => left - right);
  const pairs: YearPair[] = [];
  for (let index = 1; index < years.length; index += 1) {
    const earlier = years[index - 1]!;
    const later = years[index]!;
    if (later !== earlier + 1) continue;
    const before = byYear.get(earlier)!;
    const after = byYear.get(later)!;
    const identical = CODES.every((code) => {
      const left = before.get(code);
      const right = after.get(code);
      return left !== undefined && right !== undefined && sameValues(left, right);
    });
    if (identical) pairs.push([earlier, later]);
  }
  return pairs;
}

/**
 * 동일 구간의 두 해 레코드에 표식을 단 새 배열을 돌려준다 (빌드 단계 전용, 순수 함수).
 * 사람이 읽는 주석도 함께 다시 쓴다 — 이전 실행이 남긴 표식·주석은 먼저 지워 멱등하다.
 */
export function markIdenticalAdjacentYears(
  records: readonly ForeignStudentStat[],
  noteFor: (otherYear: number) => string,
  isDuplicateNote: (note: string) => boolean,
): ForeignStudentStat[] {
  const otherYearOf = new Map<number, number>();
  for (const [earlier, later] of findIdenticalAdjacentYears(records)) {
    otherYearOf.set(earlier, later);
    otherYearOf.set(later, earlier);
  }
  return records.map((record) => {
    const other = otherYearOf.get(record.year) ?? null;
    const notes = record.notes.filter((note) => !isDuplicateNote(note));
    return {
      ...record,
      notes: other === null ? notes : [...notes, noteFor(other)],
      sourceDuplicateOf: other,
    };
  });
}

/** 표식이 달린 레코드에서 동일 구간을 다시 모은다 (화면용). */
export function markedYearPairs(records: readonly ForeignStudentStat[]): YearPair[] {
  const keys = new Set<string>();
  for (const record of records) {
    if (record.sourceDuplicateOf === null) continue;
    const earlier = Math.min(record.year, record.sourceDuplicateOf);
    const later = Math.max(record.year, record.sourceDuplicateOf);
    keys.add(`${earlier}|${later}`);
  }
  return [...keys]
    .map((key) => key.split('|').map(Number) as [number, number])
    .sort((left, right) => left[0] - right[0]);
}
