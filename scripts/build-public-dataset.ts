import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { redact } from './lib/redact.js';
import {
  parseSnapshot,
  SourceMetaSchema,
  type Snapshot,
  type SourceMeta,
} from '../src/lib/schema/index.js';
import { validateSnapshot } from '../src/lib/validation/index.js';
import {
  mergeSourceEntries,
  readSourceEntries,
  writeSourceMetadata,
} from './lib/source-metadata.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NORMALIZED_PATH = resolve(ROOT, 'data/normalized/multicultural-students.v1.json');
const SNAPSHOT_DIR = resolve(ROOT, 'data/snapshots');
const SNAPSHOT_PATH = resolve(SNAPSHOT_DIR, 'multicultural-students.v1.json');
const METADATA_DIR = resolve(ROOT, 'data/metadata');
const METADATA_PATH = resolve(METADATA_DIR, 'sources.v1.json');
const DENOMINATOR_SOURCES = [
  { tblId: 'DT_1963003_002', tableName: '초등학교 개황' },
  { tblId: 'DT_1963003_003', tableName: '중학교 개황' },
  { tblId: 'DT_1963003_004', tableName: '고등학교 개황' },
  { tblId: 'DT_1963003_009', tableName: '각종학교 개황' },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readJson(path: string): unknown {
  if (!existsSync(path)) throw new Error(redact(`필수 파일이 없습니다: ${path.replace(ROOT, '')}`));
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`JSON을 읽을 수 없습니다: ${message}`));
  }
}

function readNormalizedSnapshot(): Snapshot {
  const path = existsSync(NORMALIZED_PATH) ? NORMALIZED_PATH : SNAPSHOT_PATH;
  return parseSnapshot(readJson(path));
}

function rawRetrievedAt(path: string, fallback: string): string {
  if (!existsSync(path)) return fallback;
  const raw = readJson(path);
  return isRecord(raw) && typeof raw.retrievedAt === 'string' ? raw.retrievedAt : fallback;
}

function rawLastChangedAt(path: string): string | null {
  if (!existsSync(path)) return null;
  const raw = readJson(path);
  const cells = isRecord(raw) && Array.isArray(raw.cells) ? raw.cells : [];
  const dates = cells
    .filter(isRecord)
    .map((cell) => cell.LST_CHN_DE)
    .filter((date): date is string => typeof date === 'string' && date.length > 0)
    .sort();
  return dates.at(-1) ?? null;
}

function buildSourceMeta(snapshot: Snapshot): SourceMeta[] | null {
  const enaraPath = resolve(ROOT, 'data/raw/enara-F008403.json');
  const hasRawDenominators = DENOMINATOR_SOURCES.every((source) =>
    existsSync(resolve(ROOT, `data/raw/kosis-${source.tblId}.json`)),
  );
  if (!existsSync(enaraPath) || !hasRawDenominators) return null;

  // 교육기본통계의 조사 기준일은 매년 4월 1일이다.
  //   근거: 한국교육개발원 「2025년 교육기본통계 조사 결과 발표」 보도자료 — "2025. 4. 1." 기준
  //         (docs/data-audit.md §10.2)
  //   단, 학업중단율 등 일부 항목은 기준일이 다르다. K-MOSAIC 이 쓰는 학생 수·다문화학생 수는
  //   4월 1일 기준이다.
  // 연도마다 기준일이 다르므로 스냅숏의 최신 수록연도를 기준으로 산출한다.
  const latestYear = Math.max(...snapshot.coverage.years);
  const referenceDate = `${latestYear}-04-01`;

  // 잠정치/확정치 구분은 출처가 제공하지 않는다 (docs/data-audit.md §10.3).
  // 전수 행정조사라 잠정 단계가 없을 것으로 보이나 출처가 명시하지 않았으므로 단정하지 않고
  // null 을 유지한다. 화면에는 "미확인"으로 표시된다.
  const isProvisional = null;

  const numerator = {
    role: 'numerator' as const,
    provider: 'e-나라지표 (국가지표체계)',
    organization: '교육부·한국교육개발원',
    statisticsName: '교육기본통계',
    tableId: 'F008403',
    tableName: '시도별 다문화학생 수 및 다문화학생 비율',
    accessMethod: 'html-parse' as const,
    sourceUrl: 'https://www.index.go.kr/unify/idx-info.do?idxCd=F0084',
    retrievedAt: rawRetrievedAt(enaraPath, snapshot.retrievedAt),
    lastChangedAt: null,
    referenceDate,
    isProvisional,
  } satisfies SourceMeta;
  const denominator = DENOMINATOR_SOURCES.map(
    (source) =>
      ({
        role: 'denominator' as const,
        provider: 'KOSIS 국가통계포털 OpenAPI',
        organization: '한국교육개발원',
        statisticsName: '교육기본통계',
        tableId: source.tblId,
        tableName: source.tableName,
        accessMethod: 'openapi' as const,
        sourceUrl: 'https://kosis.kr/openapi/Param/statisticsParameterData.do',
        retrievedAt: rawRetrievedAt(
          resolve(ROOT, `data/raw/kosis-${source.tblId}.json`),
          snapshot.retrievedAt,
        ),
        lastChangedAt: rawLastChangedAt(resolve(ROOT, `data/raw/kosis-${source.tblId}.json`)),
        referenceDate,
        isProvisional,
      }) satisfies SourceMeta,
  );
  const metadata = [numerator, ...denominator];
  for (const entry of metadata) {
    const parsed = SourceMetaSchema.safeParse(entry);
    if (!parsed.success) throw new Error(redact(`출처 메타데이터 검증 실패: ${entry.tableId}`));
  }
  return metadata;
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function makeFullDatasetCsv(snapshot: Snapshot): string {
  const comments = [
    '# 출처: e-나라지표 F008403 + KOSIS DT_1963003_002·003·004·009',
    `# 기준연도: ${snapshot.coverage.years.join(', ')}`,
    `# 계산식: ${snapshot.rateFormula}`,
  ];
  const header = [
    'year',
    'regionCode',
    'regionNameKo',
    'regionNameEn',
    'schoolLevel',
    'studentType',
    'multiculturalStudentCount',
    'totalStudentCount',
    'multiculturalStudentRateComputed',
    'multiculturalStudentRatePublished',
    'notes',
  ];
  const lines = snapshot.records.map((record) =>
    [
      record.year,
      record.regionCode,
      record.regionNameKo,
      record.regionNameEn,
      record.schoolLevel,
      record.studentType,
      record.multiculturalStudentCount,
      record.totalStudentCount,
      record.multiculturalStudentRateComputed,
      record.multiculturalStudentRatePublished,
      record.notes.join(' | '),
    ]
      .map(csvValue)
      .join(','),
  );
  return `\uFEFF${[...comments, header.map(csvValue).join(','), ...lines].join('\r\n')}\r\n`;
}

export function runBuildPublicDataset(): Snapshot {
  const snapshot = readNormalizedSnapshot();
  // 원자료가 있으면 새 출처 항목을 기존 파일(외국인 유학생 출처 포함)과 병합하고,
  // 병합 결과로 검증한다. 메타데이터는 검증을 통과한 뒤에만 기록한다.
  const sourceMeta = buildSourceMeta(snapshot);
  const sourceEntries =
    sourceMeta === null
      ? undefined
      : mergeSourceEntries(readSourceEntries(METADATA_PATH), sourceMeta);
  const report = validateSnapshot(snapshot, { sourceEntries });
  for (const validation of report.results) {
    if (!validation.passed)
      console.warn(redact(`[${validation.severity}] ${validation.id}: ${validation.detail}`));
  }
  if (!report.passed)
    throw new Error(redact('차단 수준 검증 실패로 공개 스냅숏을 갱신하지 않습니다.'));

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  mkdirSync(METADATA_DIR, { recursive: true });
  writeFileSync(SNAPSHOT_PATH, `${redact(JSON.stringify(snapshot, null, 2))}\n`, 'utf8');
  writeFileSync(
    resolve(SNAPSHOT_DIR, 'multicultural-students.v1.csv'),
    redact(makeFullDatasetCsv(snapshot)),
    'utf8',
  );
  if (sourceEntries !== undefined) writeSourceMetadata(METADATA_PATH, sourceEntries);
  console.log(redact(`공개 데이터셋 생성: ${snapshot.records.length}개 레코드`));
  return snapshot;
}

async function main(): Promise<void> {
  runBuildPublicDataset();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`data:build 단계 실패: ${message}`));
    process.exitCode = 1;
  });
}
