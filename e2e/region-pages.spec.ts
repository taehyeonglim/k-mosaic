import { expect, test } from '@playwright/test';

import { readSnapshotFacts } from './helpers';

// 시·도별 정적 페이지 (/regions/[code]/) — 대시보드와 같은 셀렉터로 계산되어야 한다.

test.describe('지역별 정적 페이지', () => {
  test('서울 페이지가 최신 연도 수치·순위 안내·연도별 표를 보여 준다', async ({ page }) => {
    const facts = readSnapshotFacts();
    const response = await page.goto('/regions/11/', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBe(true);

    await expect(
      page.getByRole('heading', { name: '서울특별시 다문화학생', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`${facts.latestYear}년 4월 1일 기준`, { exact: false }),
    ).toBeVisible();
    await expect(page.locator('[data-key="region-rank"]')).toContainText('17개 시·도 중');
    await expect(
      page.getByText('순위는 교육의 우열이나 지역의 좋고 나쁨을 의미하지 않습니다.', {
        exact: true,
      }),
    ).toBeVisible();
    // 차트마다 접근성 대체 표가 있어 표가 여러 개다 — 캡션으로 연도별 표를 고른다.
    await expect(
      page.getByRole('table', { name: '서울특별시 연도별 다문화학생 수와 비율' }),
    ).toContainText(String(facts.years[0]));
    await expect(page).toHaveTitle('서울특별시 다문화학생 통계 — K-MOSAIC');
  });

  test('분모가 결측인 세종 최신 연도 비율은 0이 아니라 데이터 없음으로 표시된다', async ({
    page,
  }) => {
    await page.goto('/regions/36/', { waitUntil: 'networkidle' });
    const rate = page.locator('[data-key="student-rate"]');

    await expect(rate).not.toContainText('0.0%');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /분모 결측으로 비율은 계산하지 않음/,
    );
  });

  test('대시보드 지역 상세의 학생 수가 지역 페이지와 같고, 링크로 이동한다', async ({ page }) => {
    // 경기도는 지도 중앙에 서울이 겹쳐 있어 클릭 대신 URL 필터로 선택한다.
    await page.goto('/?regions=41', { waitUntil: 'networkidle' });
    const panel = page.locator('aside[aria-labelledby="region-detail-title"]');
    await expect(panel.getByRole('heading', { name: '경기도', exact: true })).toBeVisible();
    const dashboardCount = await panel
      .locator('.viz-stat')
      .first()
      .locator('.viz-stat-value')
      .innerText();

    await panel.getByRole('link', { name: '지역 페이지 열기' }).click();
    await expect(page).toHaveURL(/\/regions\/41\/$/);
    await expect(page.locator('[data-key="student-count"] .viz-stat-value')).toHaveText(
      dashboardCount,
    );
  });

  test('17개 페이지가 모두 열린다', async ({ request }) => {
    for (const code of [
      '11',
      '26',
      '27',
      '28',
      '29',
      '30',
      '31',
      '36',
      '41',
      '42',
      '43',
      '44',
      '45',
      '46',
      '47',
      '48',
      '50',
    ]) {
      const response = await request.get(`/regions/${code}/`);
      expect(response.ok(), `/regions/${code}/`).toBe(true);
    }
  });
});
