import { redact } from './redact.js';

// KOSIS OpenAPI 클라이언트 — rate limit(실측 200건/분)·오류 코드·키 마스킹을 처리한다.

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

const KOSIS_ENDPOINT = 'https://kosis.kr/openapi/Param/statisticsParameterData.do';
const MIN_KOSIS_INTERVAL_MS = 400;
const MAX_RATE_LIMIT_RETRIES = 3;

let lastKosisRequestStartedAt = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
