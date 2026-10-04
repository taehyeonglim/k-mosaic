import { expect, test, type Locator, type Page } from '@playwright/test';

// 대시보드 밖의 페이지(지역·외국인 유학생·출처)와 지역 상세 패널의 구성.

/** 요소의 바깥쪽에서 처음 만나는 불투명 배경색 — 그 요소가 '어느 면 위에' 놓였는지. */
async function surfaceBehind(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    for (let node = element.parentElement; node !== null; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
    }
    return '';
  });
}

async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((property) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${property})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

test.describe('지역 페이지', () => {
  test('요약 타일은 캔버스가 아니라 패널(표면) 위에 놓인다', async ({ page }) => {
    await page.goto('/regions/11/', { waitUntil: 'networkidle' });

    expect(await surfaceBehind(page.locator('[data-key="student-count"]'))).toBe(
      await token(page, '--km-color-surface'),
    );
  });

  test('요약 타일 셋이 줄을 가득 채운다 (빈 칸을 남기지 않는다)', async ({ page }) => {
    await page.goto('/regions/11/', { waitUntil: 'networkidle' });
    const boxes = await page
      .locator(
        '[data-key="student-count"], [data-key="student-rate"], [data-key="nationwide-difference"]',
      )
      .evaluateAll((tiles) =>
        tiles.map((tile) => {
          const rect = tile.getBoundingClientRect();
          const parent = tile.parentElement!.getBoundingClientRect();
          return { top: rect.top, right: rect.right, parentRight: parent.right };
        }),
      );

    expect(boxes).toHaveLength(3);
    expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1);
    expect(Math.abs(boxes[2]!.right - boxes[2]!.parentRight)).toBeLessThanOrEqual(1);
  });

  test('다른 시·도 16곳으로 가는 링크가 있다', async ({ page }) => {
    await page.goto('/regions/11/', { waitUntil: 'networkidle' });
    const others = page.getByRole('navigation', { name: '다른 시·도', exact: true });

    await expect(others.getByRole('link')).toHaveCount(16);
    await others.getByRole('link', { name: '부산', exact: true }).click();
    await expect(page).toHaveURL(/\/regions\/26\/$/);
  });
});

test.describe('외국인 유학생 페이지', () => {
  test('페이지 제목이 있고, 출처 제목과 모집단 안내를 한 번씩만 보여 준다', async ({ page }) => {
    await page.goto('/foreign-students/', { waitUntil: 'networkidle' });

    await expect(
      page.getByRole('heading', { name: '대학 외국인 유학생 통계', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /출처 및 계산식/ })).toHaveCount(1);
    await expect(page.getByText('두 수치를 직접 비교하지 마십시오.', { exact: false })).toHaveCount(
      1,
    );
  });

  test('전국 개요의 두 타일이 줄을 가득 채운다', async ({ page }) => {
    await page.goto('/foreign-students/', { waitUntil: 'networkidle' });
    const boxes = await page
      .locator('[data-key="foreign-student-count"], [data-key="foreign-student-rate"]')
      .evaluateAll((tiles) =>
        tiles.map((tile) => {
          const rect = tile.getBoundingClientRect();
          return {
            top: rect.top,
            right: rect.right,
            parentRight: tile.parentElement!.getBoundingClientRect().right,
          };
        }),
      );

    expect(boxes).toHaveLength(2);
    expect(Math.round(boxes[0]!.top)).toBe(Math.round(boxes[1]!.top));
    expect(Math.abs(boxes[1]!.right - boxes[1]!.parentRight)).toBeLessThanOrEqual(1);
  });
});

test('출처 페이지에 페이지 제목이 있다', async ({ page }) => {
  await page.goto('/sources/', { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: '데이터 출처', exact: true })).toBeVisible();
});

test.describe('대시보드 지역 상세', () => {
  test('선택 지역의 추세는 시계열 패널 한 곳에만 그린다', async ({ page }) => {
    await page.goto('/?regions=41', { waitUntil: 'networkidle' });
    const detail = page.getByRole('region', { name: '지역 상세', exact: true });

    await expect(detail.getByRole('heading', { name: '경기도', exact: true })).toBeVisible();
    await expect(detail.getByRole('table', { name: '학교급별 구성' })).toBeVisible();
    // 전국 추세 1 + 선택 지역 추세 1. 지역 상세 패널이 같은 선을 한 번 더 그리지 않는다.
    await expect(page.locator('path.recharts-line-curve')).toHaveCount(2);
    await expect(detail.locator('path.recharts-line-curve')).toHaveCount(0);

    await page.getByRole('button', { name: '비율', exact: true }).click();
    await expect(page.locator('path.recharts-line-curve')).toHaveCount(2);
  });

  test('닫기 버튼으로 선택을 해제한다', async ({ page }) => {
    await page.goto('/?regions=41', { waitUntil: 'networkidle' });
    const detail = page.getByRole('region', { name: '지역 상세', exact: true });

    await detail.getByRole('button', { name: '경기도 선택 해제', exact: true }).click();
    await expect(detail.getByText('지역을 선택하면 상세 정보가 표시됩니다.')).toBeVisible();
    await expect(page).not.toHaveURL(/regions=/);
  });
});
