import { describe, expect, it, vi } from 'vitest';

import { loadSnapshot } from '@/lib/data/snapshot';
import type { Snapshot } from '@/lib/schema';
import { validateSnapshot } from '@/lib/validation';

function cloneSnapshot(): Snapshot {
  return structuredClone(loadSnapshot());
}

function expectBlocked(snapshot: Snapshot, ruleId: string): void {
  const report = validateSnapshot(snapshot);
  expect(report.passed).toBe(false);
  expect(report.results.find((result) => result.id === ruleId)?.passed).toBe(false);
}

async function validateWithMetadata(snapshot: Snapshot, metadata: unknown) {
  vi.resetModules();
  vi.doMock('node:fs', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    return {
      ...actual,
      existsSync(path: unknown) {
        if (String(path).endsWith('data/metadata/sources.v1.json')) return true;
        return actual.existsSync(path as Parameters<typeof actual.existsSync>[0]);
      },
      readFileSync(path: unknown, ...rest: unknown[]) {
        if (String(path).endsWith('data/metadata/sources.v1.json')) {
          return JSON.stringify(metadata);
        }
        return actual.readFileSync(
          path as Parameters<typeof actual.readFileSync>[0],
          ...(rest as Parameters<typeof actual.readFileSync> extends [unknown, ...infer R]
            ? R
            : never[]),
        );
      },
    };
  });

  try {
    const validationModule = await import('@/lib/validation');
    return validationModule.validateSnapshot(snapshot);
  } finally {
    vi.doUnmock('node:fs');
    vi.resetModules();
  }
}

describe('스냅숏 검증 게이트 V1~V8 및 확장 규칙', () => {
  it('정상 스냅숏은 통과한다', () => {
    expect(validateSnapshot(loadSnapshot()).passed).toBe(true);
  });

  it('시도 하나가 누락되면 V1에서 차단한다', () => {
    const snapshot = cloneSnapshot();
    const index = snapshot.records.findIndex(
      (record) =>
        record.year === 2025 && record.regionCode === '41' && record.schoolLevel === 'all',
    );
    expect(index).toBeGreaterThanOrEqual(0);
    snapshot.records.splice(index, 1);
    expectBlocked(snapshot, 'V1');
  });

  it('동일한 연도·지역·학교급·유형 레코드가 중복되면 X2에서 차단한다', () => {
    const snapshot = cloneSnapshot();
    const record = snapshot.records.find(
      (candidate) =>
        candidate.year === 2025 && candidate.regionCode === '41' && candidate.schoolLevel === 'all',
    );
    expect(record).toBeDefined();
    if (record === undefined) throw new Error('중복 테스트용 레코드를 찾지 못했습니다.');
    snapshot.records.push(structuredClone(record));
    expectBlocked(snapshot, 'X2');
  });

  it('음수 학생 수가 있으면 X3에서 차단한다', () => {
    const snapshot = cloneSnapshot();
    const record = snapshot.records.find(
      (candidate) => candidate.multiculturalStudentCount !== null,
    );
    expect(record).toBeDefined();
    if (record === undefined) throw new Error('음수 테스트용 레코드를 찾지 못했습니다.');
    record.multiculturalStudentCount = -1;
    expectBlocked(snapshot, 'X3');
  });

  it('비율이 100을 초과하면 X4에서 차단한다', () => {
    const snapshot = cloneSnapshot();
    const record = snapshot.records.find(
      (candidate) => candidate.multiculturalStudentRateComputed !== null,
    );
    expect(record).toBeDefined();
    if (record === undefined) throw new Error('비율 테스트용 레코드를 찾지 못했습니다.');
    record.multiculturalStudentRateComputed = 100.1;
    expectBlocked(snapshot, 'X4');
  });

  it('다문화학생 수가 전체 학생 수보다 크면 X5에서 차단한다', () => {
    const snapshot = cloneSnapshot();
    const record = snapshot.records.find(
      (candidate) =>
        candidate.multiculturalStudentCount !== null && candidate.totalStudentCount !== null,
    );
    expect(record).toBeDefined();
    if (record === undefined || record.totalStudentCount === null) {
      throw new Error('분자·분모 테스트용 레코드를 찾지 못했습니다.');
    }
    record.multiculturalStudentCount = record.totalStudentCount + 1;
    expectBlocked(snapshot, 'X5');
  });

  it('학교급 합계가 all과 다르면 V3에서 차단한다', () => {
    const snapshot = cloneSnapshot();
    const record = snapshot.records.find(
      (candidate) =>
        candidate.year === 2025 && candidate.regionCode === 'KR' && candidate.schoolLevel === 'all',
    );
    expect(record).toBeDefined();
    if (record === undefined || record.multiculturalStudentCount === null) {
      throw new Error('학교급 합계 테스트용 레코드를 찾지 못했습니다.');
    }
    record.multiculturalStudentCount += 1;
    expectBlocked(snapshot, 'V3');
  });

  it('전국 값이 시도 합과 다르면 V2에서 차단한다', () => {
    const snapshot = cloneSnapshot();
    const record = snapshot.records.find(
      (candidate) =>
        candidate.year === 2025 && candidate.regionCode === '11' && candidate.schoolLevel === 'all',
    );
    expect(record).toBeDefined();
    if (record === undefined || record.multiculturalStudentCount === null) {
      throw new Error('전국 합계 테스트용 레코드를 찾지 못했습니다.');
    }
    record.multiculturalStudentCount += 1;
    expectBlocked(snapshot, 'V2');
  });

  it('원자료 결측을 0으로 치환하면 X9에서 차단한다', () => {
    const snapshot = cloneSnapshot();
    const record = snapshot.records.find(
      (candidate) =>
        candidate.multiculturalStudentCount === null &&
        candidate.notes.some((note) => note.includes('원자료 결측')),
    );
    expect(record).toBeDefined();
    if (record === undefined) throw new Error('결측 테스트용 레코드를 찾지 못했습니다.');
    record.multiculturalStudentCount = 0;
    expectBlocked(snapshot, 'X9');
  });

  it('통계표 ID가 누락되면 X10에서 차단한다', async () => {
    const metadata = structuredClone(
      (await import('../../data/metadata/sources.v1.json')).default,
    ) as { sources: Array<Record<string, unknown>> };
    const source = metadata.sources.find((entry) => entry.tableId === 'F008403');
    expect(source).toBeDefined();
    if (source === undefined) throw new Error('통계표 ID 테스트용 메타데이터를 찾지 못했습니다.');
    source.tableId = undefined;

    const report = await validateWithMetadata(cloneSnapshot(), metadata);
    expect(report.passed).toBe(false);
    expect(report.results.find((result) => result.id === 'X10')?.passed).toBe(false);
  });

  it('조회일이 누락되면 X11에서 차단한다', async () => {
    const metadata = structuredClone(
      (await import('../../data/metadata/sources.v1.json')).default,
    ) as { sources: Array<Record<string, unknown>> };
    const source = metadata.sources[0];
    expect(source).toBeDefined();
    if (source === undefined) throw new Error('조회일 테스트용 메타데이터를 찾지 못했습니다.');
    source.retrievedAt = undefined;

    const report = await validateWithMetadata(cloneSnapshot(), metadata);
    expect(report.passed).toBe(false);
    expect(report.results.find((result) => result.id === 'X11')?.passed).toBe(false);
  });
});
