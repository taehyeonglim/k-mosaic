import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, type Page } from '@playwright/test';

export const SCREENSHOTS_DIR = resolve(process.cwd(), 'e2e/screenshots');

mkdirSync(SCREENSHOTS_DIR, { recursive: true });

export async function gotoDashboard(page: Page): Promise<void> {
  const response = await page.goto('/', { waitUntil: 'networkidle' });
  if (response === null || !response.ok()) {
    throw new Error('대시보드 정적 문서를 불러오지 못했습니다.');
  }
  await expect(page.getByRole('heading', { name: '전국 개요', exact: true })).toBeVisible();
  await expect(page.locator('path[role="button"]')).toHaveCount(17);
}

export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > window.innerWidth ||
      document.body.scrollWidth > window.innerWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
}

export function readApiKeyFromEnvLocal(): string {
  const line = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith('KOSIS_API_KEY='));
  const rawValue = line?.slice('KOSIS_API_KEY='.length).trim() ?? '';
  if (rawValue.length === 0) {
    throw new Error('KOSIS_API_KEY가 .env.local에 없습니다.');
  }
  if (
    (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
    (rawValue.startsWith("'") && rawValue.endsWith("'"))
  ) {
    return rawValue.slice(1, -1);
  }
  return rawValue;
}

export function containsSecret(values: readonly string[], secret: string): boolean {
  return values.some(
    (value) => value.includes(secret) || value.includes(encodeURIComponent(secret)),
  );
}
