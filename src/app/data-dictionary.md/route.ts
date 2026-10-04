import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 데이터 사전 다운로드 — 정적 내보내기에서 out/data-dictionary.md 파일로 생성된다.
// 예전에는 마크다운 전체(약 10KB)를 대시보드 payload 에 실어 매 페이지 로드마다 내려보냈다.
export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(readFileSync(join(process.cwd(), 'docs/data-dictionary-draft.md'), 'utf8'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
