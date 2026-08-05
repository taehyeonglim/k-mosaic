/**
 * src/ 안의 상대경로 import 에 `.js` 확장자가 붙는 것을 막는다.
 *
 * 왜 필요한가 —
 *   scripts/ 는 tsx 로 Node ESM 실행되므로 `.js` 확장자가 **정당**하다.
 *   그러나 src/ 는 Next.js(turbopack)가 번들하며, turbopack 은 `.js` → `.ts` 매핑을 하지 않는다.
 *   tsconfig 의 moduleResolution=Bundler 에서 tsc 는 이를 허용하므로
 *   **`pnpm typecheck` 는 통과하고 `pnpm build` 만 깨진다.** 실제로 두 번 발생했다.
 *
 * 이 검사는 그 조합을 CI 에서 조기에 잡는다.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const TARGET = join(ROOT, 'src');
const PATTERN = /(?:from|import\s*\()\s*['"](\.{1,2}\/[^'"]*?\.js)['"]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const findings: string[] = [];
for (const file of walk(TARGET)) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(PATTERN)) {
    const line = source.slice(0, match.index).split('\n').length;
    findings.push(`${relative(ROOT, file)}:${line} → ${match[1]}`);
  }
}

if (findings.length > 0) {
  console.error('src/ 안의 상대경로 import 에 .js 확장자가 있습니다.');
  console.error('turbopack 이 해석하지 못해 빌드가 깨집니다 (typecheck 는 통과함).');
  for (const f of findings) console.error(`  ${f}`);
  console.error('\n확장자를 제거하세요. scripts/ 는 tsx 실행이라 .js 가 정당하므로 그대로 둡니다.');
  process.exit(1);
}
console.log('import 확장자 검사 통과');
