// K-MOSAIC 탐색 프로토타입 — 분모(전체 학생 수) 정의 역검증
//
// 목적:
//   다문화학생 비율 = 다문화학생 수 ÷ 전체 학생 수 인데,
//   "전체 학생 수"의 모수 정의(어느 학교급을 포함하는가, 어느 통계표를 쓰는가)가
//   공식 문서에 명시돼 있지 않다. 그래서 후보 조합별로 비율을 계산해
//   e-나라지표 공표 비율과 대조함으로써 모수를 '추정'이 아니라 '역산'으로 확정한다.
//
// 보안: KOSIS_API_KEY 는 .env.local 에서만 읽고 URL 전문을 출력하지 않는다.

import { readFileSync } from 'node:fs';
import { REGIONS, codeFromShort, codeFromOfficial } from './regions.mjs';

const ENV_PATH = new URL('../../.env.local', import.meta.url);
const API_KEY = (() => {
  const m = readFileSync(ENV_PATH, 'utf8').match(/^KOSIS_API_KEY=(.+)$/m);
  if (!m) throw new Error('.env.local 에 KOSIS_API_KEY 가 없습니다');
  return m[1].trim();
})();
const redact = (s) => String(s).split(API_KEY).join('***REDACTED***');

// --------------------------------------------------------------------------
// 1. 분자 — e-나라지표 F008403 (시도별 다문화학생 수 및 비율)
// --------------------------------------------------------------------------
const ENARA_URL =
  'https://www.index.go.kr/unity/potal/eNara/sub/showStblGams3.do' +
  '?stts_cd=F008403&idx_cd=F0084&freq=Y&period=N';

const stripTags = (s) => s.replace(/<[^>]+>/g, '');
const unescapeHtml = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
const cellText = (c) => unescapeHtml(stripTags(c)).replace(/\s+/g, ' ').trim();

/** "1,234" → 1234, "-" → null (결측). 0 으로 대체하지 않는다. */
function parseNum(s) {
  if (s == null) return null;
  const t = s.trim();
  if (t === '' || t === '-' || t === 'X' || t === '…') return null;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export async function fetchEnara() {
  const res = await fetch(ENARA_URL, {
    headers: {
      Referer: 'https://www.index.go.kr/unify/idx-info.do?idxCd=F0084',
      'User-Agent': 'Mozilla/5.0 (compatible; K-MOSAIC data probe)',
    },
  });
  if (!res.ok) throw new Error(`e-나라지표 응답 ${res.status}`);
  const html = await res.text();

  const trs = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) =>
    [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => cellText(c[1]))
  );
  const rows = trs.filter((r) => r.length);

  const years = rows[0].filter((y) => /^\d{4}$/.test(y));
  const regionsShort = rows[1].slice(0, rows[1].length / years.length);
  if (!years.length || regionsShort[0] !== '전국') {
    throw new Error('e-나라지표 표 구조가 예상과 다릅니다 (파서 갱신 필요)');
  }

  // 라벨 행 순서: [수]전체/초/중/고/각종 → [비율]전체/초/중/고/각종
  const LEVELS = ['all', 'elementary', 'middle', 'high', 'other'];
  const dataRows = rows.slice(3).map((r) => r.filter((x) => /^[\d,.\-]+$/.test(x)));
  const out = [];
  const expect = years.length * regionsShort.length;

  dataRows.forEach((vals, i) => {
    if (vals.length !== expect) return;
    const metric = i < LEVELS.length ? 'count' : 'rate';
    const level = LEVELS[i % LEVELS.length];
    years.forEach((year, yi) => {
      regionsShort.forEach((short, ri) => {
        out.push({
          year: Number(year),
          regionCode: short === '전국' ? 'KR' : codeFromShort(short),
          regionShort: short,
          schoolLevel: level,
          metric,
          value: parseNum(vals[yi * regionsShort.length + ri]),
        });
      });
    });
  });
  return { years: years.map(Number), regionsShort, rows: out };
}

// --------------------------------------------------------------------------
// 2. 분모 — KOSIS 교육기본통계 개황표의 시도별 학생수
// --------------------------------------------------------------------------
async function kosis(params) {
  const url = new URL('https://kosis.kr/openapi/Param/statisticsParameterData.do');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('apiKey', API_KEY);
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`KOSIS 응답 파싱 실패: ${redact(text).slice(0, 300)}`);
  }
  const err = json?.err ?? json?.errCode;
  if (err !== undefined) throw new Error(`KOSIS err=${err} ${redact(json.errMsg ?? '')}`);
  return Array.isArray(json) ? json : (json.list ?? []);
}

/**
 * 개황표에서 시도별 '학생수' 를 뽑는다.
 *
 * 함정: 학교현황별 축에는 '학생수' 라는 이름이 두 번 등장한다.
 *       (1) 일반 학생수  — UNIT_NM='명'
 *       (2) 청소년육성단체 > 학생수 — 단위 없음
 *       이름으로 매칭하면 조용히 오염되므로 단위까지 함께 검사한다.
 */
export async function fetchDenominator(tblId, startYear, endYear) {
  const rows = await kosis({
    method: 'getList', format: 'json', jsonVD: 'Y',
    orgId: '334', tblId,
    objL1: 'ALL', objL2: 'ALL', objL3: 'ALL', itmId: 'ALL',
    prdSe: 'Y', startPrdDe: String(startYear), endPrdDe: String(endYear),
  });

  const byYearRegion = new Map();
  for (const r of rows) {
    const levels = [r.C1_NM, r.C2_NM, r.C3_NM].filter(Boolean);
    if (!levels.includes('학생수')) continue;
    if (r.UNIT_NM !== '명') continue;               // 청소년육성단체 학생수 배제
    // 설립주체별 축이 있는 구판(_S 아님)은 '계' 만 취한다
    if (levels.some((n) => ['국립', '공립', '사립'].includes(n))) continue;
    const regionName = r.C1_NM;
    const code = regionName === '총계' ? 'KR' : codeFromOfficial(regionName);
    if (!code) continue;
    const key = `${r.PRD_DE}|${code}`;
    // 같은 키에 여러 셀이 잡히면 파서 가정이 깨진 것이므로 표시
    if (byYearRegion.has(key)) byYearRegion.get(key).dupes.push(Number(r.DT));
    else byYearRegion.set(key, { value: Number(r.DT), lastChanged: r.LST_CHN_DE, dupes: [] });
  }
  return byYearRegion;
}

// --------------------------------------------------------------------------
// 3. 역검증 — 후보 분모 조합별로 비율을 계산해 공표치와 대조
// --------------------------------------------------------------------------
const DENOM_TABLES = {
  elementary: ['DT_1963003_002', 'DT_1963003_002_S'],
  middle:     ['DT_1963003_003', 'DT_1963003_003_S'],
  high:       ['DT_1963003_004', 'DT_1963003_004_S'],
  other:      ['DT_1963003_009', 'DT_1963003_009_S'],
  special:    ['DT_1963003_005', 'DT_1963003_005_S'],
};

async function main() {
  console.log('## 1) 분자 — e-나라지표 F008403');
  const enara = await fetchEnara();
  console.log('   연도:', enara.years.join(', '));
  console.log('   지역:', enara.regionsShort.length, '개');
  console.log('   셀 :', enara.rows.length);
  const missing = enara.rows.filter((r) => r.value === null);
  console.log('   결측(-) 셀:', missing.length,
    missing.slice(0, 5).map((m) => `${m.year}/${m.regionShort}/${m.schoolLevel}/${m.metric}`).join(', '));

  const y0 = Math.min(...enara.years), y1 = Math.max(...enara.years);

  console.log('\n## 2) 분모 — KOSIS 교육기본통계 개황표');
  const denom = {};
  for (const [level, tbls] of Object.entries(DENOM_TABLES)) {
    for (const tbl of tbls) {
      try {
        const m = await fetchDenominator(tbl, y0, y1);
        const yearsSeen = [...new Set([...m.keys()].map((k) => k.split('|')[0]))].sort();
        const dupes = [...m.values()].filter((v) => v.dupes.length).length;
        console.log(`   ${tbl.padEnd(20)} ${level.padEnd(11)} 셀=${String(m.size).padStart(4)} 연도=${yearsSeen.join(',')} 중복키=${dupes}`);
        denom[`${level}|${tbl}`] = m;
      } catch (e) {
        console.log(`   ${tbl.padEnd(20)} ${level.padEnd(11)} 실패: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 400)); // rate limit 200/분 보호
    }
  }

  console.log('\n## 3) 역검증 — 분모 조합별 공표 비율과의 오차');
  const published = new Map(
    enara.rows.filter((r) => r.metric === 'rate' && r.schoolLevel === 'all')
      .map((r) => [`${r.year}|${r.regionCode}`, r.value])
  );
  const counts = new Map(
    enara.rows.filter((r) => r.metric === 'count' && r.schoolLevel === 'all')
      .map((r) => [`${r.year}|${r.regionCode}`, r.value])
  );

  const CANDIDATES = [
    { name: '초+중+고',            levels: ['elementary', 'middle', 'high'] },
    { name: '초+중+고+각종',       levels: ['elementary', 'middle', 'high', 'other'] },
    { name: '초+중+고+각종+특수',  levels: ['elementary', 'middle', 'high', 'other', 'special'] },
  ];

  for (const suffix of ['', '_S']) {
    for (const cand of CANDIDATES) {
      const errs = [];
      for (const year of enara.years) {
        for (const r of [{ code: 'KR' }, ...REGIONS]) {
          const key = `${year}|${r.code}`;
          const pub = published.get(key), num = counts.get(key);
          if (pub == null || num == null) continue;
          let total = 0, ok = true;
          for (const lv of cand.levels) {
            const tbl = DENOM_TABLES[lv].find((t) => (suffix ? t.endsWith('_S') : !t.endsWith('_S')));
            const cell = denom[`${lv}|${tbl}`]?.get(key);
            if (!cell) { ok = false; break; }
            total += cell.value;
          }
          if (!ok || !total) continue;
          errs.push({ year, code: r.code, calc: (num / total) * 100, pub });
        }
      }
      if (!errs.length) { console.log(`   [${cand.name}${suffix}] 비교 가능 셀 없음`); continue; }
      // 2025년은 공표치가 정수 반올림돼 있으므로 분리해 본다
      const pre25 = errs.filter((e) => e.year < 2025);
      const dev = (arr) => arr.length
        ? (arr.reduce((s, e) => s + Math.abs(e.calc - e.pub), 0) / arr.length).toFixed(4)
        : 'n/a';
      const within = (arr, t) => arr.length
        ? ((arr.filter((e) => Math.abs(e.calc - e.pub) <= t).length / arr.length) * 100).toFixed(1)
        : 'n/a';
      console.log(
        `   [${(cand.name + suffix).padEnd(22)}] n=${String(errs.length).padStart(4)} ` +
        `평균오차(~2024)=${dev(pre25)}%p  ±0.05%p이내=${within(pre25, 0.05)}%  ±0.1%p이내=${within(pre25, 0.1)}%`
      );
    }
  }
}

// 이 파일은 build-snapshot.mjs 에서 fetch* 함수를 import 하므로
// 직접 실행했을 때만 역검증을 돌린다.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('FAILED:', redact(e.message));
    process.exit(1);
  });
}
