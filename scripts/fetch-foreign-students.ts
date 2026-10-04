import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assertContiguousYears } from '../src/lib/data/years.js';
import { fetchKosisTable, type KosisCell } from './lib/kosis.js';
import { redact } from './lib/redact.js';
import type { ForeignNationwideStat } from '../src/lib/schema/foreign-student.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = resolve(ROOT, 'data/raw');
const KOSIS_TABLE_ID = 'DT_1963003_010_S';
const KOSIS_START_YEAR = 2022;
// 끝 연도는 올해로 둔다. KOSIS 는 범위 안에서 공표된 연도만 돌려주고(2026-10 실측),
// 미공표 연도만 요청하면 err=30 을 낸다. 고정 연도를 두면 새 연도가 공표돼도 수집하지 못한다.
const KOSIS_END_YEAR = new Date().getFullYear();
const ENARA_STATISTICS_CODE = '153401';
const ENARA_INDEX_CODE = '1534';
const ENARA_ENDPOINT = 'https://www.index.go.kr/unity/potal/eNara/sub/showStblGams3.do';

interface HtmlCell {
  tag: 'th' | 'td';
  text: string;
  itemId: string | null;
}

interface HtmlRow {
  cells: HtmlCell[];
}

interface ForeignEnaraTable {
  years: number[];
  rows: ForeignNationwideStat[];
}

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

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${redact(JSON.stringify(value, null, 2))}\n`, 'utf8');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function cellText(value: string): string {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLabel(value: string): string {
  return value.replace(/\s+/g, '');
}

function parseHtmlRows(tableHtml: string): HtmlRow[] {
  return [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((rowMatch) => ({
    cells: [...(rowMatch[1] ?? '').matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map(
      (cellMatch) => ({
        tag: cellMatch[1] as 'th' | 'td',
        text: cellText(cellMatch[3] ?? ''),
        itemId: cellMatch[2]?.match(/\bitem-id\s*=\s*['"]([^'"]+)['"]/i)?.[1] ?? null,
      }),
    ),
  }));
}

function parseForeignNumber(value: string, label: string): number | null {
  const text = value.trim();
  if (text === '-') return null;
  if (!/^-?\d[\d,]*(?:\.\d+)?$/.test(text)) {
    throw new Error(redact(`e-나라지표 숫자 원자료를 해석할 수 없습니다: ${label}`));
  }
  const parsed = Number(text.replace(/,/g, ''));
  if (!Number.isFinite(parsed))
    throw new Error(redact(`e-나라지표 유한한 숫자가 아닙니다: ${label}`));
  return parsed;
}

/**
 * e-나라지표 153401의 2단 행 구조를 단언하고 필요한 두 행만 읽는다.
 * 이 표는 기존 F0084 파서의 10행·5학교급 구조를 사용하지 않는다.
 */
export function parseForeignEnaraTable(html: string): ForeignEnaraTable {
  const tableMatch = html.match(
    /<table\b[^>]*\bid\s*=\s*['"]t_Table_153401['"][^>]*>([\s\S]*?)<\/table>/i,
  );
  if (!tableMatch?.[1]) throw new Error(redact('e-나라지표 153401 통계표를 찾지 못했습니다.'));

  const rows = parseHtmlRows(tableMatch[1]);
  const firstRow = rows[0];
  const headerYears =
    firstRow?.cells.filter((cell) => /^\d{4}$/.test(cell.text)).map((cell) => Number(cell.text)) ??
    [];
  // 연도는 고정하지 않는다 — 연속된 오름차순이면 받아들이고, 행·셀 순서는 아래에서 단언한다.
  let years: number[];
  try {
    years = assertContiguousYears(headerYears, 'e-나라지표 153401');
  } catch (error) {
    throw new Error(redact(error instanceof Error ? error.message : String(error)));
  }
  if (years.some((year, index) => year !== headerYears[index])) {
    throw new Error(redact('e-나라지표 153401 연도 머리글이 오름차순이 아닙니다.'));
  }

  const dataRows = rows.filter((row) => row.cells.some((cell) => cell.tag === 'td'));
  if (dataRows.length !== 10) {
    throw new Error(
      redact(`e-나라지표 153401 세부 행 수가 예상과 다릅니다: ${dataRows.length}/10`),
    );
  }

  const expectedRows = [
    ['국외한국인유학생', '초등학교'],
    ['국외한국인유학생', '중학교'],
    ['국외한국인유학생', '고등학교'],
    ['국외한국인유학생', '대학(학위+연수)'],
    ['국외한국인유학생', '대학(학위)'],
    ['국내외국인유학생', '대학(학위+연수)'],
    ['국내외국인유학생', '대학(학위)'],
    ['유학·연수수지', '국내수입액'],
    ['유학·연수수지', '해외지급액'],
    ['유학·연수수지', '유학·연수수지'],
  ];
  const parsedRows: Array<{ group: string; detail: string; values: (number | null)[] }> = [];
  let currentGroup: string | null = null;
  for (const [index, row] of dataRows.entries()) {
    const headers = row.cells.filter((cell) => cell.tag === 'th');
    if (headers.length !== 1 && headers.length !== 2) {
      throw new Error(
        redact(`e-나라지표 153401 ${index + 1}번째 행의 계층 헤더가 올바르지 않습니다.`),
      );
    }
    if (headers.length === 2) currentGroup = normalizeLabel(headers[0]?.text ?? '');
    const detail = normalizeLabel(headers.at(-1)?.text ?? '');
    if (!currentGroup || !detail) {
      throw new Error(redact(`e-나라지표 153401 ${index + 1}번째 행의 행 라벨이 비어 있습니다.`));
    }
    const values = row.cells.filter((cell) => cell.tag === 'td');
    if (values.length !== years.length) {
      throw new Error(
        redact(
          `e-나라지표 153401 ${currentGroup}/${detail}의 셀 수가 예상과 다릅니다: ${values.length}/${years.length}`,
        ),
      );
    }
    if (values.some((cell, valueIndex) => cell.itemId !== `${years[valueIndex]}Y`)) {
      throw new Error(
        redact(`e-나라지표 153401 ${currentGroup}/${detail}의 연도 셀 순서가 올바르지 않습니다.`),
      );
    }
    parsedRows.push({
      group: currentGroup,
      detail,
      values: values.map((cell, valueIndex) =>
        parseForeignNumber(cell.text, `${currentGroup}/${detail}/${years[valueIndex]}`),
      ),
    });
  }

  if (
    parsedRows.some(
      (row, index) =>
        row.group !== expectedRows[index]?.[0] || row.detail !== expectedRows[index]?.[1],
    )
  ) {
    throw new Error(redact('e-나라지표 153401 2단 행 라벨 구조가 예상과 다릅니다.'));
  }

  const targetRows = parsedRows.filter((row) => row.group === '국내외국인유학생');
  const degreeAndTraining = targetRows.find((row) => row.detail === '대학(학위+연수)');
  const degreeOnly = targetRows.find((row) => row.detail === '대학(학위)');
  if (!degreeAndTraining || !degreeOnly || targetRows.length !== 2) {
    throw new Error(redact('e-나라지표 153401 국내외국인유학생의 두 대학 행을 찾지 못했습니다.'));
  }

  return {
    years,
    rows: years.map((year, index) => ({
      year,
      scope: 'nationwide' as const,
      degreeAndTraining: degreeAndTraining.values[index] ?? null,
      degreeOnly: degreeOnly.values[index] ?? null,
    })),
  };
}

async function fetchForeignEnaraTable(): Promise<{ table: ForeignEnaraTable; html: string }> {
  const url = new URL(ENARA_ENDPOINT);
  url.searchParams.set('stts_cd', ENARA_STATISTICS_CODE);
  url.searchParams.set('idx_cd', ENARA_INDEX_CODE);
  url.searchParams.set('freq', 'Y');
  url.searchParams.set('period', 'N');
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Referer: `https://www.index.go.kr/unify/idx-info.do?idxCd=${ENARA_INDEX_CODE}`,
        'User-Agent': 'Mozilla/5.0 (compatible; K-MOSAIC data pipeline)',
      },
    });
  } catch {
    throw new Error(redact('e-나라지표 153401 요청에 실패했습니다.'));
  }
  if (!response.ok) throw new Error(redact(`e-나라지표 153401 HTTP 응답 오류 ${response.status}`));
  const html = await response.text();
  return { table: parseForeignEnaraTable(html), html };
}

async function fetchKosisWithRowLimitFallback(): Promise<KosisCell[]> {
  try {
    return await fetchKosisTable({
      orgId: '334',
      tblId: KOSIS_TABLE_ID,
      objLevels: 2,
      startYear: KOSIS_START_YEAR,
      endYear: KOSIS_END_YEAR,
    });
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : String(error));
    if (!/err=(?:31|41)\b/.test(message)) throw new Error(message);
    const cells: KosisCell[] = [];
    for (let year = KOSIS_START_YEAR; year <= KOSIS_END_YEAR; year += 1) {
      try {
        cells.push(
          ...(await fetchKosisTable({
            orgId: '334',
            tblId: KOSIS_TABLE_ID,
            objLevels: 2,
            startYear: year,
            endYear: year,
          })),
        );
      } catch (yearError) {
        // 아직 공표되지 않은 연도(err=30)는 건너뛴다. 그 밖의 오류는 그대로 던진다.
        const yearMessage = redact(
          yearError instanceof Error ? yearError.message : String(yearError),
        );
        if (!/err=30\b/.test(yearMessage)) throw new Error(yearMessage);
      }
    }
    return cells;
  }
}

export async function runFetchForeignStudents(): Promise<void> {
  loadLocalKosisEnvironment();
  mkdirSync(RAW_DIR, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const cells = await fetchKosisWithRowLimitFallback();
  const enara = await fetchForeignEnaraTable();

  writeJson(resolve(RAW_DIR, `kosis-${KOSIS_TABLE_ID}.json`), {
    schemaVersion: 1,
    retrievedAt,
    orgId: '334',
    tblId: KOSIS_TABLE_ID,
    tableName: '고등교육기관 개황',
    objLevels: 2,
    startYear: KOSIS_START_YEAR,
    endYear: KOSIS_END_YEAR,
    cells,
  });
  writeJson(resolve(RAW_DIR, `enara-${ENARA_STATISTICS_CODE}.json`), {
    schemaVersion: 1,
    retrievedAt,
    sttsCd: ENARA_STATISTICS_CODE,
    idxCd: ENARA_INDEX_CODE,
    years: enara.table.years,
    rows: enara.table.rows,
  });
  writeFileSync(
    resolve(RAW_DIR, `enara-${ENARA_STATISTICS_CODE}.html`),
    redact(enara.html),
    'utf8',
  );
  console.log(redact(`KOSIS ${KOSIS_TABLE_ID}: ${cells.length}개 셀을 수집했습니다.`));
  console.log(
    redact(`e-나라지표 ${ENARA_STATISTICS_CODE}: ${enara.table.rows.length}개 셀을 수집했습니다.`),
  );
}

async function main(): Promise<void> {
  await runFetchForeignStudents();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`data:fetch-foreign 단계 실패: ${message}`));
    process.exitCode = 1;
  });
}
