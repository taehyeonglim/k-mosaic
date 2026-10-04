import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MULTICULTURAL_TABLE_IDS } from '../constants/sources';
import { integerRoundedYears } from '../data/years';
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

/**
 * 검증 입력 주입. 생략한 항목은 커밋된 파일(data/metadata, data/snapshots)에서 읽는다.
 *
 * - sourceEntries: 기록 예정인 출처 메타데이터. build 스크립트는 메타데이터를 디스크에
 *   쓰기 전에 이 값으로 검증해야 한다 — 쓰고 나서 검증하면 실패해도 오염된 메타가 남는다.
 * - previousSnapshot: 비교 기준이 되는 이전 검증 스냅숏(원시 JSON). PR 검사는 base 브랜치의
 *   스냅숏을 넘겨 커버리지 축소(V8)를 실제로 잡는다. null 이면 비교를 건너뛴다.
 */
export interface ValidationContext {
  sourceEntries?: readonly Record<string, unknown>[];
  previousSnapshot?: unknown;
}

const SCHOOL_LEVELS = ['elementary', 'middle', 'high', 'other'] as const;
const EXPECTED_SOURCE_TABLE_IDS = MULTICULTURAL_TABLE_IDS;
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

function sourceMetadata(injected?: readonly Record<string, unknown>[]): {
  raw: unknown;
  entries: Record<string, unknown>[];
  retrievedAt: string | null;
} {
  if (injected !== undefined) {
    const entries = injected.filter(isRecord);
    return { raw: { sources: entries }, entries, retrievedAt: null };
  }
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

function committedSnapshot(): unknown {
  const path = resolve(process.cwd(), 'data/snapshots/multicultural-students.v1.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    return null;
  }
}

function previousCoverageYears(
  previous: unknown,
  key: 'years' | 'nationwideYears' = 'years',
): number[] | null {
  if (!isRecord(previous) || !isRecord(previous.coverage)) return null;
  const list = previous.coverage[key];
  return Array.isArray(list) ? list.map(Number).filter(Number.isInteger) : null;
}

function previousSnapshotWithoutRetrievedAt(previous: unknown): string | null {
  if (!isRecord(previous)) return null;
  const copy = { ...previous };
  delete copy.retrievedAt;
  return JSON.stringify(copy);
}

function rounded4(value: number): number {
  return Number(value.toFixed(4));
}

function uniqueKey(record: MulticulturalStudentStat): string {
  return `${record.year}|${record.regionCode}|${record.schoolLevel}|${record.studentType}`;
}

export function validateSnapshot(s: Snapshot, context: ValidationContext = {}): ValidationReport {
  const years = allYears(s);
  const levels = allLevels(s);
  const source = sourceMetadata(context.sourceEntries);
  const previous =
    context.previousSnapshot === undefined ? committedSnapshot() : context.previousSnapshot;
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

  // 공표 비율이 정수로 반올림된 연도(2025년 등)는 대조할 수 없으므로 제외한다.
  // 연도를 리터럴로 두면 2026년 이후 공표치가 대조에서 조용히 빠진다 — 자료 모양으로 판별한다.
  const roundedYears = integerRoundedYears(
    s.records.map((record) => ({
      year: record.year,
      published: record.multiculturalStudentRatePublished,
    })),
  );
  const rateMismatches: string[] = [];
  let rateComparisons = 0;
  for (const record of s.records) {
    if (
      !roundedYears.includes(record.year) &&
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
        ? `비교 ${rateComparisons}건이 모두 ±0.1%p 이내입니다${roundedYears.length > 0 ? ` (정수 반올림 공표 연도 ${roundedYears.join(', ')} 제외)` : ''}.`
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

  const previousSnapshot = previousSnapshotWithoutRetrievedAt(previous);
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

  const previousYears = previousCoverageYears(previous);
  const lostYears = [
    ...(previousYears ?? []).filter((year) => !years.includes(year)),
    ...(previousCoverageYears(previous, 'nationwideYears') ?? [])
      .filter((year) => !s.coverage.nationwideYears.includes(year))
      .map((year) => `전국 장기 ${year}`),
  ];
  const coverageNotReduced = lostYears.length === 0;
  results.push(
    result(
      'V8',
      '연도 커버리지 유지',
      // 공개 데이터의 연도가 줄면 차단한다. 업스트림 창이 밀린 경우는 normalize 단계가
      // 이전 스냅숏에서 과거 연도를 보존하므로, 여기서 축소가 보이면 이상 신호다.
      'block',
      coverageNotReduced,
      previousYears === null
        ? '이전 스냅숏이 없어 커버리지 비교를 건너뛰었습니다.'
        : coverageNotReduced
          ? '이전 스냅숏의 모든 연도(시도별·전국 장기)가 유지됩니다.'
          : `이전 스냅숏 대비 누락된 연도: ${lostYears.join(', ')}`,
    ),
  );

  // e-나라지표(분자)가 KOSIS(분모)보다 먼저 새 연도를 반영하면, 그 연도는 비율이 전부
  // 결측인 채로 다른 규칙을 모두 통과한다. 수록 연도마다 전국 분모가 있어야 공개한다.
  const nationalAll = (rows: readonly MulticulturalStudentStat[], year: number) =>
    rows.find(
      (record) =>
        record.year === year && record.regionCode === 'KR' && record.schoolLevel === 'all',
    );
  const yearsWithoutDenominator = [
    ...years.filter((year) => nationalAll(s.records, year)?.totalStudentCount == null),
    ...s.coverage.nationwideYears
      .filter((year) => nationalAll(s.nationwide, year)?.totalStudentCount == null)
      .map((year) => `전국 장기 ${year}`),
  ];
  results.push(
    result(
      'V9',
      '분모 연도 누락 금지',
      'block',
      yearsWithoutDenominator.length === 0,
      yearsWithoutDenominator.length === 0
        ? '모든 수록 연도에 전국 분모(전체 학생 수)가 있습니다.'
        : `분모가 없는 연도: ${yearsWithoutDenominator.join(', ')} — KOSIS 반영 후 다시 갱신하세요.`,
    ),
  );

  // 전국 학교급별 장기 시계열(F008402) — 계산 비율을 공표 비율(F008401)과 대조한다.
  // 시도별 V4 와 같은 기준이며, 2020년 이전 구간에서 모수 정의(초+중+고+각종)를 다시 검증한다.
  const nationwideRounded = integerRoundedYears(
    s.nationwide.map((record) => ({
      year: record.year,
      published: record.multiculturalStudentRatePublished,
    })),
  );
  const nationwideCompared = s.nationwide.filter(
    (record) =>
      !nationwideRounded.includes(record.year) &&
      record.multiculturalStudentRateComputed !== null &&
      record.multiculturalStudentRatePublished !== null,
  );
  const gap = (record: MulticulturalStudentStat) =>
    Math.abs(
      (record.multiculturalStudentRateComputed ?? 0) -
        (record.multiculturalStudentRatePublished ?? 0),
    );
  const nationwideMismatches = nationwideCompared.filter((record) => gap(record) > 0.1);
  const within005 = nationwideCompared.filter((record) => gap(record) <= 0.05).length;
  results.push(
    result(
      'V10',
      '전국 장기 시계열 계산 비율과 공표 비율',
      'block',
      s.nationwide.length === 0 ||
        (nationwideCompared.length > 0 && nationwideMismatches.length === 0),
      s.nationwide.length === 0
        ? '전국 장기 시계열이 없습니다.'
        : nationwideMismatches.length === 0
          ? `비교 ${nationwideCompared.length}건이 모두 ±0.1%p 이내입니다 (±0.05%p 이내 ${((within005 / Math.max(1, nationwideCompared.length)) * 100).toFixed(1)}%).`
          : nationwideMismatches
              .map(
                (record) =>
                  `${record.year}/${record.schoolLevel}: ${record.multiculturalStudentRateComputed} vs ${record.multiculturalStudentRatePublished}`,
              )
              .join(', '),
    ),
  );

  // 시도별 스냅숏의 전국 레코드와 겹치는 연도는 값이 같아야 한다 — 두 출처(F008403·F008402)가
  // 어긋나면 같은 화면의 개요와 추세가 서로 다른 숫자를 보여 준다.
  const overlapMismatches = s.nationwide.flatMap((record) => {
    if (record.regionCode !== 'KR')
      return [`${record.year}/${record.schoolLevel}: 전국 레코드가 아님`];
    const regional = s.records.find(
      (candidate) =>
        candidate.year === record.year &&
        candidate.regionCode === 'KR' &&
        candidate.schoolLevel === record.schoolLevel,
    );
    if (regional === undefined) return [];
    return regional.multiculturalStudentCount === record.multiculturalStudentCount &&
      regional.totalStudentCount === record.totalStudentCount &&
      regional.multiculturalStudentRateComputed === record.multiculturalStudentRateComputed
      ? []
      : [`${record.year}/${record.schoolLevel}`];
  });
  results.push(
    result(
      'V11',
      '전국 장기 시계열과 시도별 전국 값 일치',
      'block',
      overlapMismatches.length === 0,
      overlapMismatches.length === 0
        ? '겹치는 연도의 전국 값이 모두 같습니다.'
        : `불일치: ${overlapMismatches.join(', ')}`,
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
