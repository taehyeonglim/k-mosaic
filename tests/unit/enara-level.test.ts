import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseEnaraLevelTable } from '../../scripts/lib/enara';

const fixture = (code: string) =>
  readFileSync(new URL(`../fixtures/enara-${code}.html`, import.meta.url), 'utf8');

describe('e-나라지표 전국 학교급별 표 파서', () => {
  it('F008402: 2016~2025 학생 수를 학교급별로 읽는다 (2022년 168,645명 교차검증)', () => {
    const table = parseEnaraLevelTable(fixture('F008402'), 'F008402');
    const value = (year: number, level: string) =>
      table.rows.find((row) => row.year === year && row.schoolLevel === level)?.value;

    expect(table.years[0]).toBe(2016);
    expect(table.rows).toHaveLength(table.years.length * 5);
    expect(value(2016, 'all')).toBe(99186);
    expect(value(2022, 'all')).toBe(168645);
    expect(value(2016, 'other')).toBe(318);
  });

  it('F008401: 공표 비율을 읽는다', () => {
    const table = parseEnaraLevelTable(fixture('F008401'), 'F008401');
    expect(table.rows.find((row) => row.year === 2016 && row.schoolLevel === 'all')?.value).toBe(
      1.7,
    );
  });

  it('행 라벨 구조가 바뀌면 예외를 던진다 (조용히 틀린 값을 읽지 않음)', () => {
    const broken = fixture('F008402').replace('중학교', '중등학교');
    expect(() => parseEnaraLevelTable(broken, 'F008402')).toThrow('중학교');
  });
});
