import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchEnaraTable } from './lib/enara.js';
import { redact } from './lib/redact.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = resolve(ROOT, 'data/raw');
const TABLE_ID = 'F008403';

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${redact(JSON.stringify(value, null, 2))}\n`, 'utf8');
}

export async function runFetchMulticulturalStats(): Promise<void> {
  mkdirSync(RAW_DIR, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const table = await fetchEnaraTable(TABLE_ID);
  const { rawHtml, ...parsedTable } = table;
  writeJson(resolve(RAW_DIR, `enara-${TABLE_ID}.json`), {
    schemaVersion: 1,
    retrievedAt,
    sttsCd: TABLE_ID,
    ...parsedTable,
  });
  if (rawHtml !== undefined)
    writeFileSync(resolve(RAW_DIR, `enara-${TABLE_ID}.html`), redact(rawHtml), 'utf8');
  console.log(redact(`e-나라지표 ${TABLE_ID}: ${table.rows.length}개 셀을 수집했습니다.`));
}

async function main(): Promise<void> {
  await runFetchMulticulturalStats();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`data:fetch 분자 단계 실패: ${message}`));
    process.exitCode = 1;
  });
}
