import { expect, test, type Locator, type Page } from '@playwright/test';

import { gotoDashboard } from './helpers';

// 단계구분도의 선택 표시·범례·도서 인셋.

function mapSvg(page: Page): Locator {
  return page.locator('svg[role="group"]');
}

async function overlappingLabels(labels: Locator): Promise<number> {
  const boxes = await labels.evaluateAll((nodes) =>
    nodes
      .filter((node) => (node as HTMLElement).offsetParent !== null)
      .map((node) => {
        const rect = node.getBoundingClientRect();
        return { left: rect.left, right: rect.right };
      })
      .sort((a, b) => a.left - b.left),
  );
  expect(boxes.length).toBeGreaterThanOrEqual(2);
  return boxes.filter((box, index) => index > 0 && box.left < boxes[index - 1]!.right - 0.5).length;
}

test.describe('지도', () => {
  test('선택한 지역에 표면색 헤일로와 강조 링을 겹쳐 그린다', async ({ page }) => {
    await gotoDashboard(page);
    const svg = mapSvg(page);
    await expect(svg.locator('[data-map-selection]')).toHaveCount(0);

    const seoul = page.locator('path[role="button"][aria-label^="서울특별시,"]');
    await seoul.click();
    await expect(seoul).toHaveAttribute('aria-pressed', 'true');
    await expect(svg.locator('[data-map-selection="halo"]')).toHaveCount(1);
    await expect(svg.locator('[data-map-selection="ring"]')).toHaveCount(1);
    // 겹쳐 그린 외곽선은 장식이다 — 보조기술에 노출하지 않고 클릭을 가로채지 않는다.
    await expect(svg.locator('[data-map-selection="ring"]')).toHaveAttribute('aria-hidden', 'true');

    await seoul.click();
    await expect(seoul).toHaveAttribute('aria-pressed', 'false');
    await expect(svg.locator('[data-map-selection]')).toHaveCount(0);
  });

  test('범례는 7단계와 결측 표시를 갖고, 눈금 글자가 겹치지 않는다', async ({ page }) => {
    await gotoDashboard(page);
    const legend = page.getByRole('list', { name: '학생 수', exact: true });

    await expect(legend.locator('[data-legend-step]')).toHaveCount(7);
    await expect(legend.getByText('데이터 없음', { exact: true })).toBeVisible();
    expect(await overlappingLabels(page.locator('[data-legend-tick]'))).toBe(0);
  });

  test('360px 에서도 범례 눈금 글자가 겹치지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await gotoDashboard(page);

    await expect(
      page.getByRole('list', { name: '학생 수', exact: true }).locator('[data-legend-step]'),
    ).toHaveCount(7);
    expect(await overlappingLabels(page.locator('[data-legend-tick]'))).toBe(0);
  });

  test('도서 인셋에 울릉도·독도 이름을 표시한다', async ({ page }) => {
    await gotoDashboard(page);
    const inset = mapSvg(page).locator('g[role="group"]');

    await expect(inset.getByText('울릉도', { exact: true })).toBeVisible();
    await expect(inset.getByText('독도', { exact: true })).toBeVisible();
  });

  test('지도 패널 머리말에 지표와 연도를 표시한다', async ({ page }) => {
    await gotoDashboard(page);
    const meta = page.locator('[data-map-meta]');
    await expect(meta).toHaveText(/^학생 수 · \d{4}$/);

    await page.locator('#filter-year').selectOption('2022');
    await page.getByRole('button', { name: '비율', exact: true }).click();
    await expect(meta).toHaveText('비율 · 2022');
  });
});
