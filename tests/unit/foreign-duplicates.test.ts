import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  findIdenticalAdjacentYears,
  markedYearPairs,
  markIdenticalAdjacentYears,
} from '@/lib/data/foreign-duplicates';
import { parseForeignSnapshot, type ForeignStudentStat } from '@/lib/schema/foreign-student';

function committedRecords(): ForeignStudentStat[] {
  return parseForeignSnapshot(
    JSON.parse(
      readFileSync(
        new URL('../../data/snapshots/foreign-students.v1.json', import.meta.url),
        'utf8',
      ),
    ),
  ).records;
}

const noteFor = (year: number) => `출처에서 ${year}년과 값이 동일함 — 확인 필요`;
const isDuplicateNote = (note: string) => /^출처에서 \d{4}년과 값이 동일함/.test(note);

describe('외국인 유학생 동일 연도 구간', () => {
  it('커밋된 스냅숏에서 2022=2023 구간을 찾는다', () => {
    expect(findIdenticalAdjacentYears(committedRecords())).toEqual([[2022, 2023]]);
  });

  it('표식은 두 해 모두에 상대 연도로 달리고, 입력은 바뀌지 않는다', () => {
    const records = committedRecords();
    const before = JSON.stringify(records);
    const marked = markIdenticalAdjacentYears(records, noteFor, isDuplicateNote);

    expect(JSON.stringify(records)).toBe(before);
    expect(marked.find((r) => r.year === 2023 && r.regionCode === '11')?.sourceDuplicateOf).toBe(
      2022,
    );
    expect(marked.find((r) => r.year === 2022 && r.regionCode === '11')?.sourceDuplicateOf).toBe(
      2023,
    );
    expect(marked.find((r) => r.year === 2024 && r.regionCode === '11')?.sourceDuplicateOf).toBe(
      null,
    );
    expect(markedYearPairs(marked)).toEqual([[2022, 2023]]);
  });

  it('다시 표식을 달아도 주석이 중복되지 않는다 (멱등)', () => {
    const once = markIdenticalAdjacentYears(committedRecords(), noteFor, isDuplicateNote);
    const twice = markIdenticalAdjacentYears(once, noteFor, isDuplicateNote);
    expect(twice).toEqual(once);
  });

  it('새 연도 쌍(2025=2026)도 문구 수정 없이 같은 방식으로 표시된다', () => {
    const records = committedRecords();
    const copied = records
      .filter((record) => record.year === 2025)
      .map((record) => ({ ...record, year: 2026 }));
    const marked = markIdenticalAdjacentYears([...records, ...copied], noteFor, isDuplicateNote);

    expect(markedYearPairs(marked)).toEqual([
      [2022, 2023],
      [2025, 2026],
    ]);
    expect(marked.find((r) => r.year === 2026 && r.regionCode === 'KR')?.notes).toContain(
      noteFor(2025),
    );
  });
});
