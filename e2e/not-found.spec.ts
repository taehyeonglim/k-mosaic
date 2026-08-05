import { expect, test } from '@playwright/test';

test('E12 존재하지 않는 정적 경로에서 not-found 오류 화면이 표시된다', async ({ page }) => {
  const response = await page.goto('/r4-e2e-does-not-exist', { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(404);
  await expect(page.getByText('요청한 화면을 찾을 수 없습니다.', { exact: true })).toBeVisible();
  await expect(
    page.getByText('문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('#main-content').getByRole('link', { name: '전국 개요', exact: true }),
  ).toBeVisible();
});
