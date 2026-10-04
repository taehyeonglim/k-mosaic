import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { gotoDashboard, SCREENSHOTS_DIR } from './helpers';

test.describe('r4-e2e 접근성 검증', () => {
  test('키보드 Tab·Enter·Space·Escape만으로 필터와 지역 선택을 조작한다', async ({ page }) => {
    await gotoDashboard(page);

    const yearSelect = page.getByRole('combobox', { name: '연도', exact: true });
    await expect(yearSelect).toHaveCount(1);
    await yearSelect.press('ArrowUp');
    await yearSelect.press('Tab');

    const focusedId = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.id ?? '',
    );
    expect(focusedId).toBe('filter-school-level');

    const rateButton = page.getByRole('button', { name: '비율', exact: true });
    await rateButton.press('Enter');
    await expect(rateButton).toHaveAttribute('aria-pressed', 'true');

    const seoulCheckbox = page.getByRole('checkbox', { name: '서울특별시', exact: true });
    await seoulCheckbox.press('Space');
    await expect(seoulCheckbox).toBeChecked();
    await expect(page.getByRole('heading', { name: '서울특별시', exact: true })).toBeVisible();
    await page.screenshot({
      path: join(SCREENSHOTS_DIR, 'region-seoul-selected.png'),
      fullPage: true,
    });

    const busanPath = page.locator('path[role="button"][aria-label^="부산광역시,"]');
    await expect(busanPath).toHaveCount(1);
    await busanPath.press('Enter');
    await expect(page.getByRole('heading', { name: '부산광역시', exact: true })).toBeVisible();
    await busanPath.press('Escape');
    await expect(page.getByRole('heading', { name: '서울특별시', exact: true })).toBeVisible();

    const seoulPath = page.locator('path[role="button"][aria-label^="서울특별시,"]');
    await expect(seoulPath).toHaveCount(1);
    await seoulPath.press('Escape');
    await expect(
      page
        .getByRole('region', { name: '지역 상세', exact: true })
        .getByText('지역을 선택하면 상세 정보가 표시됩니다.', { exact: true }),
    ).toBeVisible();
  });

  test('지도의 17개 지역이 role·aria-label과 값 정보를 갖는다', async ({ page }) => {
    await gotoDashboard(page);

    const mapPaths = page.locator('path[role="button"]');
    await expect(mapPaths).toHaveCount(17);
    const semantics = await mapPaths.evaluateAll((nodes) =>
      nodes.map((node) => ({
        role: node.getAttribute('role'),
        label: node.getAttribute('aria-label'),
      })),
    );
    expect(semantics.every((item) => item.role === 'button')).toBe(true);
    expect(
      semantics.every((item) => item.label !== null && /명|%|데이터 없음/.test(item.label)),
    ).toBe(true);
  });

  test('지도·차트에 표 형태의 대체 데이터가 있다', async ({ page }) => {
    await gotoDashboard(page);

    const tableSummaries = await page.locator('table').evaluateAll((tables) =>
      tables.map((table) => ({
        caption: table.querySelector('caption')?.textContent?.trim() ?? '',
        headers: Array.from(table.querySelectorAll('thead th')).map(
          (header) => header.textContent?.trim() ?? '',
        ),
      })),
    );

    expect(
      tableSummaries.some(
        (table) =>
          table.headers.includes('지역') &&
          table.headers.includes('연도') &&
          table.headers.includes('순위'),
      ),
    ).toBe(true);
    expect(
      tableSummaries.some(
        (table) =>
          table.caption === '전국' &&
          table.headers.includes('연도') &&
          table.headers.includes('전국'),
      ),
    ).toBe(true);
  });

  test('모든 select와 input에 연결된 label이 있다', async ({ page }) => {
    await gotoDashboard(page);

    const controls = await page.locator('select, input').evaluateAll((elements) =>
      elements.map((element) => {
        const id = element.getAttribute('id');
        const associatedLabel = id
          ? Array.from(document.querySelectorAll('label')).find((label) => label.htmlFor === id)
          : element.closest('label');
        return {
          id,
          hasLabel: associatedLabel !== undefined && associatedLabel !== null,
        };
      }),
    );
    expect(controls.length).toBeGreaterThan(0);
    expect(controls.every((control) => control.hasLabel)).toBe(true);
  });

  test('키보드 포커스 표시가 렌더링된다', async ({ page }) => {
    await gotoDashboard(page);

    const lightButton = page.getByRole('button', { name: 'light', exact: true });
    const systemButton = page.getByRole('button', { name: 'system', exact: true });
    await lightButton.press('Tab');
    await expect(systemButton).toBeFocused();
    const focusStyle = await systemButton.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
      };
    });
    expect(
      focusStyle.outlineStyle !== 'none' ||
        focusStyle.outlineWidth !== '0px' ||
        focusStyle.boxShadow !== 'none',
    ).toBe(true);
  });

  test('이미지·아이콘에 대체 텍스트 또는 aria-hidden이 있다', async ({ page }) => {
    await gotoDashboard(page);

    const audit = await page.locator('img, svg').evaluateAll((elements) => {
      const images = elements.filter((element) => element.tagName.toLowerCase() === 'img');
      const svgs = elements.filter((element) => element.tagName.toLowerCase() === 'svg');
      return {
        imagesHaveAlt: images.every((image) => image.getAttribute('alt') !== null),
        svgWithoutSemantics: svgs.filter((svg) => {
          if (svg.getAttribute('aria-hidden') === 'true') return false;
          if (svg.getAttribute('aria-label') || svg.getAttribute('aria-labelledby')) return false;
          return !svg.closest('[role="img"][aria-label], button[aria-label], a[aria-label]');
        }).length,
      };
    });
    expect(audit.imagesHaveAlt).toBe(true);
    expect(audit.svgWithoutSemantics).toBe(0);
  });

  test('외국인 유학생 페이지도 키보드만으로 지역을 선택해 추세를 연다', async ({ page }) => {
    const response = await page.goto('/foreign-students/', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBe(true);

    const prompt = page.getByText('지역을 선택하면 시도별 추세가 표시됩니다.', { exact: true });
    await expect(prompt).toBeVisible();

    const seoulPath = page.locator('path[role="button"][aria-label^="서울특별시,"]');
    await expect(seoulPath).toHaveCount(1);
    await seoulPath.focus();
    await seoulPath.press('Enter');

    await expect(page).toHaveURL(/regions=11/);
    await expect(prompt).toHaveCount(0);
  });
});
