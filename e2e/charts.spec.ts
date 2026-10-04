import { expect, test, type Locator, type Page } from '@playwright/test';

import { gotoDashboard, readSnapshotFacts } from './helpers';

// 차트 표현 규칙: 계열색은 지역을 따라가고, 단독 계열은 범례 없이 끝점에 값을 적는다.

function nationalTrend(page: Page): Locator {
  return page.locator('section[aria-labelledby="national-trend-title"]');
}

function selectedTrend(page: Page): Locator {
  return page.locator('section[aria-labelledby="selected-trend-title"]');
}

async function lineStrokes(chart: Locator): Promise<string[]> {
  return chart
    .locator('path.recharts-line-curve')
    .evaluateAll((paths) => paths.map((path) => path.getAttribute('stroke') ?? ''));
}

test.describe('시계열 차트', () => {
  test('전국 추세(단독 계열)는 범례 없이 끝점에 최신 값을 적고 면을 옅게 채운다', async ({
    page,
  }) => {
    await gotoDashboard(page);
    const chart = nationalTrend(page);
    const facts = readSnapshotFacts();

    await expect(chart.locator('path.recharts-line-curve')).toHaveCount(1);
    await expect(chart.getByRole('list')).toHaveCount(0);
    await expect(chart.locator('path.recharts-area-area')).toHaveCount(1);
    await expect(chart.locator('[data-end-label]')).toHaveText(facts.latestNationalCountLabel);
  });

  test('비교 지역의 선 색은 지역을 따라간다 — 지역을 더해도 먼저 고른 지역의 색이 유지된다', async ({
    page,
  }) => {
    await gotoDashboard(page);
    const chart = selectedTrend(page);

    await page.getByRole('checkbox', { name: '서울특별시', exact: true }).click();
    await expect(chart.locator('path.recharts-line-curve')).toHaveCount(1);
    expect(await lineStrokes(chart)).toEqual(['var(--km-series-1)']);

    await page.getByRole('checkbox', { name: '부산광역시', exact: true }).click();
    await expect(chart.locator('path.recharts-line-curve')).toHaveCount(2);
    expect(await lineStrokes(chart)).toEqual(['var(--km-series-1)', 'var(--km-series-2)']);
    // 계열이 둘 이상이면 범례가 있고, 단독 계열용 면 채움은 없다.
    await expect(chart.getByRole('list').getByRole('listitem')).toHaveCount(2);
    await expect(chart.locator('path.recharts-area-area')).toHaveCount(0);
  });

  test('격자선은 점선이 아닌 실선이다', async ({ page }) => {
    await gotoDashboard(page);
    const dashed = await nationalTrend(page)
      .locator('.recharts-cartesian-grid line')
      .evaluateAll((lines) => lines.filter((line) => line.getAttribute('stroke-dasharray')).length);

    await expect(
      nationalTrend(page).locator('.recharts-cartesian-grid line').first(),
    ).toBeAttached();
    expect(dashed).toBe(0);
  });
});

test.describe('순위 패널 구성', () => {
  test('현재 값 순위와 전년 대비 변화 순위를 서로 다른 패널에 둔다', async ({ page }) => {
    await gotoDashboard(page);

    await expect(page.locator('#ranking').getByRole('table')).toHaveCount(1);
    await expect(page.locator('#ranking-change').getByRole('table')).toHaveCount(2);
    await expect(
      page.locator('#ranking-change').getByRole('region', { name: '증가율 순위', exact: true }),
    ).toBeVisible();
  });
});

test.describe('학교급별 구성', () => {
  test('지역 페이지에서 학교급별 학생 수와 비율을 표와 막대로 보여 준다', async ({ page }) => {
    await page.goto('/regions/11/', { waitUntil: 'networkidle' });
    const table = page.getByRole('table', { name: '학교급별 구성' });

    await expect(table.locator('tbody tr')).toHaveCount(4);
    await expect(table.locator('thead th')).toHaveText(['학교급', '학생 수', '학생 비율']);

    const rows = await table.locator('tbody tr').evaluateAll((items) =>
      items.map((row) => {
        const bars = [...row.querySelectorAll('[data-inline-bar]')] as HTMLElement[];
        const values = [...row.querySelectorAll('[data-inline-value]')].map(
          (node) => node.textContent ?? '',
        );
        return { widths: bars.map((bar) => bar.getBoundingClientRect().width), values };
      }),
    );
    const number = (text: string) => Number(text.replace(/[^0-9.]/g, ''));
    // 학생 수·비율 각각, 값이 가장 큰 학교급의 막대가 가장 길다.
    for (const column of [0, 1]) {
      const byValue = [...rows].sort(
        (a, b) => number(b.values[column]!) - number(a.values[column]!),
      );
      const byWidth = [...rows].sort((a, b) => b.widths[column]! - a.widths[column]!);
      expect(byWidth[0]!.values[column]).toBe(byValue[0]!.values[column]);
    }
  });
});
