import { expect, test, type Locator, type Page } from '@playwright/test';

import { gotoDashboard } from './helpers';

// 순위 표의 인라인 막대와 선택 표시. 막대 길이는 값에 비례해야 한다 (0 기준선).

function rankingRegion(page: Page, name: string): Locator {
  return page.getByRole('region', { name, exact: true });
}

async function barWidths(region: Locator): Promise<number[]> {
  return region
    .locator('tbody tr [data-ranking-bar]')
    .evaluateAll((bars) => bars.map((bar) => bar.getBoundingClientRect().width));
}

function parseValue(text: string): number {
  return Number(text.replace(/[^0-9.+-]/g, ''));
}

test.describe('순위 표', () => {
  test('막대 길이가 값에 비례한다', async ({ page }) => {
    await gotoDashboard(page);
    const region = rankingRegion(page, '학생 수 순위');

    const widths = await barWidths(region);
    expect(widths).toHaveLength(17);
    const values = (await region.locator('tbody tr [data-ranking-value]').allInnerTexts()).map(
      parseValue,
    );
    expect(values).toHaveLength(17);

    // 1위 막대가 가장 길고, 순위가 내려갈수록 짧아진다.
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
    for (const [index, width] of widths.entries()) {
      expect(width / widths[0]!).toBeCloseTo(values[index]! / values[0]!, 1);
    }
  });

  test('감소한 지역의 막대는 기준선 왼쪽으로 뻗는다', async ({ page }) => {
    await gotoDashboard(page);
    const region = rankingRegion(page, '절대 증가 인원 순위');
    const rows = region.locator('tbody tr');
    await expect(rows).toHaveCount(17);

    const signs = await rows.evaluateAll((items) =>
      items.map((row) => ({
        value: row.querySelector('[data-ranking-value]')?.textContent ?? '',
        direction: row.querySelector('[data-ranking-bar]')?.getAttribute('data-direction') ?? '',
      })),
    );
    for (const row of signs) {
      const value = Number(row.value.replace(/[^0-9.+-]/g, ''));
      expect(row.direction).toBe(value > 0 ? 'positive' : value < 0 ? 'negative' : 'zero');
    }
  });

  test('선택한 지역의 행을 표시하고, 해제하면 표시가 사라진다', async ({ page }) => {
    await gotoDashboard(page);
    const region = rankingRegion(page, '학생 수 순위');
    const selected = region.locator('tr[data-selected="true"]');
    await expect(selected).toHaveCount(0);

    // 선택 상태는 URL 을 거쳐 반영되므로 check() 대신 click() 후 결과를 기다린다.
    const seoul = page.getByRole('checkbox', { name: '서울특별시', exact: true });
    await seoul.click();
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText('서울특별시');
    // 색만으로 알리지 않는다 — 화면낭독기용 문구가 함께 있다.
    await expect(selected).toContainText('선택한 지역');

    await page.getByRole('checkbox', { name: '부산광역시', exact: true }).click();
    await expect(selected).toHaveCount(2);

    await seoul.click();
    await expect(selected).toHaveCount(1);
    await expect(selected).toContainText('부산광역시');
  });
});

test('한글 본문은 어절 단위로 줄을 바꾼다', async ({ page }) => {
  await gotoDashboard(page);

  expect(await page.evaluate(() => getComputedStyle(document.body).wordBreak)).toBe('keep-all');
});
