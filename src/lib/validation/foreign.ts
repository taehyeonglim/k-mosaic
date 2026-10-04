import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGION_ORDER } from '../constants/regions';
import { findIdenticalAdjacentYears } from '../data/foreign-duplicates';
import type { ForeignSnapshot, ForeignStudentStat } from '../schema/foreign-student';
import type {
  ValidationContext,
  ValidationReport,
  ValidationResult,
  ValidationSeverity,
} from './index';

const EXPECTED_SOURCE_TABLE_IDS = ['DT_1963003_010_S', '153401'] as const;

function result(
  id: string,
  name: string,
  severity: ValidationSeverity,
  passed: boolean,
  detail: string,
): ValidationResult {
  return { id, name, severity, passed, detail };
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function regionalYears(snapshot: ForeignSnapshot): number[] {
  return [
    ...new Set([...snapshot.coverage.years, ...snapshot.records.map((record) => record.year)]),
  ].sort((left, right) => left - right);
}

function regionalRows(snapshot: ForeignSnapshot, year: number): ForeignStudentStat[] {
  return snapshot.records.filter((record) => record.year === year);
}

function readSourceEntries(
  injected?: readonly Record<string, unknown>[],
): Record<string, unknown>[] {
  if (injected !== undefined) return injected.filter(isRecord);
  const path = resolve(process.cwd(), 'data/metadata/sources.v1.json');
  if (!existsSync(path)) return [];
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
    if (Array.isArray(raw)) return raw.filter(isRecord);
    if (isRecord(raw) && Array.isArray(raw.sources)) return raw.sources.filter(isRecord);
  } catch {
    return [];
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function committedForeignSnapshot(): unknown {
  const path = resolve(process.cwd(), 'data/snapshots/foreign-students.v1.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as unknown;
  } catch {
    return null;
  }
}

function coverageList(previous: unknown, key: 'years' | 'nationwideYears'): number[] | null {
  if (!isRecord(previous) || !isRecord(previous.coverage)) return null;
  const list = previous.coverage[key];
  return Array.isArray(list) ? list.map(Number).filter(Number.isInteger) : null;
}

function sourceTableId(entry: Record<string, unknown>): string | null {
  const value = entry.tableId ?? entry.tableCode ?? entry.tblId;
  return value === undefined || value === null ? null : String(value);
}

export function validateForeignSnapshot(
  snapshot: ForeignSnapshot,
  context: ValidationContext = {},
): ValidationReport {
  const years = regionalYears(snapshot);
  const previous =
    context.previousSnapshot === undefined ? committedForeignSnapshot() : context.previousSnapshot;
  const results: ValidationResult[] = [];
  const expectedCodes = new Set(REGION_ORDER);
  const missingRegions = years.flatMap((year) => {
    const codes = new Set(
      regionalRows(snapshot, year)
        .filter((record) => record.regionCode !== 'KR')
        .map((record) => record.regionCode),
    );
    return codes.size === expectedCodes.size && [...expectedCodes].every((code) => codes.has(code))
      ? []
      : [`${year}=${codes.size}`];
  });
  results.push(
    result(
      'F1',
      '17개 시도 존재',
      'block',
      missingRegions.length === 0,
      missingRegions.length === 0
        ? '모든 시도별 연도에 17개 시도가 있습니다.'
        : `누락 또는 부족한 조합: ${missingRegions.join(', ')}`,
    ),
  );

  const nationalMismatches: string[] = [];
  let nationalSkipped = 0;
  for (const year of years) {
    const rows = regionalRows(snapshot, year);
    const national = rows.find((record) => record.regionCode === 'KR');
    for (const metric of ['foreignStudentCount', 'enrolledStudentCount'] as const) {
      const values = REGION_ORDER.map(
        (regionCode) => rows.find((record) => record.regionCode === regionCode)?.[metric],
      );
      if (
        national?.[metric] === undefined ||
        national[metric] === null ||
        values.some((value) => value === undefined || value === null)
      ) {
        nationalSkipped += 1;
        continue;
      }
      const presentValues = values.filter(
        (value): value is number => value !== undefined && value !== null,
      );
      const total = presentValues.reduce((sum, value) => sum + value, 0);
      if (total !== national[metric])
        nationalMismatches.push(`${year}/${metric}: ${total}≠${national[metric]}`);
    }
  }
  results.push(
    result(
      'F2',
      '전국 값과 시도 합',
      'block',
      nationalMismatches.length === 0,
      nationalMismatches.length === 0
        ? `비교 가능한 항목은 모두 일치합니다. 결측으로 ${nationalSkipped}개 비교를 보류했습니다.`
        : nationalMismatches.join(', '),
    ),
  );

  const duplicateKeys = snapshot.records
    .map((record) => `${record.year}|${record.regionCode}`)
    .filter((key, index, keys) => keys.indexOf(key) !== index);
  results.push(
    result(
      'F3',
      '연도·지역 복합키 중복 금지',
      'block',
      duplicateKeys.length === 0,
      duplicateKeys.length === 0
        ? '시도별 연도 복합키가 모두 유일합니다.'
        : `중복 키: ${[...new Set(duplicateKeys)].join(', ')}`,
    ),
  );

  const invalidFormula = snapshot.records.filter((record) => {
    const { foreignStudentCount, enrolledStudentCount, foreignStudentRateComputed } = record;
    if (foreignStudentCount === null || enrolledStudentCount === null)
      return foreignStudentRateComputed !== null;
    if (enrolledStudentCount <= 0) return foreignStudentRateComputed !== null;
    return (
      foreignStudentRateComputed === null ||
      foreignStudentRateComputed !== round4((foreignStudentCount / enrolledStudentCount) * 100)
    );
  });
  results.push(
    result(
      'F4',
      '비율 계산과 결측 전파',
      'block',
      invalidFormula.length === 0,
      invalidFormula.length === 0
        ? '분자·분모 기반 비율이 소수 4자리로 계산되고 결측이 전파됩니다.'
        : `계산식 또는 결측 전파 위반 ${invalidFormula.length}건`,
    ),
  );

  const negativeValues = [
    ...snapshot.records.flatMap((record) => [
      record.foreignStudentCount,
      record.enrolledStudentCount,
    ]),
    ...snapshot.nationwide.flatMap((record) => [record.degreeAndTraining, record.degreeOnly]),
  ].filter((value): value is number => value !== null && value < 0);
  const invalidRates = snapshot.records.filter(
    (record) =>
      record.foreignStudentRateComputed !== null &&
      (!Number.isFinite(record.foreignStudentRateComputed) ||
        record.foreignStudentRateComputed < 0 ||
        record.foreignStudentRateComputed > 100),
  );
  results.push(
    result(
      'F6',
      '음수 수치·비율 범위 금지',
      'block',
      negativeValues.length === 0 && invalidRates.length === 0,
      negativeValues.length === 0 && invalidRates.length === 0
        ? '음수 수치가 없고 비율이 0~100 범위입니다.'
        : `음수 ${negativeValues.length}건, 비율 범위 위반 ${invalidRates.length}건`,
    ),
  );

  const countExceedsEnrolled = snapshot.records.filter(
    (record) =>
      record.foreignStudentCount !== null &&
      record.enrolledStudentCount !== null &&
      record.foreignStudentCount > record.enrolledStudentCount,
  );
  results.push(
    result(
      'F7',
      '외국인 학생 수가 재적 학생 수를 초과하지 않음',
      'block',
      countExceedsEnrolled.length === 0,
      countExceedsEnrolled.length === 0
        ? '분자가 분모를 초과하지 않습니다.'
        : `초과 레코드 ${countExceedsEnrolled.length}건`,
    ),
  );

  const missingZeroViolations = snapshot.records.filter((record) => {
    const hasMissing = record.foreignStudentCount === null || record.enrolledStudentCount === null;
    const markedMissing = record.notes.some((note) => note.includes('원자료 결측'));
    return hasMissing !== markedMissing;
  });
  results.push(
    result(
      'F8',
      '결측과 0 구분 유지',
      'block',
      missingZeroViolations.length === 0,
      missingZeroViolations.length === 0
        ? '결측과 0값이 notes로 구분됩니다.'
        : `결측·0 구분 위반 ${missingZeroViolations.length}건`,
    ),
  );

  const entries = readSourceEntries(context.sourceEntries);
  const missingSourceIds = EXPECTED_SOURCE_TABLE_IDS.filter(
    (tableId) =>
      !entries.some(
        (entry) =>
          sourceTableId(entry) === tableId &&
          typeof entry.retrievedAt === 'string' &&
          entry.retrievedAt.length > 0,
      ),
  );
  const hasRetrievedAt =
    snapshot.retrievedAt.length > 0 &&
    entries.length > 0 &&
    entries.every((entry) => typeof entry.retrievedAt === 'string' && entry.retrievedAt.length > 0);
  results.push(
    result(
      'F9',
      '통계표 ID 누락 금지',
      'block',
      missingSourceIds.length === 0,
      missingSourceIds.length === 0
        ? `필수 통계표 ${EXPECTED_SOURCE_TABLE_IDS.length}개의 ID가 있습니다.`
        : `누락된 통계표 ID: ${missingSourceIds.join(', ')}`,
    ),
  );
  results.push(
    result(
      'F10',
      '조회일 누락 금지',
      'block',
      hasRetrievedAt,
      hasRetrievedAt
        ? '스냅숏과 출처 메타데이터의 조회일이 있습니다.'
        : '스냅숏 또는 출처 메타데이터의 조회일이 없습니다.',
    ),
  );

  // 이전 스냅숏의 연도가 사라지면 안 된다 — 업스트림이 오래된 연도를 빼도 공개 데이터는
  // 줄어들지 않아야 한다 (다문화 V8 과 같은 원칙).
  const lostYears = (['years', 'nationwideYears'] as const).flatMap((key) => {
    const before = coverageList(previous, key);
    const after = new Set(snapshot.coverage[key]);
    return (before ?? []).filter((year) => !after.has(year)).map((year) => `${key}:${year}`);
  });
  results.push(
    result(
      'F5',
      '연도 커버리지 유지',
      'block',
      lostYears.length === 0,
      previous === null
        ? '이전 스냅숏이 없어 커버리지 비교를 건너뛰었습니다.'
        : lostYears.length === 0
          ? '이전 스냅숏의 모든 연도가 유지됩니다.'
          : `이전 스냅숏 대비 누락된 연도: ${lostYears.join(', ')}`,
    ),
  );

  // 동일 연도 구간은 검증기가 찾기만 하고 표식은 빌드 단계가 단다 (검증기는 입력을 바꾸지 않는다).
  // 찾은 구간과 레코드의 표식(sourceDuplicateOf)이 어긋나면 화면이 잘못 안내하므로 차단한다.
  const identicalPairs = findIdenticalAdjacentYears(snapshot.records);
  const expectedMark = new Map<number, number>();
  for (const [earlier, later] of identicalPairs) {
    expectedMark.set(earlier, later);
    expectedMark.set(later, earlier);
  }
  const markMismatches = snapshot.records.filter(
    (record) => (expectedMark.get(record.year) ?? null) !== record.sourceDuplicateOf,
  );
  const pairLabels = identicalPairs.map(([earlier, later]) => `${earlier}=${later}`);
  results.push(
    result(
      'F11',
      '연속 연도 전량 동일 탐지',
      markMismatches.length > 0 ? 'block' : 'warn',
      identicalPairs.length === 0 && markMismatches.length === 0,
      markMismatches.length > 0
        ? `동일 구간 표식 불일치 ${markMismatches.length}건 (탐지 구간: ${pairLabels.join(', ') || '없음'}) — build-foreign 으로 다시 생성하세요.`
        : identicalPairs.length === 0
          ? '인접한 두 연도의 모든 지역 값이 동일한 구간이 없습니다.'
          : `확인 필요 구간: ${pairLabels.join(', ')} (표식 일치 — 화면에 "자료 확인 필요"로 표시)`,
    ),
  );

  return {
    passed: results.every((validation) => validation.severity !== 'block' || validation.passed),
    results,
  };
}
