import { codeFromShort } from '../../src/lib/constants/regions.js';
import type { RegionScope, SchoolLevel } from '../../src/lib/schema/index.js';
import { redact } from './redact.js';

// e-나라지표 F0084 계열 HTML 표 수집기 (OpenAPI 없음 — HTML 파싱).

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

const ENARA_ENDPOINT = 'https://www.index.go.kr/unity/potal/eNara/sub/showStblGams3.do';

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
