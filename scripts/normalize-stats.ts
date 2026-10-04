import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { codeFromOfficial, REGION_BY_CODE, REGIONS } from '../src/lib/constants/regions.js';
import {
  parseSnapshot,
  regionScopeSchema,
  schoolLevelSchema,
  type MulticulturalStudentStat,
  type RegionScope,
  type SchoolLevel,
  type Snapshot,
} from '../src/lib/schema/index.js';
import {
  assertContiguousYears,
  integerRoundedYears,
  retainHistoricalYears,
} from '../src/lib/data/years.js';
import { redact, type EnaraRow, type KosisCell } from '../src/lib/mcp/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = resolve(ROOT, 'data/raw');
const NORMALIZED_DIR = resolve(ROOT, 'data/normalized');
const ENARA_FILE = resolve(RAW_DIR, 'enara-F008403.json');
const SNAPSHOT_PATH = resolve(ROOT, 'data/snapshots/multicultural-students.v1.json');
const LEVELS: SchoolLevel[] = ['all', 'elementary', 'middle', 'high', 'other'];
const DENOMINATOR_LEVELS = {
  elementary: 'DT_1963003_002',
  middle: 'DT_1963003_003',
  high: 'DT_1963003_004',
  other: 'DT_1963003_009',
} as const;

type DenominatorValue = { value: number | null; lastChangedAt: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJson(path: string): unknown {
  if (!existsSync(path))
    throw new Error(redact(`필수 원자료가 없습니다: ${path.replace(ROOT, '')}`));
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`JSON 원자료를 읽을 수 없습니다: ${message}`));
  }
}

function parseSourceNumber(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === '' || text === '-' || text === 'X' || text === '…') return null;
  if (!/^-?(?:\d[\d,]*)(?:\.\d+)?$/.test(text)) {
    throw new Error(redact(`숫자 원자료를 해석할 수 없습니다: ${label}`));
  }
  const parsed = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(parsed)) throw new Error(redact(`유한한 숫자가 아닙니다: ${label}`));
  return parsed;
}

function readEnara(): { retrievedAt: string; years: number[]; rows: EnaraRow[] } {
  const raw = readJson(ENARA_FILE);
  if (!isRecord(raw)) throw new Error(redact('e-나라지표 원자료가 객체가 아닙니다.'));
  const table = isRecord(raw.table) ? raw.table : raw;
  if (!Array.isArray(table.years) || !Array.isArray(table.rows)) {
    throw new Error(redact('e-나라지표 원자료에 years 또는 rows가 없습니다.'));
  }
  const years = table.years.map((year) => Number(year));
  if (years.length === 0 || years.some((year) => !Number.isInteger(year))) {
    throw new Error(redact('e-나라지표 연도 배열이 올바르지 않습니다.'));
  }
  const rows: EnaraRow[] = table.rows.map((value, index) => {
    if (!isRecord(value)) throw new Error(redact(`e-나라지표 행 ${index}가 객체가 아닙니다.`));
    const levelResult = schoolLevelSchema.safeParse(value.schoolLevel);
    const scopeResult = regionScopeSchema.safeParse(value.regionCode);
    if (!levelResult.success || !scopeResult.success) {
      throw new Error(redact(`e-나라지표 행 ${index}의 지역 또는 학교급이 올바르지 않습니다.`));
    }
    if (value.metric !== 'count' && value.metric !== 'rate') {
      throw new Error(redact(`e-나라지표 행 ${index}의 지표가 올바르지 않습니다.`));
    }
    const year = Number(value.year);
    if (!Number.isInteger(year))
      throw new Error(redact(`e-나라지표 행 ${index}의 연도가 올바르지 않습니다.`));
    return {
      year,
      regionCode: scopeResult.data,
      regionShort: String(value.regionShort ?? ''),
      schoolLevel: levelResult.data,
      metric: value.metric,
      value: parseSourceNumber(value.value, `e-나라지표 행 ${index}`),
    };
  });
  const retrievedAt = String(raw.retrievedAt ?? '');
  if (!retrievedAt) throw new Error(redact('e-나라지표 원자료의 조회일이 없습니다.'));
  return { retrievedAt, years, rows };
}

function readKosisCells(tblId: string): KosisCell[] {
  const raw = readJson(resolve(RAW_DIR, `kosis-${tblId}.json`));
  if (Array.isArray(raw)) return raw.filter(isRecord) as KosisCell[];
  if (!isRecord(raw) || !Array.isArray(raw.cells)) {
    throw new Error(redact(`KOSIS 원자료에 셀 목록이 없습니다: ${tblId}`));
  }
  return raw.cells.filter(isRecord) as KosisCell[];
}

function extractDenominator(tblId: string): Map<string, DenominatorValue> {
  const byYearRegion = new Map<string, DenominatorValue>();
  for (const [index, cell] of readKosisCells(tblId).entries()) {
    const labels = [cell.C1_NM, cell.C2_NM, cell.C3_NM].filter(
      (label): label is string => typeof label === 'string' && label.length > 0,
    );
    if (!labels.includes('학생수') || cell.UNIT_NM !== '명') continue;

    const establishment = labels.find((label) => ['계', '국립', '공립', '사립'].includes(label));
    if (establishment !== undefined && establishment !== '계') continue;

    const period = cell.PRD_DE;
    const regionName = cell.C1_NM;
    if (!period || !regionName)
      throw new Error(redact(`KOSIS ${tblId} 셀 ${index}의 연도/지역이 없습니다.`));
    const regionCode: RegionScope | null =
      regionName === '총계' ? 'KR' : codeFromOfficial(regionName);
    if (regionCode === null)
      throw new Error(redact(`KOSIS ${tblId}에 미등록 지역명이 있습니다: ${regionName}`));
    const key = `${period}|${regionCode}`;
    if (byYearRegion.has(key))
      throw new Error(redact(`KOSIS ${tblId}에 분모 복합키가 중복됩니다: ${key}`));
    byYearRegion.set(key, {
      value: parseSourceNumber(cell.DT, `KOSIS ${tblId} ${key}`),
      lastChangedAt: cell.LST_CHN_DE ? String(cell.LST_CHN_DE) : null,
    });
  }
  if (byYearRegion.size === 0)
    throw new Error(redact(`KOSIS ${tblId}에서 학생수(명) 셀을 찾지 못했습니다.`));
  return byYearRegion;
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function makeSourceMaps(rows: EnaraRow[]): {
  count: Map<string, number | null>;
  rate: Map<string, number | null>;
} {
  const count = new Map<string, number | null>();
  const rate = new Map<string, number | null>();
  for (const row of rows) {
    const key = `${row.year}|${row.regionCode}|${row.schoolLevel}`;
    const target = row.metric === 'count' ? count : rate;
    if (target.has(key)) throw new Error(redact(`e-나라지표 원자료 복합키가 중복됩니다: ${key}`));
    target.set(key, row.value);
  }
  return { count, rate };
}

function sumDenominators(
  year: number,
  regionCode: RegionScope,
  parts: readonly (keyof typeof DENOMINATOR_LEVELS)[],
  denominatorMaps: Readonly<Record<keyof typeof DENOMINATOR_LEVELS, Map<string, DenominatorValue>>>,
): { value: number | null; incomplete: boolean } {
  const values = parts.map((part) => denominatorMaps[part].get(`${year}|${regionCode}`)?.value);
  if (values.some((value) => value === undefined || value === null))
    return { value: null, incomplete: true };
  const presentValues = values.filter(
    (value): value is number => value !== undefined && value !== null,
  );
  return { value: presentValues.reduce((sum, value) => sum + value, 0), incomplete: false };
}

function normalize(
  retrievedAt: string,
  years: number[],
  numeratorRows: EnaraRow[],
  denominatorMaps: Readonly<Record<keyof typeof DENOMINATOR_LEVELS, Map<string, DenominatorValue>>>,
): Snapshot {
  const { count: countMap, rate: rateMap } = makeSourceMaps(numeratorRows);
  // 공표 비율이 모두 정수(x.0)인 연도 — 연도를 리터럴로 지정하지 않고 자료 모양으로 판별한다.
  const roundedYears = new Set(
    integerRoundedYears(
      [...rateMap.entries()].map(([key, published]) => ({
        year: Number(key.split('|')[0]),
        published,
      })),
    ),
  );
  const codes: RegionScope[] = ['KR', ...REGIONS.map((region) => region.code)];
  const records: MulticulturalStudentStat[] = [];
  for (const year of years) {
    for (const regionCode of codes) {
      for (const schoolLevel of LEVELS) {
        const sourceKey = `${year}|${regionCode}|${schoolLevel}`;
        const count = countMap.get(sourceKey) ?? null;
        const publishedRate = rateMap.get(sourceKey) ?? null;
        const parts = schoolLevel === 'all' ? Object.keys(DENOMINATOR_LEVELS) : [schoolLevel];
        const validParts = parts.filter(
          (part): part is keyof typeof DENOMINATOR_LEVELS => part in DENOMINATOR_LEVELS,
        );
        const denominator = sumDenominators(year, regionCode, validParts, denominatorMaps);
        const notes: string[] = [];
        if (denominator.incomplete) notes.push('분모 일부 학교급 결측 — 비율 계산 불가');
        if (count === null) notes.push('원자료 결측(-) — 0명이 아님');
        if (roundedYears.has(year) && publishedRate !== null) {
          notes.push('공표 비율이 정수 반올림됨 — 표시에는 계산값을 사용');
        }
        const computedRate =
          count !== null && denominator.value !== null && denominator.value > 0
            ? round4((count / denominator.value) * 100)
            : null;
        records.push({
          year,
          regionCode,
          regionNameKo: regionCode === 'KR' ? '전국' : REGION_BY_CODE[regionCode].officialKo,
          regionNameEn: regionCode === 'KR' ? 'Korea (nationwide)' : REGION_BY_CODE[regionCode].en,
          schoolLevel,
          studentType: 'total',
          multiculturalStudentCount: count,
          totalStudentCount: denominator.value,
          multiculturalStudentRateComputed: computedRate,
          multiculturalStudentRatePublished: publishedRate,
          notes,
        });
      }
    }
  }
  return parseSnapshot({
    schemaVersion: 1,
    retrievedAt,
    coverage: {
      years,
      regionCount: REGIONS.length,
      schoolLevels: LEVELS,
      studentTypes: ['total'],
    },
    rateFormula:
      'multiculturalStudentRateComputed = multiculturalStudentCount / totalStudentCount * 100, ' +
      '분모 = 초등학교+중학교+고등학교+각종학교 학생수 (특수학교·유치원 제외)',
    records,
  });
}

export function runNormalizeStats(): Snapshot {
  const enara = readEnara();
  const denominatorMaps = {
    elementary: extractDenominator(DENOMINATOR_LEVELS.elementary),
    middle: extractDenominator(DENOMINATOR_LEVELS.middle),
    high: extractDenominator(DENOMINATOR_LEVELS.high),
    other: extractDenominator(DENOMINATOR_LEVELS.other),
  } as const;
  let years: number[];
  try {
    years = assertContiguousYears(enara.years, 'e-나라지표 F008403');
  } catch (error) {
    throw new Error(redact(error instanceof Error ? error.message : String(error)));
  }
  const normalized = normalize(enara.retrievedAt, years, enara.rows, denominatorMaps);
  // e-나라지표 시도별 표는 최근 6개년만 제공한다. 새 연도가 추가되며 가장 오래된 연도가
  // 빠지면, 이전에 검증된 공개 스냅숏의 그 연도 레코드를 보존한다.
  const previous = existsSync(SNAPSHOT_PATH)
    ? parseSnapshot(JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')))
    : null;
  const { records, retainedYears } = retainHistoricalYears(
    normalized.records,
    previous?.records ?? [],
  );
  const snapshot =
    retainedYears.length === 0
      ? normalized
      : parseSnapshot({
          ...normalized,
          coverage: {
            ...normalized.coverage,
            years: [...new Set(records.map((record) => record.year))].sort((a, b) => a - b),
          },
          records,
        });
  if (retainedYears.length > 0)
    console.log(redact(`업스트림 제공 범위 밖 연도 보존: ${retainedYears.join(', ')}`));
  mkdirSync(NORMALIZED_DIR, { recursive: true });
  writeFileSync(
    resolve(NORMALIZED_DIR, 'multicultural-students.v1.json'),
    `${redact(JSON.stringify(snapshot, null, 2))}\n`,
    'utf8',
  );
  console.log(redact(`정규화 완료: ${snapshot.records.length}개 레코드`));
  return snapshot;
}

async function main(): Promise<void> {
  runNormalizeStats();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`data:normalize 단계 실패: ${message}`));
    process.exitCode = 1;
  });
}
