import 'node:process';

import { codeFromShort } from '../constants/regions';
import type { RegionScope, SchoolLevel } from '../schema/index';

/** KOSIS 교육기본통계 응답의 셀. 원자료 필드는 보존하고 값은 정규화 단계에서 해석한다. */
export interface KosisCell {
  PRD_DE?: string;
  C1?: string;
  C1_NM?: string;
  C2?: string;
  C2_NM?: string;
  C3?: string;
  C3_NM?: string;
  ITM_ID?: string;
  ITM_NM?: string;
  UNIT_NM?: string;
  DT?: string | number | null;
  LST_CHN_DE?: string;
  [key: string]: unknown;
}

export interface EnaraRow {
  year: number;
  regionCode: RegionScope;
  regionShort: string;
  schoolLevel: SchoolLevel;
  metric: 'count' | 'rate';
  value: number | null;
}

export interface EnaraTable {
  years: number[];
  regionsShort: string[];
  rows: EnaraRow[];
  /** raw HTML is available to the fetch script for reproducibility, but is not part of the JSON dataset. */
  rawHtml?: string;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  [key: string]: unknown;
}

const REDACTED = '***REDACTED***';
const KOSIS_ENDPOINT = 'https://kosis.kr/openapi/Param/statisticsParameterData.do';
const ENARA_ENDPOINT = 'https://www.index.go.kr/unity/potal/eNara/sub/showStblGams3.do';
const MIN_KOSIS_INTERVAL_MS = 400;
const MAX_RATE_LIMIT_RETRIES = 3;

let lastKosisRequestStartedAt = 0;

export function redact(s: unknown): string {
  const value = String(s);
  const key = process.env.KOSIS_API_KEY;
  return key ? value.split(key).join(REDACTED) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === '' || text === '-' || text === 'X' || text === '…') return null;
  if (!/^-?(?:\d[\d,]*)(?:\.\d+)?$/.test(text)) return null;
  const parsed = Number(text.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function isDataToken(value: string): boolean {
  return (
    value === '-' || value === 'X' || value === '…' || /^-?(?:\d[\d,]*)(?:\.\d+)?$/.test(value)
  );
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

function htmlCellText(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseEnaraRows(html: string): string[][] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) =>
      [...(rowMatch[1] ?? '').matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cellMatch) =>
        htmlCellText(cellMatch[1] ?? ''),
      ),
    )
    .filter((row) => row.length > 0);
}

function parseEnaraTable(html: string): EnaraTable {
  const rows = parseEnaraRows(html);
  const firstRow = rows[0] ?? [];
  const years = firstRow.filter((cell) => /^\d{4}$/.test(cell)).map(Number);
  if (years.length === 0 || new Set(years).size !== years.length) {
    throw new Error(redact('e-나라지표 표 첫 행에서 연도 열을 확인할 수 없습니다.'));
  }

  const secondRow = rows[1] ?? [];
  if (secondRow[0] !== '전국' || secondRow.length % years.length !== 0) {
    throw new Error(redact('e-나라지표 표 둘째 행의 지역 구조가 예상과 다릅니다.'));
  }

  const regionCount = secondRow.length / years.length;
  const regionsShort = secondRow.slice(0, regionCount);
  if (regionsShort[0] !== '전국' || regionCount < 2) {
    throw new Error(redact('e-나라지표 표에 전국 또는 지역 열이 없습니다.'));
  }
  for (let yearIndex = 1; yearIndex < years.length; yearIndex += 1) {
    const block = secondRow.slice(yearIndex * regionCount, (yearIndex + 1) * regionCount);
    if (block.some((region, index) => region !== regionsShort[index])) {
      throw new Error(redact('e-나라지표 연도별 지역 열 수가 일치하지 않습니다.'));
    }
  }

  const expectedCells = years.length * regionCount;
  const valueRows = rows.slice(2).flatMap((row) => {
    const values = row.filter(isDataToken);
    return values.length > 0 ? [values] : [];
  });
  const expectedValueRows = 10;
  if (valueRows.length !== expectedValueRows) {
    throw new Error(
      redact(`e-나라지표 데이터 행 수가 예상과 다릅니다: ${valueRows.length}/${expectedValueRows}`),
    );
  }
  if (valueRows.some((values) => values.length !== expectedCells)) {
    throw new Error(
      redact(`e-나라지표 셀 수가 예상과 다릅니다: 연도 ${years.length} × 지역 ${regionCount}`),
    );
  }

  const levels: SchoolLevel[] = ['all', 'elementary', 'middle', 'high', 'other'];
  const rowsOut: EnaraRow[] = [];
  for (let rowIndex = 0; rowIndex < valueRows.length; rowIndex += 1) {
    const metric = rowIndex < levels.length ? 'count' : 'rate';
    const schoolLevel = levels[rowIndex % levels.length];
    const values = valueRows[rowIndex];
    if (schoolLevel === undefined || values === undefined) {
      throw new Error(redact('e-나라지표 내부 데이터 행을 읽을 수 없습니다.'));
    }
    for (let yearIndex = 0; yearIndex < years.length; yearIndex += 1) {
      for (let regionIndex = 0; regionIndex < regionCount; regionIndex += 1) {
        const year = years[yearIndex];
        const regionShort = regionsShort[regionIndex];
        const value = values[yearIndex * regionCount + regionIndex];
        if (year === undefined || regionShort === undefined || value === undefined) {
          throw new Error(redact('e-나라지표 내부 셀 위치를 읽을 수 없습니다.'));
        }
        const regionCode = regionShort === '전국' ? 'KR' : codeFromShort(regionShort);
        if (regionCode === null) {
          throw new Error(redact(`e-나라지표에 미등록 지역명이 있습니다: ${regionShort}`));
        }
        rowsOut.push({
          year,
          regionCode,
          regionShort,
          schoolLevel,
          metric,
          value: numberOrNull(value),
        });
      }
    }
  }

  return { years, regionsShort, rows: rowsOut };
}

async function waitForKosisSlot(): Promise<void> {
  const waitMs = Math.max(0, MIN_KOSIS_INTERVAL_MS - (Date.now() - lastKosisRequestStartedAt));
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastKosisRequestStartedAt = Date.now();
}

function parseJson(text: string): unknown {
  const clean = text.replace(/^\uFEFF/, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const corrected = clean.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
    try {
      return JSON.parse(corrected);
    } catch {
      throw new Error(redact('KOSIS 응답 JSON 파싱 실패'));
    }
  }
}

function safeKosisMessage(message: string): string {
  return redact(message.replace(/https?:\/\/\S+/g, '[URL]'));
}

function errorCode(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const raw = body.err ?? body.errCode ?? body.errorCode;
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const code = String(raw).trim();
  return code === '0' || code === '00' ? null : code;
}

function errorMessage(body: unknown): string {
  if (!isRecord(body)) return '';
  const message = body.errMsg ?? body.errorMessage ?? body.message;
  return message === undefined || message === null ? '' : String(message);
}

function kosisError(code: string, message: string): Error {
  const safeMessage = safeKosisMessage(message);
  if (code === '21')
    return new Error(redact(`KOSIS err=21 잘못된 조회 변수입니다. ${safeMessage}`));
  if (code === '30') return new Error(redact(`KOSIS err=30 조회 결과가 없습니다. ${safeMessage}`));
  if (code === '31' || code === '41')
    return new Error(redact(`KOSIS err=${code} 결과 행이 한도를 초과했습니다. ${safeMessage}`));
  return new Error(redact(`KOSIS err=${code} ${safeMessage}`));
}

export async function kosisRequest(
  path: string,
  params: Record<string, string | number>,
): Promise<unknown> {
  const apiKey = process.env.KOSIS_API_KEY;
  if (!apiKey) throw new Error(redact('KOSIS_API_KEY가 process.env에 없습니다.'));

  const url = path.startsWith('http') ? new URL(path) : new URL(path, KOSIS_ENDPOINT);
  url.searchParams.delete('apiKey');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  url.searchParams.set('apiKey', apiKey);

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    await waitForKosisSlot();
    let response: Response;
    let text: string;
    try {
      response = await fetch(url);
      text = await response.text();
    } catch {
      throw new Error(redact('KOSIS 요청에 실패했습니다.'));
    }

    const body = parseJson(text);
    const code = errorCode(body);
    const rateLimited = code === '40' || response.status === 429;
    if (rateLimited) {
      if (attempt < MAX_RATE_LIMIT_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(1000, 1000 * 2 ** attempt)));
        continue;
      }
      throw kosisError('40', errorMessage(body));
    }
    if (code !== null) throw kosisError(code, errorMessage(body));
    if (!response.ok) throw new Error(redact(`KOSIS HTTP 응답 오류 ${response.status}`));
    return body;
  }

  throw new Error(redact('KOSIS 요청 재시도 횟수를 초과했습니다.'));
}

function asKosisCells(body: unknown): KosisCell[] {
  const candidate = Array.isArray(body)
    ? body
    : isRecord(body) && Array.isArray(body.list)
      ? body.list
      : null;
  if (candidate === null) throw new Error(redact('KOSIS 응답에 셀 목록이 없습니다.'));
  return candidate.filter(isRecord) as KosisCell[];
}

export async function fetchKosisTable(opts: {
  orgId: string;
  tblId: string;
  objLevels: number;
  startYear: number;
  endYear: number;
}): Promise<KosisCell[]> {
  const params: Record<string, string | number> = {
    method: 'getList',
    format: 'json',
    jsonVD: 'Y',
    orgId: opts.orgId,
    tblId: opts.tblId,
    itmId: 'ALL',
    prdSe: 'Y',
    startPrdDe: opts.startYear,
    endPrdDe: opts.endYear,
  };
  for (let level = 1; level <= opts.objLevels; level += 1) params[`objL${level}`] = 'ALL';
  return asKosisCells(await kosisRequest('/openapi/Param/statisticsParameterData.do', params));
}

export async function fetchEnaraTable(sttsCd: string): Promise<EnaraTable> {
  const url = new URL(ENARA_ENDPOINT);
  url.searchParams.set('stts_cd', sttsCd);
  url.searchParams.set('idx_cd', 'F0084');
  url.searchParams.set('freq', 'Y');
  url.searchParams.set('period', 'N');
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Referer: 'https://www.index.go.kr/unify/idx-info.do?idxCd=F0084',
        'User-Agent': 'Mozilla/5.0 (compatible; K-MOSAIC data pipeline)',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`e-나라지표 요청에 실패했습니다. ${message}`));
  }
  if (!response.ok) throw new Error(redact(`e-나라지표 HTTP 응답 오류 ${response.status}`));
  const html = await response.text();
  try {
    const table = parseEnaraTable(html);
    return { ...table, rawHtml: html };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(message));
  }
}

function parseMcpResponse(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, '').trim());
  } catch {
    const events = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    const last = events.at(-1);
    if (!last) throw new Error(redact('MCP 응답 JSON을 파싱할 수 없습니다.'));
    try {
      return JSON.parse(last);
    } catch {
      throw new Error(redact('MCP 이벤트 응답 JSON을 파싱할 수 없습니다.'));
    }
  }
}

export async function listMcpTools(endpoint: string): Promise<McpTool[]> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`MCP 요청에 실패했습니다. ${message}`));
  }
  const body = parseMcpResponse(await response.text());
  if (!response.ok) throw new Error(redact(`MCP HTTP 응답 오류 ${response.status}`));
  if (!isRecord(body)) throw new Error(redact('MCP 응답 구조가 예상과 다릅니다.'));
  if (isRecord(body.error)) {
    throw new Error(
      redact(`MCP tools/list 오류: ${String(body.error.message ?? '알 수 없는 오류')}`),
    );
  }
  const result = isRecord(body.result) ? body.result : body;
  const tools = isRecord(result) && Array.isArray(result.tools) ? result.tools : null;
  if (tools === null) throw new Error(redact('MCP 응답에 도구 목록이 없습니다.'));
  return tools.filter(isRecord) as McpTool[];
}
