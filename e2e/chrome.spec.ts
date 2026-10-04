import { expect, test, type Page } from '@playwright/test';

import { assertNoHorizontalOverflow } from './helpers';

// 사이트 공통 크롬(잉크 헤더·주요 메뉴·테마 전환·건너뛰기 링크·푸터)의 계약.
// 예전에는 페이지마다 본문 안에 서로 다른 이동 버튼 줄이 있었다 (2026-10 디자인 개편).

const INK = 'rgb(11, 33, 43)';
const NAV_NAME = '주요 메뉴';
const NAV_ITEMS = ['다문화학생', '대학 외국인 유학생', '데이터 출처'];

const pages = [
  { path: '/', current: '다문화학생', ariaCurrent: 'page' },
  { path: '/foreign-students/', current: '대학 외국인 유학생', ariaCurrent: 'page' },
  { path: '/sources/', current: '데이터 출처', ariaCurrent: 'page' },
  // 지역 페이지는 메뉴 항목 자체가 아니라 '다문화학생' 아래의 하위 페이지다.
  { path: '/regions/11/', current: '다문화학생', ariaCurrent: 'true' },
] as const;

function primaryNav(page: Page) {
  return page.locator('header').getByRole('navigation', { name: NAV_NAME, exact: true });
}

test.describe('공통 크롬', () => {
  for (const target of pages) {
    test(`${target.path} — 주요 메뉴가 현재 위치를 표시한다`, async ({ page }) => {
      await page.goto(target.path, { waitUntil: 'networkidle' });

      const nav = primaryNav(page);
      await expect(nav.getByRole('link')).toHaveText(NAV_ITEMS);
      const marked = nav.locator('[aria-current]');
      await expect(marked).toHaveCount(1);
      await expect(marked).toHaveText(target.current);
      await expect(marked).toHaveAttribute('aria-current', target.ariaCurrent);
    });

    test(`${target.path} — 테마 전환은 헤더에 하나만 있다`, async ({ page }) => {
      await page.goto(target.path, { waitUntil: 'networkidle' });

      await expect(page.getByRole('button', { name: 'dark', exact: true })).toHaveCount(1);
      await expect(
        page.locator('header').getByRole('button', { name: 'dark', exact: true }),
      ).toBeVisible();
    });

    test(`${target.path} — 헤더와 푸터가 두 테마 모두 잉크 띠 위에 있다`, async ({ page }) => {
      await page.goto(target.path, { waitUntil: 'networkidle' });

      for (const theme of ['light', 'dark'] as const) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const colors = await page.evaluate(() => {
          const band = document.querySelector('header')?.closest('.ink-band');
          const footer = document.querySelector('footer.ink-band');
          return {
            header: band ? getComputedStyle(band).backgroundColor : null,
            footer: footer ? getComputedStyle(footer).backgroundColor : null,
          };
        });
        expect(colors).toEqual({ header: INK, footer: INK });
      }
    });

    test(`${target.path} — 360px 에서 가로로 넘치지 않는다`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(target.path, { waitUntil: 'networkidle' });

      await expect(primaryNav(page).getByRole('link')).toHaveCount(NAV_ITEMS.length);
      await assertNoHorizontalOverflow(page);
    });
  }

  test('주요 메뉴로 세 페이지를 오갈 수 있다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    await primaryNav(page).getByRole('link', { name: '대학 외국인 유학생', exact: true }).click();
    await expect(page).toHaveURL(/\/foreign-students\/$/);
    await primaryNav(page).getByRole('link', { name: '데이터 출처', exact: true }).click();
    await expect(page).toHaveURL(/\/sources\/$/);
    await primaryNav(page).getByRole('link', { name: '다문화학생', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: '전국 개요', exact: true })).toBeVisible();
  });

  // 대시보드는 헤더 바로 아래(잉크 띠 안)의 전국 개요부터가 본문이다 — <main> 으로
  // 건너뛰면 핵심 수치를 지나친다. 다른 페이지는 <main> 으로 보낸다.
  for (const target of [
    { path: '/', id: 'overview' },
    { path: '/sources/', id: 'main-content' },
  ]) {
    test(`${target.path} — 건너뛰기 링크가 첫 포커스 대상이고 본문으로 보낸다`, async ({
      page,
    }) => {
      await page.goto(target.path, { waitUntil: 'networkidle' });

      await page.keyboard.press('Tab');
      const skipLink = page.getByRole('link', { name: '본문으로 건너뛰기', exact: true });
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toHaveAttribute('href', `#${target.id}`);
      await page.keyboard.press('Enter');
      await expect(page.locator(`#${target.id}`)).toBeFocused();
    });
  }

  test('푸터에 서체 라이선스를 표기한다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: /Pretendard/ })).toHaveAttribute(
      'href',
      'https://github.com/orioncactus/pretendard',
    );
    await expect(footer.getByText('SIL Open Font License 1.1')).toBeVisible();
  });

  test('없는 경로(404)에도 헤더와 주요 메뉴가 있다', async ({ page }) => {
    await page.goto('/r4-e2e-does-not-exist', { waitUntil: 'domcontentloaded' });

    await expect(
      page.locator('header').getByRole('heading', { name: 'K-MOSAIC', exact: true }),
    ).toBeVisible();
    await expect(primaryNav(page).getByRole('link')).toHaveText(NAV_ITEMS);
    await expect(primaryNav(page).locator('[aria-current]')).toHaveCount(0);
  });
});
