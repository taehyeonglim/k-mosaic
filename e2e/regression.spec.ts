import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { gotoDashboard } from './helpers';

// 2026-10 감사에서 운영 사이트에 노출된 결함의 회귀 방지 — 출처 오표시(D1)·척도 고정(D3)·수록 기간 문구(D2).

const FOREIGN_TABLE_IDS = ['153401', 'DT_1963003_010_S'];

function snapshotYears(): number[] {
  const snapshot = JSON.parse(
    readFileSync(resolve(process.cwd(), 'data/snapshots/multicultural-students.v1.json'), 'utf8'),
  ) as { coverage: { years: number[] } };
  return snapshot.coverage.years;
}

test.describe('회귀 방지', () => {
  for (const path of ['/', '/sources/']) {
    test(`${path} 다문화학생 출처에 외국인 유학생 통계표가 섞이지 않는다`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' });
      const text = await page.locator('main').innerText();

      expect(text).toContain('F008403');
      for (const tableId of FOREIGN_TABLE_IDS) expect(text).not.toContain(tableId);
    });
  }

  test('지도 척도는 연도를 바꿔도 고정된다', async ({ page }) => {
    await gotoDashboard(page);
    const years = snapshotYears();
    const legend = page.getByRole('list', { name: '학생 수', exact: true });
    const yearSelect = page.locator('#filter-year');

    await yearSelect.selectOption(String(years[years.length - 1]));
    const latestLegend = await legend.innerText();
    await yearSelect.selectOption(String(years[0]));
    await expect(page).toHaveURL(new RegExp(`year=${years[0]}`));

    expect(await legend.innerText()).toBe(latestLegend);
  });

  test('수록 기간 안내는 스냅숏 연도와 일치한다', async ({ page }) => {
    await gotoDashboard(page);
    const years = snapshotYears();

    await expect(
      page.getByText(`${Math.min(...years)}~${Math.max(...years)}년을 제공합니다.`),
    ).toBeVisible();
  });
});
