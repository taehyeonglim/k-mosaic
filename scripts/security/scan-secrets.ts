import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { redact } from '../lib/redact.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// E2E 리포트는 playwright.config.ts 가 e2e/playwright-report 에 쓴다 (루트 경로는 구버전 호환).
const SCAN_DIRS = [
  'out',
  '.next',
  'coverage',
  'e2e/playwright-report',
  'playwright-report',
  'test-results',
  'logs',
];

function localKosisKey(): string | null {
  if (process.env.KOSIS_API_KEY) return process.env.KOSIS_API_KEY;
  const path = resolve(ROOT, '.env.local');
  if (!existsSync(path)) return null;
  const line = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .find((entry) => /^\s*(?:export\s+)?KOSIS_API_KEY\s*=/.test(entry));
  const match = line?.match(/^\s*(?:export\s+)?KOSIS_API_KEY\s*=\s*(.*?)\s*$/);
  return match?.[1] ? match[1].replace(/^['"]|['"]$/g, '') : null;
}

function walkFiles(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(path, entry.name);
    return entry.isDirectory() ? walkFiles(child) : [child];
  });
}

function trackedFiles(): string[] {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean)
      .map((path) => resolve(ROOT, path));
  } catch {
    return [];
  }
}

function environmentVariableNamesAndValues(): Array<{ name: string; value: string }> {
  const values = Object.entries(process.env)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([name, value]) => ({ name, value }));
  for (const name of [
    '.env',
    '.env.local',
    '.env.production',
    '.env.development',
    '.env.example',
  ]) {
    const path = resolve(ROOT, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match?.[1] && match[2])
        values.push({ name: match[1], value: match[2].replace(/^['"]|['"]$/g, '') });
    }
  }
  return values;
}

export function runSecretScan(): boolean {
  const findings: string[] = [];
  const secret = localKosisKey();
  const filesToScan = [
    ...trackedFiles(),
    ...SCAN_DIRS.flatMap((directory) => walkFiles(resolve(ROOT, directory))),
    ...readdirSync(ROOT)
      .filter((name) => name.endsWith('.log'))
      .map((name) => resolve(ROOT, name)),
  ];
  for (const path of [...new Set(filesToScan)]) {
    let content: string;
    try {
      content = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    if (secret && content.includes(secret))
      findings.push(`KOSIS_API_KEY 값 발견: ${path.replace(ROOT, '')}`);
    if (
      /\bNEXT_PUBLIC_[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PRIVATE|CREDENTIAL)\s*=\s*[^\s#]/i.test(
        content,
      )
    ) {
      findings.push(`NEXT_PUBLIC_ 비밀 환경변수 발견: ${path.replace(ROOT, '')}`);
    }
  }
  for (const entry of environmentVariableNamesAndValues()) {
    if (
      /^NEXT_PUBLIC_.*(?:KEY|TOKEN|SECRET|PASSWORD|PRIVATE|CREDENTIAL)/i.test(entry.name) &&
      entry.value.length > 0
    ) {
      findings.push(`NEXT_PUBLIC_ 비밀 환경변수 설정: ${entry.name}`);
    }
  }
  if (findings.length > 0) {
    for (const finding of [...new Set(findings)]) console.error(redact(finding));
    console.error(redact('비밀정보 스캔 실패'));
    return false;
  }
  console.log(redact('비밀정보 스캔 통과'));
  return true;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!runSecretScan()) process.exitCode = 1;
}
