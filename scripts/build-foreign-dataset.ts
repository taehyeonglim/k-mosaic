import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { codeFromOfficial, REGION_BY_CODE, REGION_ORDER } from '../src/lib/constants/regions.js';
import { redact, type KosisCell } from '../src/lib/mcp/index.js';
import {
  foreignNationwideStatSchema,
  parseForeignSnapshot,
  type ForeignNationwideStat,
  type ForeignSnapshot,
  type ForeignStudentStat,
} from '../src/lib/schema/foreign-student.js';
import { SourceMetaSchema, type SourceMeta } from '../src/lib/schema/source.js';
import { validateForeignSnapshot } from '../src/lib/validation/foreign.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = resolve(ROOT, 'data/raw');
const SNAPSHOT_DIR = resolve(ROOT, 'data/snapshots');
const METADATA_DIR = resolve(ROOT, 'data/metadata');
const KOSIS_TABLE_ID = 'DT_1963003_010_S';
const ENARA_STATISTICS_CODE = '153401';
const ENARA_INDEX_CODE = '1534';
const REGIONAL_YEARS = [2022, 2023, 2024, 2025] as const;
const NATIONWIDE_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025] as const;
const KOSIS_METRICS = {
  enrolledStudentCount: '재적 학생수',
  foreignStudentCount: '외국인 학생수(학위과정)',
} as const;
const FOREIGN_SOURCE_NOTE = '원자료 결측(-) — 0명이 아님';

interface KosisRaw {
  schemaVersion: number;
  retrievedAt: string;
  orgId: string;
  tblId: string;
  tableName: string;
  objLevels: number;
  startYear: number;
  endYear: number;
  cells: KosisCell[];
}

interface EnaraRaw {
  schemaVersion: number;
  retrievedAt: string;
  sttsCd: string;
  idxCd: string;
  years: number[];
  rows: ForeignNationwideStat[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJson(path: string): unknown {
  if (!existsSync(path))
    throw new Error(redact(`필수 원자료가 없습니다: ${path.replace(ROOT, '')}`));
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`JSON 원자료를 읽을 수 없습니다: ${message}`));
  }
}

function readKosisRaw(): KosisRaw {
  const raw = readJson(resolve(RAW_DIR, `kosis-${KOSIS_TABLE_ID}.json`));
  if (
    !isRecord(raw) ||
    raw.tblId !== KOSIS_TABLE_ID ||
    raw.orgId !== '334' ||
    raw.objLevels !== 2 ||
    typeof raw.retrievedAt !== 'string' ||
    !Array.isArray(raw.cells)
  ) {
    throw new Error(redact('KOSIS 외국인 학생 원자료 구조가 올바르지 않습니다.'));
  }
  return {
    schemaVersion: Number(raw.schemaVersion),
    retrievedAt: raw.retrievedAt,
    orgId: raw.orgId,
    tblId: raw.tblId,
    tableName: String(raw.tableName ?? ''),
    objLevels: raw.objLevels,
    startYear: Number(raw.startYear),
    endYear: Number(raw.endYear),
    cells: raw.cells.filter(isRecord) as KosisCell[],
  };
}

function readEnaraRaw(): EnaraRaw {
  const raw = readJson(resolve(RAW_DIR, `enara-${ENARA_STATISTICS_CODE}.json`));
  if (
    !isRecord(raw) ||
    raw.sttsCd !== ENARA_STATISTICS_CODE ||
    raw.idxCd !== ENARA_INDEX_CODE ||
    typeof raw.retrievedAt !== 'string' ||
    !Array.isArray(raw.years) ||
    !Array.isArray(raw.rows)
  ) {
    throw new Error(redact('e-나라지표 외국인 학생 원자료 구조가 올바르지 않습니다.'));
  }
  const years = raw.years.map(Number);
  if (
    years.length !== NATIONWIDE_YEARS.length ||
    years.some((year, index) => year !== NATIONWIDE_YEARS[index])
  ) {
    throw new Error(redact('e-나라지표 외국인 학생 원자료의 연도 구조가 2018~2025와 다릅니다.'));
  }
  const rows = raw.rows.map((row, index) => {
    const parsed = foreignNationwideStatSchema.safeParse(row);
    if (!parsed.success)
      throw new Error(redact(`e-나라지표 외국인 학생 원자료 행 ${index}가 올바르지 않습니다.`));
    return parsed.data;
  });
  if (
    rows.length !== NATIONWIDE_YEARS.length ||
    new Set(rows.map((row) => row.year)).size !== rows.length
  ) {
    throw new Error(redact('e-나라지표 외국인 학생 원자료의 연도 행이 중복되거나 누락되었습니다.'));
  }
  return {
    schemaVersion: Number(raw.schemaVersion),
    retrievedAt: raw.retrievedAt,
    sttsCd: raw.sttsCd,
    idxCd: raw.idxCd,
    years,
    rows,
  };
}

function parseSourceNumber(value: unknown, label: string): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === '' || text === '-' || text === 'X' || text === '…') return null;
  if (!/^\d[\d,]*(?:\.\d+)?$/.test(text)) {
    throw new Error(redact(`KOSIS 숫자 원자료를 해석할 수 없습니다: ${label}`));
  }
  const parsed = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(parsed)) throw new Error(redact(`KOSIS 유한한 숫자가 아닙니다: ${label}`));
  return parsed;
}

function extractKosisMetrics(raw: KosisRaw): {
  enrolledStudentCount: Map<string, number | null>;
  foreignStudentCount: Map<string, number | null>;
} {
  const maps = {
    enrolledStudentCount: new Map<string, number | null>(),
    foreignStudentCount: new Map<string, number | null>(),
  };
  for (const [index, cell] of raw.cells.entries()) {
    const metric = (Object.entries(KOSIS_METRICS).find(([, label]) => cell.C2_NM === label)?.[0] ??
      null) as keyof typeof KOSIS_METRICS | null;
    if (metric === null) continue;
    if (cell.C3_NM === '남자' || cell.C3_NM === '여자') continue;
    if (cell.UNIT_NM !== '명') continue;
    const period = Number(cell.PRD_DE);
    if (!REGIONAL_YEARS.includes(period as (typeof REGIONAL_YEARS)[number])) {
      throw new Error(
        redact(`KOSIS ${KOSIS_TABLE_ID}의 연도가 범위를 벗어났습니다: ${cell.PRD_DE}`),
      );
    }
    const regionName = cell.C1_NM;
    if (typeof regionName !== 'string' || regionName.length === 0)
      throw new Error(redact(`KOSIS ${KOSIS_TABLE_ID} 셀 ${index}의 지역명이 없습니다.`));
    const regionCode = regionName === '총계' ? 'KR' : codeFromOfficial(regionName);
    if (regionCode === null)
      throw new Error(redact(`KOSIS ${KOSIS_TABLE_ID}에 미등록 지역명이 있습니다: ${regionName}`));
    const key = `${period}|${regionCode}`;
    const target = maps[metric];
    if (target.has(key))
      throw new Error(redact(`KOSIS ${KOSIS_TABLE_ID} ${metric} 복합키가 중복됩니다: ${key}`));
    target.set(key, parseSourceNumber(cell.DT, `KOSIS ${KOSIS_TABLE_ID} ${key}/${metric}`));
  }
  for (const metric of Object.keys(maps) as (keyof typeof maps)[]) {
    if (maps[metric].size === 0)
      throw new Error(
        redact(`KOSIS ${KOSIS_TABLE_ID}에서 ${KOSIS_METRICS[metric]}(명) 셀을 찾지 못했습니다.`),
      );
  }
  return maps;
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function makeRegionalRecords(raw: KosisRaw): ForeignStudentStat[] {
  const metrics = extractKosisMetrics(raw);
  const codes = ['KR', ...REGION_ORDER] as const;
  const records: ForeignStudentStat[] = [];
  for (const year of REGIONAL_YEARS) {
    for (const regionCode of codes) {
      const key = `${year}|${regionCode}`;
      const foreignStudentCount = metrics.foreignStudentCount.get(key) ?? null;
      const enrolledStudentCount = metrics.enrolledStudentCount.get(key) ?? null;
      const notes: string[] = [];
      if (foreignStudentCount === null || enrolledStudentCount === null)
        notes.push(FOREIGN_SOURCE_NOTE);
      const foreignStudentRateComputed =
        foreignStudentCount !== null && enrolledStudentCount !== null && enrolledStudentCount > 0
          ? round4((foreignStudentCount / enrolledStudentCount) * 100)
          : null;
      records.push({
        year,
        regionCode,
        regionNameKo:
          regionCode === 'KR'
            ? '전국'
            : REGION_BY_CODE[regionCode as (typeof REGION_ORDER)[number]]!.officialKo,
        regionNameEn:
          regionCode === 'KR'
            ? 'Korea (nationwide)'
            : REGION_BY_CODE[regionCode as (typeof REGION_ORDER)[number]]!.en,
        foreignStudentCount,
        enrolledStudentCount,
        foreignStudentRateComputed,
        notes,
      });
    }
  }
  return records;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function makeForeignCsv(snapshot: ForeignSnapshot): string {
  const comments = [
    '# 출처: KOSIS DT_1963003_010_S + e-나라지표 stts_cd=153401, idx_cd=1534',
    `# 기준연도: ${snapshot.coverage.years.join(', ')}`,
    `# 계산식: ${snapshot.rateFormula}`,
  ];
  const headers = [
    'dataset',
    'year',
    'regionCode',
    'regionNameKo',
    'regionNameEn',
    'scope',
    'foreignStudentCount',
    'enrolledStudentCount',
    'foreignStudentRateComputed',
    'degreeAndTraining',
    'degreeOnly',
    'notes',
  ];
  const regionalRows = snapshot.records.map((record) =>
    [
      'regional',
      record.year,
      record.regionCode,
      record.regionNameKo,
      record.regionNameEn,
      null,
      record.foreignStudentCount,
      record.enrolledStudentCount,
      record.foreignStudentRateComputed,
      null,
      null,
      record.notes.join(' | '),
    ]
      .map(csvCell)
      .join(','),
  );
  const nationwideRows = snapshot.nationwide.map((record) =>
    [
      'nationwide',
      record.year,
      null,
      null,
      null,
      record.scope,
      null,
      null,
      null,
      record.degreeAndTraining,
      record.degreeOnly,
      null,
    ]
      .map(csvCell)
      .join(','),
  );
  return `\uFEFF${[
    ...comments,
    headers.map(csvCell).join(','),
    ...regionalRows,
    ...nationwideRows,
  ].join('\r\n')}\r\n`;
}

function readExistingSourceEntries(): SourceMeta[] {
  if (!existsSync(resolve(METADATA_DIR, 'sources.v1.json'))) return [];
  const raw = readJson(resolve(METADATA_DIR, 'sources.v1.json'));
  const entries = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.sources)
      ? raw.sources
      : [];
  return entries.map((entry, index) => {
    const parsed = SourceMetaSchema.safeParse(entry);
    if (!parsed.success)
      throw new Error(redact(`기존 출처 메타데이터 ${index}건이 올바르지 않습니다.`));
    return parsed.data;
  });
}

function latestKosisChangedAt(raw: KosisRaw): string | null {
  return (
    raw.cells
      .map((cell) => cell.LST_CHN_DE)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .sort()
      .at(-1) ?? null
  );
}

function makeSourceMetadata(
  kosis: KosisRaw,
  enara: EnaraRaw,
  snapshot: ForeignSnapshot,
): SourceMeta[] {
  const referenceDate = `${Math.max(...snapshot.coverage.years)}-04-01`;
  const newEntries: SourceMeta[] = [
    {
      role: 'denominator',
      provider: 'KOSIS 국가통계포털 OpenAPI',
      organization: '한국교육개발원',
      statisticsName: '교육기본통계',
      tableId: KOSIS_TABLE_ID,
      tableName: '고등교육기관 개황 (하반기)',
      accessMethod: 'openapi',
      sourceUrl: 'https://kosis.kr/openapi/Param/statisticsParameterData.do',
      retrievedAt: kosis.retrievedAt,
      lastChangedAt: latestKosisChangedAt(kosis),
      referenceDate,
      isProvisional: null,
    },
    {
      role: 'numerator',
      provider: 'e-나라지표 (국가지표체계)',
      organization: '교육부·한국교육개발원',
      statisticsName: '유학생 현황',
      tableId: ENARA_STATISTICS_CODE,
      tableName: '유학생 현황 (대학(학위+연수)·대학(학위))',
      accessMethod: 'html-parse',
      sourceUrl:
        'https://www.index.go.kr/unity/potal/eNara/sub/showStblGams3.do?stts_cd=153401&idx_cd=1534&freq=Y&period=N',
      retrievedAt: enara.retrievedAt,
      lastChangedAt: null,
      referenceDate,
      isProvisional: null,
    },
  ];
  const newById = new Map(newEntries.map((entry) => [entry.tableId, entry]));
  const merged = readExistingSourceEntries().map((entry) => newById.get(entry.tableId) ?? entry);
  for (const entry of newEntries) {
    if (!merged.some((candidate) => candidate.tableId === entry.tableId)) merged.push(entry);
  }
  for (const entry of merged) {
    const parsed = SourceMetaSchema.safeParse(entry);
    if (!parsed.success) throw new Error(redact(`출처 메타데이터 검증 실패: ${entry.tableId}`));
  }
  return merged;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${redact(JSON.stringify(value, null, 2))}\n`, 'utf8');
}

export function runBuildForeignDataset(): ForeignSnapshot {
  const kosis = readKosisRaw();
  const enara = readEnaraRaw();
  const records = makeRegionalRecords(kosis);
  const snapshot = parseForeignSnapshot({
    schemaVersion: 1,
    retrievedAt: [kosis.retrievedAt, enara.retrievedAt].sort().at(-1),
    coverage: {
      years: [...REGIONAL_YEARS],
      nationwideYears: [...NATIONWIDE_YEARS],
      regionCount: REGION_ORDER.length,
    },
    rateFormula: 'foreignStudentRateComputed = foreignStudentCount / enrolledStudentCount * 100',
    records,
    nationwide: enara.rows,
  });
  const sourceMeta = makeSourceMetadata(kosis, enara, snapshot);

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  mkdirSync(METADATA_DIR, { recursive: true });
  writeJson(resolve(METADATA_DIR, 'sources.v1.json'), {
    schemaVersion: 1,
    retrievedAt: snapshot.retrievedAt,
    sources: sourceMeta,
  });

  const report = validateForeignSnapshot(snapshot);
  for (const validation of report.results) {
    if (!validation.passed)
      console.warn(redact(`[${validation.severity}] ${validation.id}: ${validation.detail}`));
  }
  if (!report.passed)
    throw new Error(redact('외국인 학생 차단 수준 검증 실패로 공개 스냅숏을 갱신하지 않습니다.'));

  writeJson(resolve(SNAPSHOT_DIR, 'foreign-students.v1.json'), snapshot);
  writeFileSync(
    resolve(SNAPSHOT_DIR, 'foreign-students.v1.csv'),
    redact(makeForeignCsv(snapshot)),
    'utf8',
  );
  console.log(
    redact(
      `외국인 학생 공개 데이터셋 생성: ${snapshot.records.length}개 시도별 레코드, ${snapshot.nationwide.length}개 전국 레코드`,
    ),
  );
  return snapshot;
}

async function main(): Promise<void> {
  runBuildForeignDataset();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`data:build-foreign 단계 실패: ${message}`));
    process.exitCode = 1;
  });
}
