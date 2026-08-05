// K-MOSAIC 탐색 프로토타입 — 검증된 스냅숏 생성
//
// verify-denominator.mjs 로 확정한 모수 정의(초+중+고+각종학교)를 적용해
// 정규화 스냅숏을 만든다. 멱등: 같은 입력이면 같은 출력(retrievedAt 제외).
//
// 산출물:
//   data/snapshots/multicultural-students.v1.json  — 정규화 데이터
//   data/metadata/sources.v1.json                  — 출처·계보 메타

import { writeFileSync, mkdirSync } from 'node:fs';
import { REGIONS, REGION_BY_CODE } from './regions.mjs';
import { fetchEnara, fetchDenominator } from './verify-denominator.mjs';

const ROOT = new URL('../../', import.meta.url);

// 모수 정의 — 역검증 결과(docs/data-audit.md §5 참조)
const DENOMINATOR_LEVELS = {
  elementary: { tblId: 'DT_1963003_002', nameKo: '초등학교 개황' },
  middle:     { tblId: 'DT_1963003_003', nameKo: '중학교 개황' },
  high:       { tblId: 'DT_1963003_004', nameKo: '고등학교 개황' },
  other:      { tblId: 'DT_1963003_009', nameKo: '각종학교 개황' },
};

const SOURCE_NUMERATOR = {
  provider: 'e-나라지표 (국가지표체계)',
  indicatorCode: 'F0084',
  tableCode: 'F008403',
  tableNameKo: '시도별 다문화학생 수 및 다문화학생 비율',
  originOrganization: '교육부·한국교육개발원 「교육기본통계」',
  url: 'https://www.index.go.kr/unify/idx-info.do?idxCd=F0084',
  accessMethod: 'HTML 파싱 (OpenAPI 미제공)',
};
const SOURCE_DENOMINATOR = {
  provider: 'KOSIS 국가통계포털 OpenAPI',
  orgId: '334',
  orgNameKo: '한국교육개발원',
  statisticsNameKo: '교육기본통계',
  accessMethod: 'KOSIS OpenAPI statisticsParameterData.do',
};

async function main() {
  const retrievedAt = new Date().toISOString();

  const enara = await fetchEnara();
  const years = enara.years;
  const y0 = Math.min(...years), y1 = Math.max(...years);

  // 분모 수집
  const denom = {};
  for (const [level, def] of Object.entries(DENOMINATOR_LEVELS)) {
    denom[level] = await fetchDenominator(def.tblId, y0, y1);
    await new Promise((r) => setTimeout(r, 400));
  }

  const numCount = new Map();
  const numRate = new Map();
  for (const r of enara.rows) {
    const key = `${r.year}|${r.regionCode}|${r.schoolLevel}`;
    (r.metric === 'count' ? numCount : numRate).set(key, r.value);
  }

  const records = [];
  const codes = ['KR', ...REGIONS.map((r) => r.code)];
  const LEVELS = ['all', 'elementary', 'middle', 'high', 'other'];

  for (const year of years) {
    for (const code of codes) {
      for (const level of LEVELS) {
        const k = `${year}|${code}|${level}`;
        const count = numCount.get(k) ?? null;
        const publishedRate = numRate.get(k) ?? null;

        // 분모: level='all' 이면 4개 학교급 합, 아니면 해당 급
        const notes = [];
        let total = null;
        const parts = level === 'all' ? Object.keys(DENOMINATOR_LEVELS) : [level];
        if (parts.every((p) => DENOMINATOR_LEVELS[p])) {
          let sum = 0, allPresent = true;
          for (const p of parts) {
            const cell = denom[p]?.get(`${year}|${code}`);
            if (!cell) { allPresent = false; break; }
            sum += cell.value;
          }
          if (allPresent) total = sum;
          else notes.push('분모 일부 학교급 결측 — 비율 계산 불가');
        }

        // 비율은 항상 직접 계산한다 (공표치는 2025년 정수 반올림으로 정밀도 손실)
        const computedRate =
          count != null && total != null && total > 0
            ? Number(((count / total) * 100).toFixed(4))
            : null;

        if (count == null) notes.push('원자료 결측(-) — 0명이 아님');
        if (year === 2025 && publishedRate != null) {
          notes.push('공표 비율이 정수 반올림됨 — 표시에는 계산값을 사용');
        }

        records.push({
          year,
          regionCode: code,
          regionNameKo: code === 'KR' ? '전국' : REGION_BY_CODE[code].officialKo,
          regionNameEn: code === 'KR' ? 'Korea (nationwide)' : REGION_BY_CODE[code].en,
          schoolLevel: level,
          studentType: 'total', // 유형별 구분은 이 출처에 없음 (docs/data-audit.md §7)
          multiculturalStudentCount: count,
          totalStudentCount: total,
          multiculturalStudentRateComputed: computedRate,
          multiculturalStudentRatePublished: publishedRate,
          notes,
        });
      }
    }
  }

  mkdirSync(new URL('data/snapshots/', ROOT), { recursive: true });
  mkdirSync(new URL('data/metadata/', ROOT), { recursive: true });

  const snapshot = {
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
  };
  writeFileSync(
    new URL('data/snapshots/multicultural-students.v1.json', ROOT),
    JSON.stringify(snapshot, null, 2)
  );
  writeFileSync(
    new URL('data/metadata/sources.v1.json', ROOT),
    JSON.stringify(
      { retrievedAt, numerator: SOURCE_NUMERATOR, denominator: { ...SOURCE_DENOMINATOR, tables: DENOMINATOR_LEVELS } },
      null, 2
    )
  );

  // 요약 리포트
  const withRate = records.filter((r) => r.multiculturalStudentRateComputed != null);
  const cmp = records.filter(
    (r) => r.multiculturalStudentRateComputed != null && r.multiculturalStudentRatePublished != null && r.year < 2025
  );
  const meanErr =
    cmp.reduce((s, r) => s + Math.abs(r.multiculturalStudentRateComputed - r.multiculturalStudentRatePublished), 0) /
    (cmp.length || 1);

  console.log('레코드:', records.length);
  console.log('비율 계산 성공:', withRate.length, `(${((withRate.length / records.length) * 100).toFixed(1)}%)`);
  console.log('결측 count 레코드:', records.filter((r) => r.multiculturalStudentCount == null).length);
  console.log(`공표치 대비 평균오차(~2024): ${meanErr.toFixed(4)}%p  (n=${cmp.length})`);
  const nat = records.filter((r) => r.regionCode === 'KR' && r.schoolLevel === 'all');
  console.log('\n전국 all:');
  for (const r of nat) {
    console.log(
      `  ${r.year}  수=${String(r.multiculturalStudentCount).padStart(7)}  분모=${String(r.totalStudentCount).padStart(7)}` +
      `  계산=${r.multiculturalStudentRateComputed}%  공표=${r.multiculturalStudentRatePublished}%`
    );
  }
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
