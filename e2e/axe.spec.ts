import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const pages = [
  { name: '/', path: '/', readyHeading: '전국 개요', readyHeadingCount: 1 },
  { name: '/sources', path: '/sources/', readyHeading: '출처 및 계산식', readyHeadingCount: 3 },
];
const themes = ['light', 'dark'] as const;
const viewports = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile-360x740', width: 360, height: 740 },
];

type AxeAnalysis = Awaited<ReturnType<AxeBuilder['analyze']>>;

function formatViolations(violations: AxeAnalysis['violations']): string {
  return violations
    .map((violation) => {
      const nodes = violation.nodes
        .map((node) => node.target.map((selector) => JSON.stringify(selector)).join(', '))
        .join(' | ');
      return `${violation.impact ?? 'unknown'} ${violation.id}: ${nodes}`;
    })
    .join('\n');
}

async function openTargetPage(page: Page, target: (typeof pages)[number]): Promise<void> {
  const response = await page.goto(target.path, { waitUntil: 'networkidle' });
  if (response === null || !response.ok()) {
    throw new Error(`${target.path} 페이지를 불러오지 못했습니다.`);
  }
  const readyHeading = page.getByRole('heading', { name: target.readyHeading, exact: true });
  await expect(readyHeading).toHaveCount(target.readyHeadingCount);
  await expect(readyHeading.first()).toBeVisible();
}

test.describe('axe 자동 접근성 검사', () => {
  for (const target of pages) {
    for (const theme of themes) {
      for (const viewport of viewports) {
        test(`${target.name} · ${theme} · ${viewport.name} · WCAG 2.1 A/AA`, async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await openTargetPage(page, target);

          const themeButton = page.getByRole('button', { name: theme, exact: true });
          await expect(themeButton).toHaveCount(1);
          await themeButton.click();
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

          const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

          expect(
            results.violations,
            results.violations.length > 0
              ? `axe 위반 (${target.name}, ${theme}, ${viewport.name})\n${formatViolations(results.violations)}`
              : undefined,
          ).toEqual([]);
        });
      }
    }
  }
});
