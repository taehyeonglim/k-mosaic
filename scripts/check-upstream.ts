import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchEnaraTable, redact } from '../src/lib/mcp/index.js';
import { parseForeignEnaraTable } from './fetch-foreign-students.js';

// 업스트림에 스냅숏보다 새로운 연도가 공표됐는지 확인한다 (키 불필요 — e-나라지표만 조회).
// 데이터를 갱신하지는 않는다. 갱신은 사람이 로컬에서 검토하며 한다 (docs/operations.md).
//
// GitHub Actions 에서는 결과를 $GITHUB_OUTPUT 에 쓴다: new_year=true|false, summary=<문장>

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENARA_ENDPOINT = 'https://www.index.go.kr/unity/potal/eNara/sub/showStblGams3.do';

interface UpstreamStatus {
  dataset: string;
  tableId: string;
  snapshotLatest: number;
  upstreamLatest: number;
}

function snapshotLatestYear(file: string, key: 'years' | 'nationwideYears' = 'years'): number {
  const snapshot = JSON.parse(readFileSync(resolve(ROOT, 'data/snapshots', file), 'utf8')) as {
    coverage: Record<string, number[]>;
  };
  const years = snapshot.coverage[key];
  if (!Array.isArray(years) || years.length === 0)
    throw new Error(redact(`스냅숏 ${file} 의 coverage.${key} 가 비어 있습니다.`));
  return Math.max(...years);
}

async function foreignNationwideLatestYear(): Promise<number> {
  const url = new URL(ENARA_ENDPOINT);
  url.searchParams.set('stts_cd', '153401');
  url.searchParams.set('idx_cd', '1534');
  url.searchParams.set('freq', 'Y');
  url.searchParams.set('period', 'N');
  const response = await fetch(url, {
    headers: {
      Referer: 'https://www.index.go.kr/unify/idx-info.do?idxCd=1534',
      'User-Agent': 'Mozilla/5.0 (compatible; K-MOSAIC upstream watch)',
    },
  });
  if (!response.ok) throw new Error(redact(`e-나라지표 153401 HTTP 응답 오류 ${response.status}`));
  return Math.max(...parseForeignEnaraTable(await response.text()).years);
}

export async function checkUpstream(): Promise<UpstreamStatus[]> {
  const multicultural = await fetchEnaraTable('F008403');
  return [
    {
      dataset: '다문화학생 (시도별)',
      tableId: 'F008403',
      snapshotLatest: snapshotLatestYear('multicultural-students.v1.json'),
      upstreamLatest: Math.max(...multicultural.years),
    },
    {
      dataset: '대학 외국인 유학생 (전국 장기)',
      tableId: '153401',
      snapshotLatest: snapshotLatestYear('foreign-students.v1.json', 'nationwideYears'),
      upstreamLatest: await foreignNationwideLatestYear(),
    },
  ];
}

function writeGithubOutput(name: string, value: string): void {
  const path = process.env.GITHUB_OUTPUT;
  if (path) appendFileSync(path, `${name}<<EOF\n${value}\nEOF\n`, 'utf8');
}

async function main(): Promise<void> {
  const statuses = await checkUpstream();
  const fresh = statuses.filter((status) => status.upstreamLatest > status.snapshotLatest);
  for (const status of statuses) {
    console.log(
      redact(
        `${status.dataset} ${status.tableId}: 스냅숏 ${status.snapshotLatest} / 업스트림 ${status.upstreamLatest}`,
      ),
    );
  }
  const summary =
    fresh.length === 0
      ? '새 연도 없음 — 스냅숏이 업스트림 최신 연도와 같습니다.'
      : fresh
          .map(
            (status) =>
              `${status.dataset} ${status.tableId}: ${status.upstreamLatest}년 공표 (스냅숏 ${status.snapshotLatest})`,
          )
          .join('\n');
  console.log(redact(summary));
  writeGithubOutput('new_year', fresh.length > 0 ? 'true' : 'false');
  writeGithubOutput('summary', redact(summary));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`업스트림 확인 실패: ${message}`));
    process.exitCode = 1;
  });
}
