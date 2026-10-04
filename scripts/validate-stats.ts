import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve } from 'node:path';
import { redact } from './lib/redact.js';
import { parseSnapshot, type Snapshot } from '../src/lib/schema/index.js';
import {
  validateSnapshot,
  type ValidationContext,
  type ValidationReport,
} from '../src/lib/validation/index.js';
import { readPreviousSnapshotArg } from './lib/cli.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NORMALIZED_PATH = resolve(ROOT, 'data/normalized/multicultural-students.v1.json');
const SNAPSHOT_PATH = resolve(ROOT, 'data/snapshots/multicultural-students.v1.json');

function readSnapshot(path: string): Snapshot {
  try {
    return parseSnapshot(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`검증 입력을 읽지 못했습니다: ${message}`));
  }
}

function printReport(label: string, report: ValidationReport): void {
  console.log(redact(`— ${label}`));
  for (const validation of report.results) {
    const status = validation.passed ? 'PASS' : validation.severity === 'block' ? 'FAIL' : 'WARN';
    console.log(redact(`[${status}] ${validation.id} ${validation.name}: ${validation.detail}`));
  }
}

/**
 * snapshot 을 넘기면 그것만 검증한다(data:refresh 의 정규화 직후 단계).
 * 넘기지 않으면 커밋된 산출물 — 정규화본과 공개 스냅숏 — 을 모두 검증한다.
 * 공개 스냅숏만 바뀐 PR 이 정규화본 검증만으로 통과하지 않게 하기 위함이다.
 */
export function runValidateStats(
  snapshot?: Snapshot,
  context: ValidationContext = {},
): ValidationReport {
  const targets: Array<[string, Snapshot]> =
    snapshot !== undefined
      ? [['입력 스냅숏', snapshot]]
      : [NORMALIZED_PATH, SNAPSHOT_PATH]
          .filter((path) => existsSync(path))
          .map((path) => [relative(ROOT, path), readSnapshot(path)]);
  if (targets.length === 0) throw new Error(redact('검증할 스냅숏이 없습니다.'));

  const reports = targets.map(([label, target]) => {
    const report = validateSnapshot(target, context);
    printReport(label, report);
    return report;
  });
  const passed = reports.every((report) => report.passed);
  console.log(redact(`검증 결과: ${passed ? '통과' : '실패'}`));
  if (!passed) throw new Error(redact('차단 수준 검증 규칙이 실패했습니다.'));
  return reports[reports.length - 1]!;
}

async function main(): Promise<void> {
  runValidateStats(undefined, { previousSnapshot: readPreviousSnapshotArg() });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`data:validate 단계 실패: ${message}`));
    process.exitCode = 1;
  });
}
