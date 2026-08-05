import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MulticulturalStudentStat, Snapshot } from '../schema/index';

export type ValidationSeverity = 'block' | 'warn';

export interface ValidationResult {
  id: string;
  name: string;
  severity: ValidationSeverity;
  passed: boolean;
  detail: string;
}

export interface ValidationReport {
  passed: boolean;
  results: ValidationResult[];
}

const SCHOOL_LEVELS = ['elementary', 'middle', 'high', 'other'] as const;
const EXPECTED_SOURCE_TABLE_IDS = [
  'F008403',
  'DT_1963003_002',
  'DT_1963003_003',
  'DT_1963003_004',
  'DT_1963003_009',
] as const;
const SURGE_THRESHOLD_PCT = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function result(
  id: string,
  name: string,
  severity: ValidationSeverity,
  passed: boolean,
  detail: string,
): ValidationResult {
  return { id, name, severity, passed, detail };
}

function allYears(snapshot: Snapshot): number[] {
  return [...new Set(snapshot.records.map((record) => record.year))].sort((a, b) => a - b);
}

function allLevels(snapshot: Snapshot): string[] {
  return [...new Set(snapshot.records.map((record) => record.schoolLevel))];
}

function slice(snapshot: Snapshot, year: number, schoolLevel: string): MulticulturalStudentStat[] {
  return snapshot.records.filter(
    (record) => record.year === year && record.schoolLevel === schoolLevel,
  );
}

function sourceMetadata(): {
  raw: unknown;
  entries: Record<string, unknown>[];
  retrievedAt: string | null;
} {
  const path = resolve(process.cwd(), 'data/metadata/sources.v1.json');
  if (!existsSync(path)) return { raw: null, entries: [], retrievedAt: null };
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (Array.isArray(raw)) {
      return {
        raw,
        entries: raw.filter(isRecord),
        retrievedAt: null,
      };
    }
    if (!isRecord(raw)) return { raw, entries: [], retrievedAt: null };
    if (Array.isArray(raw.sources)) {
      return {
        raw,
        entries: raw.sources.filter(isRecord),
        retrievedAt: typeof raw.retrievedAt === 'string' ? raw.retrievedAt : null,
      };
    }
    const entries: Record<string, unknown>[] = [];
    if (isRecord(raw.numerator)) entries.push(raw.numerator);
    if (isRecord(raw.denominator) && isRecord(raw.denominator.tables)) {
      for (const table of Object.values(raw.denominator.tables))
        if (isRecord(table)) entries.push(table);
    }
    return {
      raw,
      entries,
      retrievedAt: typeof raw.retrievedAt === 'string' ? raw.retrievedAt : null,
    };
  } catch {
    return { raw: null, entries: [], retrievedAt: null };
  }
}

function sourceTableIds(raw: unknown, entries: Record<string, unknown>[]): string[] {
  const ids = entries.flatMap((entry) => {
    const id = entry.tableId ?? entry.tableCode ?? entry.tblId;
    return id === undefined || id === null ? [] : [String(id)];
  });
  if (isRecord(raw) && isRecord(raw.numerator) && raw.numerator.tableCode !== undefined) {
    ids.push(String(raw.numerator.tableCode));
  }
  return [...new Set(ids)];
}

function hasSourceLineage(raw: unknown, entries: Record<string, unknown>[]): boolean {
  if (
    isRecord(raw) &&
    isRecord(raw.numerator) &&
    isRecord(raw.denominator) &&
    isRecord(raw.denominator.tables) &&
    Object.keys(raw.denominator.tables).length >= 4 &&
    raw.numerator.tableCode !== undefined
  ) {
    return true;
  }
  if (entries.length >= EXPECTED_SOURCE_TABLE_IDS.length) {
    return entries.every((entry) => {
      const tableId = entry.tableId ?? entry.tableCode ?? entry.tblId;
      const provider = entry.provider;
      return tableId !== undefined && provider !== undefined;
    });
  }
  return (
    isRecord(raw) &&
    isRecord(raw.numerator) &&
    isRecord(raw.denominator) &&
    isRecord(raw.denominator.tables) &&
    Object.keys(raw.denominator.tables).length >= 4 &&
    raw.numerator.tableCode !== undefined
  );
}

function previousCoverageYears(): number[] | null {
  const path = resolve(process.cwd(), 'data/snapshots/multicultural-students.v1.json');
  if (!existsSync(path)) return null;
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!isRecord(raw) || !isRecord(raw.coverage) || !Array.isArray(raw.coverage.years))
      return null;
    return raw.coverage.years.map(Number).filter(Number.isInteger);
  } catch {
    return null;
  }
}

function previousSnapshotWithoutRetrievedAt(): string | null {
  const path = resolve(process.cwd(), 'data/snapshots/multicultural-students.v1.json');
  if (!existsSync(path)) return null;
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!isRecord(raw)) return null;
    const copy = { ...raw };
    delete copy.retrievedAt;
    return JSON.stringify(copy);
  } catch {
    return null;
  }
}

function rounded4(value: number): number {
  return Number(value.toFixed(4));
}

function uniqueKey(record: MulticulturalStudentStat): string {
  return `${record.year}|${record.regionCode}|${record.schoolLevel}|${record.studentType}`;
}

export function validateSnapshot(s: Snapshot): ValidationReport {
  const years = allYears(s);
  const levels = allLevels(s);
  const source = sourceMetadata();
  const results: ValidationResult[] = [];

  const missingRegionSlices: string[] = [];
  for (const year of years) {
    for (const schoolLevel of levels) {
      const codes = new Set(
        slice(s, year, schoolLevel)
          .filter((record) => record.regionCode !== 'KR')
          .map((record) => record.regionCode),
      );
      if (codes.size !== 17) missingRegionSlices.push(`${year}/${schoolLevel}=${codes.size}`);
    }
  }
  results.push(
    result(
      'V1',
      '17개 시도 존재',
      'block',
      missingRegionSlices.length === 0,
      missingRegionSlices.length === 0
        ? '모든 연도·학교급에 17개 시도가 있습니다.'
        : `누락 또는 부족한 조합: ${missingRegionSlices.join(', ')}`,
    ),
  );

  const nationalMismatch: string[] = [];
  let nationalSkipped = 0;
  for (const year of years) {
    for (const schoolLevel of levels) {
      const rows = slice(s, year, schoolLevel);
      const national = rows.find((record) => record.regionCode === 'KR')?.multiculturalStudentCount;
      const regions = rows
        .filter((record) => record.regionCode !== 'KR')
        .map((record) => record.multiculturalStudentCount);
      if (
        national === undefined ||
        regions.some((value) => value === null || value === undefined)
      ) {
        nationalSkipped += 1;
      } else {
        const presentRegions = regions.filter(
          (value): value is number => value !== null && value !== undefined,
        );
        const total = presentRegions.reduce((sum, value) => sum + value, 0);
        if (total !== national)
          nationalMismatch.push(`${year}/${schoolLevel}: ${total}≠${national}`);
      }
    }
  }
  results.push(
    result(
      'V2',
      '시도 합계와 전국 값',
      'block',
      nationalMismatch.length === 0,
      nationalMismatch.length === 0
        ? `비교 가능한 조합은 모두 일치합니다. 결측으로 ${nationalSkipped}개 조합은 비교를 보류했습니다.`
        : nationalMismatch.join(', '),
    ),
  );

  const levelSumMismatch: string[] = [];
  let levelSumSkipped = 0;
  for (const year of years) {
    for (const regionCode of [
      'KR',
      ...s.records
        .filter((record) => record.regionCode !== 'KR')
        .map((record) => record.regionCode),
    ]) {
      const rows = s.records.filter(
        (record) => record.year === year && record.regionCode === regionCode,
      );
      const all = rows.find((record) => record.schoolLevel === 'all')?.multiculturalStudentCount;
      const parts = SCHOOL_LEVELS.map(
        (level) => rows.find((record) => record.schoolLevel === level)?.multiculturalStudentCount,
      );
      if (all === undefined || parts.some((value) => value === undefined || value === null)) {
        levelSumSkipped += 1;
      } else {
        const presentParts = parts.filter(
          (value): value is number => value !== undefined && value !== null,
        );
        const total = presentParts.reduce((sum, value) => sum + value, 0);
        if (total !== all) levelSumMismatch.push(`${year}/${regionCode}: ${total}≠${all}`);
      }
    }
  }
  results.push(
    result(
      'V3',
      '학교급 합계와 all',
      'block',
      levelSumMismatch.length === 0,
      levelSumMismatch.length === 0
        ? `비교 가능한 조합은 모두 일치합니다. 결측으로 ${levelSumSkipped}개 조합은 비교를 보류했습니다.`
        : levelSumMismatch.join(', '),
    ),
  );

  const rateMismatches: string[] = [];
  let rateComparisons = 0;
  for (const record of s.records) {
    if (
      record.year < 2025 &&
      record.multiculturalStudentRateComputed !== null &&
      record.multiculturalStudentRatePublished !== null
    ) {
      rateComparisons += 1;
      if (
        Math.abs(
          record.multiculturalStudentRateComputed - record.multiculturalStudentRatePublished,
        ) > 0.1
      ) {
        rateMismatches.push(
          `${record.year}/${record.regionCode}/${record.schoolLevel}: ${record.multiculturalStudentRateComputed} vs ${record.multiculturalStudentRatePublished}`,
        );
      }
    }
  }
  results.push(
    result(
      'V4',
      '계산 비율과 공표 비율',
      'block',
      rateComparisons > 0 && rateMismatches.length === 0,
      rateMismatches.length === 0
        ? `2024년 이전 비교 ${rateComparisons}건이 모두 ±0.1%p 이내입니다.`
        : rateMismatches.join(', '),
    ),
  );

  const invalidMissingPropagation = s.records.filter(
    (record) =>
      (record.multiculturalStudentCount === null &&
        record.multiculturalStudentRateComputed !== null) ||
      (record.totalStudentCount === null && record.multiculturalStudentRateComputed !== null) ||
      (record.multiculturalStudentRateComputed === null &&
        record.multiculturalStudentCount !== null &&
        record.totalStudentCount !== null &&
        record.totalStudentCount > 0),
  );
  results.push(
    result(
      'V5',
      '결측값 보존과 비율 결측 전파',
      'block',
      invalidMissingPropagation.length === 0,
      invalidMissingPropagation.length === 0
        ? 'null은 0으로 대체되지 않았고 비율 결측이 전파됩니다.'
        : `결측 전파 위반 ${invalidMissingPropagation.length}건`,
    ),
  );

  results.push(
    result(
      'V6',
      '레코드 출처 메타데이터',
      'block',
      hasSourceLineage(source.raw, source.entries),
      hasSourceLineage(source.raw, source.entries)
        ? `출처 메타데이터 ${source.entries.length}건이 확인됩니다.`
        : '출처 메타데이터 파일 또는 통계표 계보가 없습니다.',
    ),
  );

  const previousSnapshot = previousSnapshotWithoutRetrievedAt();
  const currentSnapshot: Record<string, unknown> = { ...s };
  delete currentSnapshot.retrievedAt;
  const stableRecords =
    previousSnapshot === null || previousSnapshot === JSON.stringify(currentSnapshot);
  results.push(
    result(
      'V7',
      '멱등성 구조 점검',
      'warn',
      stableRecords,
      previousSnapshot === null
        ? '이전 스냅숏이 없어 멱등성 비교를 건너뛰었습니다.'
        : stableRecords
          ? '이전 스냅숏과 retrievedAt을 제외한 데이터가 동일합니다.'
          : '이전 스냅숏과 retrievedAt 외 데이터가 달라졌습니다.',
    ),
  );

  const previousYears = previousCoverageYears();
  const coverageNotReduced =
    previousYears === null || previousYears.every((year) => years.includes(year));
  results.push(
    result(
      'V8',
      '연도 커버리지 유지',
      'warn',
      coverageNotReduced,
      previousYears === null
        ? '이전 스냅숏이 없어 커버리지 비교를 건너뛰었습니다.'
        : coverageNotReduced
          ? '이전 스냅숏의 모든 연도가 유지됩니다.'
          : `이전 스냅숏 대비 누락된 연도: ${previousYears.filter((year) => !years.includes(year)).join(', ')}`,
    ),
  );

  const duplicateRegionCodes: string[] = [];
  for (const year of years) {
    for (const schoolLevel of levels) {
      const codes = slice(s, year, schoolLevel)
        .filter((record) => record.regionCode !== 'KR')
        .map((record) => record.regionCode);
      if (new Set(codes).size !== codes.length) duplicateRegionCodes.push(`${year}/${schoolLevel}`);
    }
  }
  results.push(
    result(
      'X1',
      '17개 시도 코드 중복 금지',
      'block',
      duplicateRegionCodes.length === 0,
      duplicateRegionCodes.length === 0
        ? '연도·학교급별 시도 코드가 중복되지 않습니다.'
        : `중복 조합: ${duplicateRegionCodes.join(', ')}`,
    ),
  );

  const keys = s.records.map(uniqueKey);
  const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
  results.push(
    result(
      'X2',
      '연도·지역·학교급·학생유형 복합키 중복 금지',
      'block',
      duplicateKeys.length === 0,
      duplicateKeys.length === 0
        ? '복합키가 모두 유일합니다.'
        : `중복 키: ${[...new Set(duplicateKeys)].join(', ')}`,
    ),
  );

  const negativeCounts = s.records.filter(
    (record) =>
      (record.multiculturalStudentCount !== null && record.multiculturalStudentCount < 0) ||
      (record.totalStudentCount !== null && record.totalStudentCount < 0),
  );
  results.push(
    result(
      'X3',
      '음수 학생 수 금지',
      'block',
      negativeCounts.length === 0,
      negativeCounts.length === 0
        ? '음수 학생 수가 없습니다.'
        : `음수 학생 수 ${negativeCounts.length}건`,
    ),
  );

  const invalidRates = s.records.filter((record) =>
    [record.multiculturalStudentRateComputed, record.multiculturalStudentRatePublished].some(
      (rate) => rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100),
    ),
  );
  results.push(
    result(
      'X4',
      '비율 0~100 범위',
      'block',
      invalidRates.length === 0,
      invalidRates.length === 0
        ? '모든 비율이 0~100 범위입니다.'
        : `범위 위반 ${invalidRates.length}건`,
    ),
  );

  const countExceedsTotal = s.records.filter(
    (record) =>
      record.multiculturalStudentCount !== null &&
      record.totalStudentCount !== null &&
      record.multiculturalStudentCount > record.totalStudentCount,
  );
  results.push(
    result(
      'X5',
      '다문화학생 수가 전체 학생 수를 초과하지 않음',
      'block',
      countExceedsTotal.length === 0,
      countExceedsTotal.length === 0
        ? '분자가 분모를 초과하지 않습니다.'
        : `초과 레코드 ${countExceedsTotal.length}건`,
    ),
  );

  const denominatorLevelMismatches: string[] = [];
  for (const year of years) {
    for (const regionCode of [...new Set(s.records.map((record) => record.regionCode))]) {
      const rows = s.records.filter(
        (record) => record.year === year && record.regionCode === regionCode,
      );
      const all = rows.find((record) => record.schoolLevel === 'all')?.totalStudentCount;
      const parts = SCHOOL_LEVELS.map(
        (level) => rows.find((record) => record.schoolLevel === level)?.totalStudentCount,
      );
      if (
        all !== undefined &&
        all !== null &&
        parts.every((value) => value !== undefined && value !== null)
      ) {
        const presentParts = parts.filter(
          (value): value is number => value !== undefined && value !== null,
        );
        const total = presentParts.reduce((sum, value) => sum + value, 0);
        if (total !== all)
          denominatorLevelMismatches.push(`${year}/${regionCode}: ${total}≠${all}`);
      }
    }
  }
  results.push(
    result(
      'X6',
      '학교급 분모 합계와 all 분모',
      'block',
      denominatorLevelMismatches.length === 0,
      denominatorLevelMismatches.length === 0
        ? '비교 가능한 분모 합계가 모두 일치합니다.'
        : denominatorLevelMismatches.join(', '),
    ),
  );

  const nationalDenominatorMismatches: string[] = [];
  for (const year of years) {
    for (const schoolLevel of levels) {
      const rows = slice(s, year, schoolLevel);
      const national = rows.find((record) => record.regionCode === 'KR')?.totalStudentCount;
      const regions = rows
        .filter((record) => record.regionCode !== 'KR')
        .map((record) => record.totalStudentCount);
      if (
        national !== undefined &&
        national !== null &&
        regions.every((value) => value !== undefined && value !== null)
      ) {
        const presentRegions = regions.filter(
          (value): value is number => value !== undefined && value !== null,
        );
        const total = presentRegions.reduce((sum, value) => sum + value, 0);
        if (total !== national)
          nationalDenominatorMismatches.push(`${year}/${schoolLevel}: ${total}≠${national}`);
      }
    }
  }
  results.push(
    result(
      'X7',
      '전국 분모 값과 시도 합',
      'block',
      nationalDenominatorMismatches.length === 0,
      nationalDenominatorMismatches.length === 0
        ? '비교 가능한 전국 분모와 시도 합이 모두 일치합니다.'
        : nationalDenominatorMismatches.join(', '),
    ),
  );

  const surgeWarnings: string[] = [];
  for (const regionCode of [...new Set(s.records.map((record) => record.regionCode))]) {
    for (const schoolLevel of levels) {
      const byYear = new Map(
        s.records
          .filter(
            (record) => record.regionCode === regionCode && record.schoolLevel === schoolLevel,
          )
          .map((record) => [record.year, record.multiculturalStudentCount]),
      );
      for (const year of years) {
        const current = byYear.get(year);
        const previous = byYear.get(year - 1);
        if (
          current === undefined ||
          current === null ||
          previous === undefined ||
          previous === null ||
          previous === 0
        )
          continue;
        const deltaPct = (current / previous - 1) * 100;
        if (Math.abs(deltaPct) > SURGE_THRESHOLD_PCT)
          surgeWarnings.push(`${year}/${regionCode}/${schoolLevel}: ${rounded4(deltaPct)}%`);
      }
    }
  }
  results.push(
    result(
      'X8',
      '전년 대비 비정상 급증·급감 경고',
      'warn',
      surgeWarnings.length === 0,
      surgeWarnings.length === 0
        ? `전년 대비 ±${SURGE_THRESHOLD_PCT}% 초과 변화가 없습니다.`
        : `±${SURGE_THRESHOLD_PCT}% 초과 변화 ${surgeWarnings.length}건: ${surgeWarnings.slice(0, 12).join(', ')}${surgeWarnings.length > 12 ? ' 외' : ''}`,
    ),
  );

  const missingZeroViolations = s.records.filter(
    (record) =>
      (record.multiculturalStudentCount === null &&
        !record.notes.some((note) => note.includes('원자료 결측'))) ||
      (record.multiculturalStudentCount === 0 &&
        record.notes.some((note) => note.includes('원자료 결측'))),
  );
  results.push(
    result(
      'X9',
      '결측과 0 구분 유지',
      'block',
      missingZeroViolations.length === 0,
      missingZeroViolations.length === 0
        ? '원자료 결측 표식과 0값이 구분됩니다.'
        : `구분 위반 ${missingZeroViolations.length}건`,
    ),
  );

  const tableIds = sourceTableIds(source.raw, source.entries);
  const missingTableIds = EXPECTED_SOURCE_TABLE_IDS.filter(
    (tableId) => !tableIds.includes(tableId),
  );
  results.push(
    result(
      'X10',
      '통계표 ID 누락 금지',
      'block',
      missingTableIds.length === 0,
      missingTableIds.length === 0
        ? `필수 통계표 ${EXPECTED_SOURCE_TABLE_IDS.length}개의 ID가 있습니다.`
        : `누락된 통계표 ID: ${missingTableIds.join(', ')}`,
    ),
  );

  // 조회일은 출처 '항목마다' 있어야 한다 (data-dictionary-draft.md §6 SourceRef.retrievedAt).
  // 파일 최상위 retrievedAt 은 메타데이터 파일 자체의 생성 시각이므로 항목별 계보를 대신하지 못한다.
  //   이전 구현은 `최상위가 있음 || 항목마다 있음` 이었는데, 최상위는 항상 존재하므로
  //   OR 이 단락되어 항목별 검사가 실행되지 않았다 — 출처 하나의 조회일이 사라져도 통과했다.
  const everyEntryHasRetrievedAt =
    source.entries.length > 0 &&
    source.entries.every(
      (entry) => typeof entry.retrievedAt === 'string' && entry.retrievedAt.length > 0,
    );
  const hasRetrievedAt =
    typeof s.retrievedAt === 'string' && s.retrievedAt.length > 0 && everyEntryHasRetrievedAt;
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

  return {
    passed: results.every((validation) => validation.severity !== 'block' || validation.passed),
    results,
  };
}

export { validateForeignSnapshot } from './foreign';
