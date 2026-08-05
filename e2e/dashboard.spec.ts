import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { assertNoHorizontalOverflow, gotoDashboard, SCREENSHOTS_DIR } from './helpers';

function rankingRegion(page: Parameters<typeof gotoDashboard>[0]) {
  return page.getByRole('region', { name: '학생 수 순위', exact: true });
}

test.describe('r4-e2e 핵심 사용자 흐름', () => {
  test('E1 첫 화면에 헤더·브랜드·기준 연도·갱신일이 열린다', async ({ page }) => {
    await gotoDashboard(page);

    const header = page.locator('header');
    await expect(header.getByRole('heading', { name: 'K-MOSAIC', exact: true })).toBeVisible();
    await expect(
      header.getByText('대한민국 다문화학생 교육통계 시각화·분석 플랫폼', { exact: true }),
    ).toBeVisible();
    await expect(header.getByText('기준 연도', { exact: true })).toBeVisible();
    await expect(header.getByText('2025', { exact: true })).toBeVisible();
    await expect(header.getByText('갱신일', { exact: true })).toBeVisible();
    await expect(header.getByText('2026. 8. 5.', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('region', { name: '전국 개요', exact: true }).getByText('202,208명', {
        exact: true,
      }),
    ).toBeVisible();

    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'desktop-main.png'),
      fullPage: true,
    });
  });

  test('E2 지도 17개 path와 순위 표 17행이 모두 표시된다', async ({ page }) => {
    await gotoDashboard(page);

    await expect(page.locator('path[role="button"]')).toHaveCount(17);
    const table = rankingRegion(page).getByRole('table');
    await expect(table.locator('tbody tr')).toHaveCount(17);
  });

  test('E3 서울을 선택하면 서울 상세 정보가 열린다', async ({ page }) => {
    await gotoDashboard(page);

    const seoulPath = page.locator('path[role="button"][aria-label^="서울특별시,"]');
    await expect(seoulPath).toHaveCount(1);
    await seoulPath.click({ timeout: 5_000 });

    await expect(page.getByRole('heading', { name: '서울특별시', exact: true })).toBeVisible();
    await expect(page.locator('#filter-region-11')).toBeChecked();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'region-seoul-selected.png'),
      fullPage: true,
    });
  });

  test('E4 연도 변경 시 전국 지표·지도·순위가 함께 갱신된다', async ({ page }) => {
    await gotoDashboard(page);

    const mapPaths = page.locator('path[role="button"]');
    const beforeMapLabels = await mapPaths.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label') ?? ''),
    );
    const ranking = rankingRegion(page);
    const beforeRanking = await ranking.innerText();
    const yearSelect = page.locator('#filter-year');
    await expect(yearSelect).toHaveCount(1);
    await yearSelect.selectOption('2022');

    await expect(yearSelect).toHaveValue('2022');
    await expect(page).toHaveURL(/year=2022/);
    await expect(page.locator('[data-key="student-count"]')).toContainText('168,645명');

    const afterMapLabels = await mapPaths.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label') ?? ''),
    );
    expect(afterMapLabels).not.toEqual(beforeMapLabels);
    expect(afterMapLabels.every((label) => label.includes('연도 2022'))).toBe(true);
    expect(await ranking.innerText()).not.toBe(beforeRanking);
  });

  test('E5 학생 수와 비율 전환 시 범례·척도·순위 단위가 함께 바뀐다', async ({ page }) => {
    await gotoDashboard(page);

    const rateButton = page.getByRole('button', { name: '비율', exact: true });
    await expect(rateButton).toHaveCount(1);
    await rateButton.click();

    await expect(rateButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '학생 수', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.locator('svg[role="group"]')).toHaveAttribute('aria-label', '비율');
    await expect(page.getByRole('list', { name: '비율', exact: true })).toContainText('%');
    await expect(page.getByRole('region', { name: '비율 순위', exact: true })).toContainText('%');

    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'rate-mode.png'),
      fullPage: true,
    });
  });

  test('E6 학교급 필터가 적용되고 URL 재방문 시 유지된다', async ({ page }) => {
    await gotoDashboard(page);

    const schoolLevelSelect = page.locator('#filter-school-level');
    await schoolLevelSelect.selectOption('elementary');
    await expect(schoolLevelSelect).toHaveValue('elementary');
    await expect(page).toHaveURL(/level=elementary/);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(schoolLevelSelect).toHaveValue('elementary');
    await expect(page.getByRole('option', { name: '초등학교', exact: true })).toBeAttached();
  });

  test('E7 지역 비교는 최대 3개이며 4번째 시도에 안내를 표시한다', async ({ page }) => {
    await gotoDashboard(page);

    const regionNames = ['서울특별시', '부산광역시', '대구광역시', '인천광역시'];
    for (const regionName of regionNames.slice(0, 3)) {
      const checkbox = page.getByRole('checkbox', { name: regionName, exact: true });
      await expect(checkbox).toHaveCount(1);
      await checkbox.click();
      await expect(checkbox).toBeChecked();
    }

    await expect(page.locator('input[type="checkbox"]:checked')).toHaveCount(3);
    const fourthCheckbox = page.getByRole('checkbox', { name: '인천광역시', exact: true });
    await fourthCheckbox.click();
    await expect(
      page.getByText('지역은 최대 3개까지 선택할 수 있습니다.', { exact: true }),
    ).toBeVisible();
    await expect(fourthCheckbox).not.toBeChecked();
  });

  test('E8 현재 필터 결과 CSV 다운로드에 출처 주석이 포함된다', async ({ page }) => {
    await gotoDashboard(page);

    const downloadButton = page.getByRole('button', {
      name: '현재 필터 결과 CSV',
      exact: true,
    });
    await expect(downloadButton).toHaveCount(1);
    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    if (downloadPath === null) {
      throw new Error('CSV 다운로드 경로를 확인할 수 없습니다.');
    }
    const csv = readFileSync(downloadPath, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('# 출처:');
    expect(csv).toContain('# 기준연도: 2025');
    expect(csv).toContain('# 계산식:');
  });

  test('E9 출처 페이지에서 출처·기준일·통계표 ID를 확인할 수 있다', async ({ page }) => {
    await page.goto('/sources/', { waitUntil: 'networkidle' });

    await expect(page).toHaveURL(/\/sources\/?$/);
    await expect(page.getByText('출처 및 계산식', { exact: true })).toHaveCount(3);
    await expect(page.getByText('F008403', { exact: true })).toBeVisible();
    await expect(page.getByText('DT_1963003_002', { exact: true })).toBeVisible();
    const unknownValues = page.locator('dd').filter({ hasText: '미확인' });
    expect(await unknownValues.count()).toBeGreaterThan(0);
    const formulaCard = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: '계산식', exact: true }) });
    await expect(formulaCard).toHaveCount(1);
    await expect(
      formulaCard.getByText('다문화학생 수 ÷ (초+중+고+각종 학생수) × 100', { exact: true }),
    ).toBeVisible();

    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'sources-page.png'),
      fullPage: true,
    });
  });

  test.describe('E10 모바일 360×740', () => {
    test.use({ viewport: { width: 360, height: 740 } });

    test('핵심 기능이 동작하고 가로 스크롤이 없다', async ({ page }) => {
      await gotoDashboard(page);
      await expect(page).toHaveTitle(/K-MOSAIC/);
      await expect(page.locator('path[role="button"]')).toHaveCount(17);
      await expect(page.getByRole('heading', { name: '필터', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: '지역 순위', exact: true })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: '출처 및 계산식', exact: true }),
      ).toBeVisible();

      await page.screenshot({
        path: join(SCREENSHOTS_DIR, 'mobile-main.png'),
        fullPage: true,
      });

      await page.locator('#filter-year').selectOption('2022');
      await expect(page.locator('[data-key="student-count"]')).toContainText('168,645명');
      await page.getByRole('button', { name: '비율', exact: true }).click();
      await expect(page.locator('svg[role="group"]')).toHaveAttribute('aria-label', '비율');
      await expect(page.getByRole('checkbox', { name: '서울특별시', exact: true })).toBeVisible();

      await assertNoHorizontalOverflow(page);
    });
  });

  test('E11 다크모드 전환이 적용되고 유지된다', async ({ page }) => {
    await gotoDashboard(page);

    const darkButton = page.getByRole('button', { name: 'dark', exact: true });
    await expect(darkButton).toHaveCount(1);
    await darkButton.click();
    await expect(darkButton).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'dark-mode.png'),
      fullPage: true,
    });
  });
});
