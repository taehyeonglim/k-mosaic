import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGION_ORDER } from '../constants/regions';
import type { ForeignSnapshot, ForeignStudentStat } from '../schema/foreign-student';
import type { RegionCode } from '../schema/dimensions';
import type { ValidationReport, ValidationResult, ValidationSeverity } from './index';

const X12_NOTE = '출처에서 2022년과 값이 동일함 — 확인 필요';
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

function readSourceEntries(): Record<string, unknown>[] {
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

function sourceTableId(entry: Record<string, unknown>): string | null {
  const value = entry.tableId ?? entry.tableCode ?? entry.tblId;
  return value === undefined || value === null ? null : String(value);
}

function annotateIdenticalAdjacentYears(snapshot: ForeignSnapshot): string[] {
  const years = regionalYears(snapshot);
  const warnings: string[] = [];
  const codes: Array<'KR' | RegionCode> = ['KR', ...REGION_ORDER];
  for (let index = 1; index < years.length; index += 1) {
    const previousYear = years[index - 1];
    const currentYear = years[index];
    if (previousYear === undefined || currentYear === undefined || currentYear !== previousYear + 1)
      continue;
    const previous = new Map(
      regionalRows(snapshot, previousYear).map((record) => [record.regionCode, record]),
    );
    const current = new Map(
      regionalRows(snapshot, currentYear).map((record) => [record.regionCode, record]),
    );
    const identical = codes.every((code) => {
      const left = previous.get(code);
      const right = current.get(code);
      return (
        left !== undefined &&
        right !== undefined &&
        left.foreignStudentCount === right.foreignStudentCount &&
        left.enrolledStudentCount === right.enrolledStudentCount &&
        left.foreignStudentRateComputed === right.foreignStudentRateComputed
      );
    });
    if (!identical) continue;
    warnings.push(`${previousYear}=${currentYear}`);
    for (const code of codes) {
      const left = previous.get(code);
      const right = current.get(code);
      if (left !== undefined && !left.notes.includes(X12_NOTE)) left.notes.push(X12_NOTE);
      if (right !== undefined && !right.notes.includes(X12_NOTE)) right.notes.push(X12_NOTE);
    }
  }
  return warnings;
}

export function validateForeignSnapshot(snapshot: ForeignSnapshot): ValidationReport {
  const years = regionalYears(snapshot);
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
      'X3',
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
      'X5',
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
      'X9',
      '결측과 0 구분 유지',
      'block',
      missingZeroViolations.length === 0,
      missingZeroViolations.length === 0
        ? '결측과 0값이 notes로 구분됩니다.'
        : `결측·0 구분 위반 ${missingZeroViolations.length}건`,
    ),
  );

  const entries = readSourceEntries();
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
      'X10',
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
      'X11',
      '조회일 누락 금지',
      'block',
      hasRetrievedAt,
      hasRetrievedAt
        ? '스냅숏과 출처 메타데이터의 조회일이 있습니다.'
        : '스냅숏 또는 출처 메타데이터의 조회일이 없습니다.',
    ),
  );

  const identicalYears = annotateIdenticalAdjacentYears(snapshot);
  results.push(
    result(
      'X12',
      '연속 연도 전량 동일 탐지',
      'warn',
      identicalYears.length === 0,
      identicalYears.length === 0
        ? '인접한 두 연도의 모든 지역 값이 동일한 구간이 없습니다.'
        : `확인 필요 구간: ${identicalYears.join(', ')}`,
    ),
  );

  return {
    passed: results.every((validation) => validation.severity !== 'block' || validation.passed),
    results,
  };
}
