import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { mergeSourceEntries } from '../../scripts/lib/source-metadata';
import { loadSnapshot } from '@/lib/data/snapshot';
import type { SourceMeta } from '@/lib/schema';
import { parseForeignSnapshot } from '@/lib/schema/foreign-student';
import { validateSnapshot } from '@/lib/validation';
import { validateForeignSnapshot } from '@/lib/validation/foreign';

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8'));
}

function committedSources(): SourceMeta[] {
  return (readJson('data/metadata/sources.v1.json') as { sources: SourceMeta[] }).sources;
}

function foreignSnapshot() {
  return parseForeignSnapshot(readJson('data/snapshots/foreign-students.v1.json'));
}

function rule(report: ReturnType<typeof validateSnapshot>, id: string) {
  const found = report.results.find((result) => result.id === id);
  if (found === undefined) throw new Error(`규칙 ${id} 결과가 없습니다.`);
  return found;
}

describe('검증 입력 주입 — 다문화학생', () => {
  it('주입한 출처 항목으로 통계표 ID를 검사한다 (디스크 파일을 읽지 않는다)', () => {
    const withoutDenominator = committedSources().filter(
      (entry) => entry.tableId !== 'DT_1963003_009',
    );
    const report = validateSnapshot(loadSnapshot(), { sourceEntries: withoutDenominator });

    expect(rule(report, 'X10').passed).toBe(false);
    expect(report.passed).toBe(false);
  });

  it('비교 기준 스냅숏에 있던 연도가 빠지면 V8이 실패한다', () => {
    const snapshot = loadSnapshot();
    const previous = {
      ...snapshot,
      coverage: { ...snapshot.coverage, years: [2019, ...snapshot.coverage.years] },
    };
    const report = validateSnapshot(snapshot, { previousSnapshot: previous });

    expect(rule(report, 'V8').passed).toBe(false);
    expect(rule(report, 'V8').detail).toContain('2019');
  });

  it('비교 기준이 null 이면 V7·V8 비교를 건너뛴다', () => {
    const report = validateSnapshot(loadSnapshot(), { previousSnapshot: null });

    expect(rule(report, 'V8').passed).toBe(true);
    expect(rule(report, 'V8').detail).toContain('건너뛰었습니다');
  });
});

describe('검증 입력 주입 — 외국인 유학생', () => {
  it('주입한 출처 항목에 153401 이 없으면 X10 이 실패한다', () => {
    const entries = committedSources().filter((entry) => entry.tableId !== '153401');
    const report = validateForeignSnapshot(foreignSnapshot(), { sourceEntries: entries });

    expect(rule(report, 'X10').passed).toBe(false);
  });

  it('비교 기준의 전국 장기 시계열 연도가 빠지면 F5 가 실패한다', () => {
    const snapshot = foreignSnapshot();
    const previous = {
      ...snapshot,
      coverage: {
        ...snapshot.coverage,
        nationwideYears: [2017, ...snapshot.coverage.nationwideYears],
      },
    };
    const report = validateForeignSnapshot(snapshot, { previousSnapshot: previous });

    expect(rule(report, 'F5').passed).toBe(false);
    expect(rule(report, 'F5').detail).toContain('nationwideYears:2017');
  });

  it('커밋된 외국인 스냅숏은 차단 수준 규칙을 모두 통과한다', () => {
    expect(validateForeignSnapshot(foreignSnapshot()).passed).toBe(true);
  });
});

describe('출처 메타데이터 병합', () => {
  it('다른 데이터셋의 출처를 보존하고 같은 통계표는 교체한다', () => {
    const existing = committedSources();
    const refreshed = { ...existing[0]!, retrievedAt: '2026-11-01T00:00:00.000Z' };
    const merged = mergeSourceEntries(existing, [refreshed]);

    expect(merged.map((entry) => entry.tableId)).toEqual(existing.map((entry) => entry.tableId));
    expect(merged[0]?.retrievedAt).toBe('2026-11-01T00:00:00.000Z');
    expect(merged.some((entry) => entry.tableId === '153401')).toBe(true);
  });

  it('새 통계표는 뒤에 붙인다', () => {
    const existing = committedSources();
    const added = { ...existing[0]!, tableId: 'F008402' };
    const merged = mergeSourceEntries(existing, [added]);

    expect(merged.at(-1)?.tableId).toBe('F008402');
    expect(merged).toHaveLength(existing.length + 1);
  });
});
