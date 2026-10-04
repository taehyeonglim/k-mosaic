import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { redact } from './lib/redact.js';
import { parseForeignSnapshot } from '../src/lib/schema/foreign-student.js';
import type { ValidationReport } from '../src/lib/validation/index.js';
import { validateForeignSnapshot } from '../src/lib/validation/foreign.js';
import { readPreviousSnapshotArg } from './lib/cli.js';

// 커밋된 외국인 유학생 스냅숏을 검증한다. 이전에는 build-foreign 안에서만 검증이 돌아
// (원자료 필요) 배포 파이프라인이 커밋된 외국인 스냅숏을 다시 확인하지 않았다.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SNAPSHOT_PATH = resolve(ROOT, 'data/snapshots/foreign-students.v1.json');

export function runValidateForeign(previousSnapshot?: unknown): ValidationReport {
  let snapshot;
  try {
    snapshot = parseForeignSnapshot(
      JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8').replace(/^﻿/, '')),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`외국인 스냅숏을 읽지 못했습니다: ${message}`));
  }
  const report = validateForeignSnapshot(snapshot, { previousSnapshot });
  for (const validation of report.results) {
    const status = validation.passed ? 'PASS' : validation.severity === 'block' ? 'FAIL' : 'WARN';
    console.log(redact(`[${status}] ${validation.id} ${validation.name}: ${validation.detail}`));
  }
  console.log(redact(`외국인 유학생 검증 결과: ${report.passed ? '통과' : '실패'}`));
  if (!report.passed) throw new Error(redact('차단 수준 검증 규칙이 실패했습니다.'));
  return report;
}

async function main(): Promise<void> {
  runValidateForeign(readPreviousSnapshotArg());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redact(`data:validate-foreign 단계 실패: ${message}`));
    process.exitCode = 1;
  });
}
