import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { redact } from '../src/lib/mcp/index.js';
import { parseSnapshot, type Snapshot } from '../src/lib/schema/index.js';
import { validateSnapshot, type ValidationReport } from '../src/lib/validation/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NORMALIZED_PATH = resolve(ROOT, 'data/normalized/multicultural-students.v1.json');
const SNAPSHOT_PATH = resolve(ROOT, 'data/snapshots/multicultural-students.v1.json');

function readSnapshot(): Snapshot {
  const path = existsSync(NORMALIZED_PATH) ? NORMALIZED_PATH : SNAPSHOT_PATH;
  if (!existsSync(path)) throw new Error(redact('검증할 스냅숏이 없습니다.'));
  try {
    return parseSnapshot(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`검증 입력을 읽지 못했습니다: ${message}`));
  }
}

export function runValidateStats(snapshot = readSnapshot()): ValidationReport {
  const report = validateSnapshot(snapshot);
  for (const validation of report.results) {
    const status = validation.passed ? 'PASS' : validation.severity === 'block' ? 'FAIL' : 'WARN';
    console.log(redact(`[${status}] ${validation.id} ${validation.name}: ${validation.detail}`));
  }
  console.log(redact(`검증 결과: ${report.passed ? '통과' : '실패'}`));
  if (!report.passed) throw new Error(redact('차단 수준 검증 규칙이 실패했습니다.'));
  return report;
}

async function main(): Promise<void> {
  runValidateStats();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`data:validate 단계 실패: ${message}`));
    process.exitCode = 1;
  });
}
