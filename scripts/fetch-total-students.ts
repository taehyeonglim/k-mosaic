import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchKosisTable, type KosisCell } from './lib/kosis.js';
import { redact } from './lib/redact.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = resolve(ROOT, 'data/raw');
const DEFAULT_START_YEAR = 2020;
const DEFAULT_END_YEAR = 2025;

export const DENOMINATOR_TABLES = [
  { tblId: 'DT_1963003_002', objLevels: 3, tableName: '초등학교 개황' },
  { tblId: 'DT_1963003_003', objLevels: 3, tableName: '중학교 개황' },
  { tblId: 'DT_1963003_004', objLevels: 3, tableName: '고등학교 개황' },
  { tblId: 'DT_1963003_009', objLevels: 3, tableName: '각종학교 개황' },
] as const;

function loadLocalKosisEnvironment(): void {
  if (process.env.KOSIS_API_KEY) return;
  const envPath = resolve(ROOT, '.env.local');
  if (!existsSync(envPath)) return;
  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => /^\s*(?:export\s+)?KOSIS_API_KEY\s*=/.test(entry));
  if (!line) return;
  const match = line.match(/^\s*(?:export\s+)?KOSIS_API_KEY\s*=\s*(.*?)\s*$/);
  if (match?.[1]) process.env.KOSIS_API_KEY = match[1].replace(/^['"]|['"]$/g, '');
}

function readYearRange(): { startYear: number; endYear: number } {
  const enaraPath = resolve(RAW_DIR, 'enara-F008403.json');
  if (!existsSync(enaraPath)) return { startYear: DEFAULT_START_YEAR, endYear: DEFAULT_END_YEAR };
  try {
    const raw: unknown = JSON.parse(readFileSync(enaraPath, 'utf8'));
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      const years = (raw as { years?: unknown }).years;
      if (
        Array.isArray(years) &&
        years.length > 0 &&
        years.every((year) => Number.isInteger(year))
      ) {
        return {
          startYear: Math.min(...(years as number[])),
          endYear: Math.max(...(years as number[])),
        };
      }
    }
  } catch {
    // normalize 단계에서 원자료 구조를 다시 검증한다. 여기서는 기본 범위를 사용한다.
  }
  return { startYear: DEFAULT_START_YEAR, endYear: DEFAULT_END_YEAR };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${redact(JSON.stringify(value, null, 2))}\n`, 'utf8');
}

async function fetchWithRowLimitFallback(
  table: (typeof DENOMINATOR_TABLES)[number],
  startYear: number,
  endYear: number,
): Promise<KosisCell[]> {
  try {
    return await fetchKosisTable({
      orgId: '334',
      tblId: table.tblId,
      objLevels: table.objLevels,
      startYear,
      endYear,
    });
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : String(error));
    if (!/err=(?:31|41)\b/.test(message) || startYear >= endYear) throw new Error(message);
    const cells: KosisCell[] = [];
    for (let year = startYear; year <= endYear; year += 1) {
      cells.push(
        ...(await fetchKosisTable({
          orgId: '334',
          tblId: table.tblId,
          objLevels: table.objLevels,
          startYear: year,
          endYear: year,
        })),
      );
    }
    return cells;
  }
}

export async function runFetchTotalStudents(): Promise<void> {
  loadLocalKosisEnvironment();
  const { startYear, endYear } = readYearRange();
  mkdirSync(RAW_DIR, { recursive: true });
  for (const table of DENOMINATOR_TABLES) {
    const cells = await fetchWithRowLimitFallback(table, startYear, endYear);
    writeJson(resolve(RAW_DIR, `kosis-${table.tblId}.json`), {
      schemaVersion: 1,
      retrievedAt: new Date().toISOString(),
      orgId: '334',
      tblId: table.tblId,
      tableName: table.tableName,
      objLevels: table.objLevels,
      startYear,
      endYear,
      cells,
    });
    console.log(redact(`KOSIS ${table.tblId}: ${cells.length}개 셀을 수집했습니다.`));
  }
}

async function main(): Promise<void> {
  await runFetchTotalStudents();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`data:fetch 분모 단계 실패: ${message}`));
    process.exitCode = 1;
  });
}
