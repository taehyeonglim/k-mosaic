import { existsSync, readFileSync } from 'node:fs';
import { redact } from '../../src/lib/mcp/index.js';

/**
 * `--previous <path>` 로 비교 기준 스냅숏을 받는다. PR 검사는 base 브랜치의 스냅숏을
 * 넘겨 연도 커버리지 축소를 잡는다. 인자가 없으면 undefined — 검증기가 커밋된 파일을 쓴다.
 */
export function readPreviousSnapshotArg(argv: readonly string[] = process.argv): unknown {
  const index = argv.indexOf('--previous');
  if (index < 0) return undefined;
  const path = argv[index + 1];
  if (path === undefined || path.startsWith('--'))
    throw new Error(redact('--previous 뒤에 스냅숏 경로가 필요합니다.'));
  if (!existsSync(path)) throw new Error(redact(`비교 기준 스냅숏이 없습니다: ${path}`));
  try {
    return JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, '')) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(redact(`비교 기준 스냅숏을 읽을 수 없습니다: ${message}`));
  }
}
